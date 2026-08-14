import { spawn, execFileSync } from "child_process";
import { createReadStream, existsSync } from "fs";
import { mkdtemp, readdir, rm, stat } from "fs/promises";
import os from "os";
import path from "path";
import env from "../config/env.js";
import { AppError } from "../utils/AppError.js";

const FORMAT_ID_SAFE = /^[a-zA-Z0-9._+\-*/[\]():]+$/;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

let cachedJsRuntimes = null;
let cachedImpersonate = undefined;

function detectJsRuntimes() {
  if (cachedJsRuntimes) return cachedJsRuntimes;
  const runtimes = [];
  const deno =
    process.env.DENO_PATH ||
    ["deno", path.join(os.homedir(), ".deno/bin/deno")].find((candidate) => {
      try {
        if (candidate.includes("/") || candidate.includes("\\")) return existsSync(candidate);
        execFileSync(candidate, ["--version"], { stdio: "ignore", timeout: 3000 });
        return true;
      } catch {
        return false;
      }
    });
  if (deno) {
    runtimes.push(deno.includes("/") || deno.includes("\\") ? `deno:${deno}` : "deno");
  }
  try {
    execFileSync(process.execPath, ["--version"], { stdio: "ignore", timeout: 3000 });
    runtimes.push(`node:${process.execPath}`);
  } catch {
    // ignore
  }
  cachedJsRuntimes = runtimes;
  return runtimes;
}

function detectImpersonateTarget() {
  if (cachedImpersonate !== undefined) return cachedImpersonate;
  if (env.ytdlp.impersonate) {
    cachedImpersonate = env.ytdlp.impersonate;
    return cachedImpersonate;
  }
  try {
    const out = execFileSync(env.ytdlp.path, ["--list-impersonate-targets"], {
      encoding: "utf8",
      timeout: 8000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const available = out
      .split("\n")
      .filter((line) => /curl_cffi/i.test(line) && !/unavailable/i.test(line));
    const chrome = available.find((line) => /^Chrome\b/i.test(line.trim()));
    cachedImpersonate = chrome ? "chrome" : null;
  } catch {
    cachedImpersonate = null;
  }
  return cachedImpersonate;
}

function commonArgs() {
  const args = ["--no-warnings"];
  const impersonate = detectImpersonateTarget();
  if (impersonate) {
    args.push("--impersonate", impersonate);
  } else {
    args.push("--user-agent", USER_AGENT);
  }

  // web first so cookies are honored; android/tv as fallbacks. Syndication helps guest X access.
  args.push(
    "--extractor-args",
    "youtube:player_client=web,mweb,tv,android;twitter:api=syndication"
  );

  const runtimes = detectJsRuntimes();
  if (runtimes.length) {
    args.push("--js-runtimes", runtimes.join(","));
  }

  if (env.ytdlp.cookies && existsSync(env.ytdlp.cookies)) {
    args.push("--cookies", env.ytdlp.cookies);
  } else if (env.ytdlp.cookiesFromBrowser) {
    args.push("--cookies-from-browser", env.ytdlp.cookiesFromBrowser);
  }

  return args;
}

function mapExtractorError(stdout, stderr) {
  const combined = `${stderr}\n${stdout}`.toLowerCase();

  if (env.nodeEnv !== "production") {
    console.error("[yt-dlp]", stderr.trim() || stdout.trim());
  }

  if (
    combined.includes("sign in to confirm") ||
    combined.includes("confirm you're not a bot") ||
    combined.includes("confirm you’re not a bot") ||
    combined.includes("use --cookies")
  ) {
    return new AppError(
      "YouTube is blocking this server (bot check). Export cookies to YTDLP_COOKIES or set YTDLP_COOKIES_FROM_BROWSER, install deno/curl_cffi, then retry.",
      403
    );
  }
  if (combined.includes("http error 403") || combined.includes("403: forbidden")) {
    return new AppError("YouTube blocked this format. Try Best available, or another quality.", 403);
  }
  if (combined.includes("private") || combined.includes("login required")) {
    return new AppError("This post is private or requires a login.", 403);
  }
  if (combined.includes("geo") || combined.includes("not available in your")) {
    return new AppError("This media is not available in this region.", 403);
  }
  if (combined.includes("getaddrinfo") || combined.includes("failed to resolve") || combined.includes("timed out")) {
    return new AppError("Could not reach this platform. Check your network and try again.", 503);
  }
  if (
    combined.includes("unexpected response") ||
    combined.includes("unable to extract") ||
    combined.includes("impersonat")
  ) {
    return new AppError(
      "This platform is blocking extraction right now. Update yt-dlp, or add cookies for YouTube/X.",
      422
    );
  }
  if (combined.includes("unsupported url") || combined.includes("no video")) {
    return new AppError("Could not extract media from this URL.", 422);
  }
  return new AppError("Could not fetch this post. It may have been removed.", 422);
}

function runYtdlp(args, { timeoutMs = env.ytdlp.timeoutMs } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(env.ytdlp.path, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new AppError("Timed out fetching this link. Try again.", 504));
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      if (err.code === "ENOENT") {
        reject(
          new AppError(
            "yt-dlp is not installed on the server. Install yt-dlp and ffmpeg, then retry.",
            500
          )
        );
        return;
      }
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(mapExtractorError(stdout, stderr));
    });
  });
}

function parseDumpJson(stdout) {
  const lines = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const entries = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      // ignore non-json noise
    }
  }

  if (!entries.length) {
    throw new AppError("Could not read media metadata from this URL.", 422);
  }

  const first = entries[0];
  if (first._type === "playlist" && Array.isArray(first.entries)) {
    return first.entries.filter(Boolean);
  }

  return entries;
}

/** Prefer a mid/small thumb for carousel preview; fall back to largest / entry.thumbnail. */
function pickThumbnail(entry, { preferSmall = false } = {}) {
  const thumbs = Array.isArray(entry.thumbnails)
    ? entry.thumbnails.filter((t) => t?.url)
    : [];
  if (preferSmall && thumbs.length) {
    const sorted = [...thumbs].sort((a, b) => (a.width || 0) - (b.width || 0));
    const mid = sorted.find((t) => (t.width || 0) >= 240) || sorted[Math.min(1, sorted.length - 1)] || sorted[0];
    return mid?.url || entry.thumbnail || "";
  }
  if (entry.thumbnail) return entry.thumbnail;
  if (thumbs.length) {
    return thumbs[thumbs.length - 1]?.url || thumbs[0]?.url || "";
  }
  return "";
}

function mediaKindOf(fmt) {
  const vcodec = fmt.vcodec && fmt.vcodec !== "none";
  const acodec = fmt.acodec && fmt.acodec !== "none";
  if (vcodec && acodec) return "video";
  if (vcodec) return "video-only";
  if (acodec) return "audio";
  if (fmt.ext && ["jpg", "jpeg", "png", "webp", "gif"].includes(fmt.ext)) {
    return "image";
  }
  return "video";
}

function normalizeExt(ext, mediaKind) {
  const value = String(ext || "").toLowerCase();
  if (value === "jpeg") return "jpg";
  if (value) return value;
  if (mediaKind === "audio") return "m4a";
  if (mediaKind === "image") return "jpg";
  return "mp4";
}

function mapFormats(entry, mediaType) {
  if (mediaType === "image") {
    return [
      {
        id: "best",
        ext: "jpg",
        qualityLabel: "JPG",
        mediaKind: "image",
        filesize: null,
        height: null,
      },
    ];
  }

  const raw = Array.isArray(entry.formats) ? entry.formats : [];
  /** @type {Map<string, object>} */
  const byExt = new Map();

  const put = (option) => {
    const ext = normalizeExt(option.ext, option.mediaKind);
    const current = byExt.get(ext);
    if (!current || (option.height || 0) > (current.height || 0)) {
      byExt.set(ext, {
        id: option.id,
        ext,
        qualityLabel: ext.toUpperCase(),
        mediaKind: option.mediaKind,
        filesize: option.filesize ?? null,
        height: option.height ?? null,
      });
    }
  };

  if (mediaType !== "audio") {
    put({
      id: "bv*+ba/b",
      ext: "mp4",
      mediaKind: "video",
      filesize: null,
      height: 99999,
    });
  }

  const usable = raw.filter(
    (fmt) =>
      fmt.format_id &&
      FORMAT_ID_SAFE.test(String(fmt.format_id)) &&
      !String(fmt.format_id).includes("storyboard")
  );

  for (const fmt of usable) {
    const kind = mediaKindOf(fmt);
    if (kind === "video-only" && !fmt.height) continue;
    if (kind === "video" || kind === "video-only") {
      const isVideoOnly = kind === "video-only";
      put({
        id: isVideoOnly ? `${fmt.format_id}+bestaudio` : String(fmt.format_id),
        ext: isVideoOnly ? "mp4" : fmt.ext || "mp4",
        mediaKind: "video",
        filesize: fmt.filesize || fmt.filesize_approx || null,
        height: fmt.height || 0,
      });
    } else if (kind === "audio") {
      put({
        id: String(fmt.format_id),
        ext: fmt.ext || "m4a",
        mediaKind: "audio",
        filesize: fmt.filesize || fmt.filesize_approx || null,
        height: 0,
      });
    } else if (kind === "image") {
      put({
        id: String(fmt.format_id),
        ext: fmt.ext || "jpg",
        mediaKind: "image",
        filesize: fmt.filesize || fmt.filesize_approx || null,
        height: fmt.height || 0,
      });
    }
  }

  const options = [...byExt.values()];
  options.sort((a, b) => {
    const order = { video: 0, image: 1, audio: 2 };
    return (order[a.mediaKind] ?? 9) - (order[b.mediaKind] ?? 9);
  });
  return options.slice(0, 8);
}

function detectMediaType(entries) {
  const types = entries.map((entry) => {
    const ext = (entry.ext || "").toLowerCase();
    if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return "image";
    if (entry.vcodec === "none" && entry.acodec && entry.acodec !== "none") return "audio";
    if (typeof entry.duration === "number" && entry.duration > 0) return "video";
    if (entry.vcodec && entry.vcodec !== "none") return "video";
    return "image";
  });

  const set = new Set(types);
  if (set.size === 1) return [...set][0];
  return "mixed";
}

export async function resolveMedia(url, platform) {
  const usePlaylist =
    platform === "instagram" || platform === "facebook" || platform === "twitter";
  const playlistFlag = usePlaylist ? "--yes-playlist" : "--no-playlist";
  const { stdout } = await runYtdlp([
    "--dump-json",
    "--no-download",
    "--skip-download",
    playlistFlag,
    ...commonArgs(),
    url,
  ]);

  let entries = parseDumpJson(stdout);

  if (entries.length === 1 && entries[0]._type === "playlist") {
    const { stdout: playlistOut } = await runYtdlp([
      "--dump-json",
      "--no-download",
      "--skip-download",
      "--yes-playlist",
      ...commonArgs(),
      url,
    ]);
    entries = parseDumpJson(playlistOut);
  }

  entries = entries.filter((entry) => entry && entry._type !== "playlist");
  if (!entries.length) {
    throw new AppError("Could not extract media from this URL.", 422);
  }

  const mediaType = detectMediaType(entries);
  const multi = entries.length > 1;

  const slides = entries.map((entry, index) => {
    const entryType = detectMediaType([entry]);
    return {
      id: String(entry.id || index),
      thumbnail: pickThumbnail(entry, { preferSmall: true }),
      title: entry.title || "",
      mediaKind: entryType === "mixed" ? "video" : entryType,
      downloadId: multi ? `item:${index}` : entryType === "image" ? "best" : undefined,
    };
  });

  const primary = entries[0];
  let formats = mapFormats(primary, mediaType === "mixed" ? detectMediaType([primary]) : mediaType);

  if (mediaType === "image" || (mediaType === "mixed" && slides.every((s) => s.downloadId?.startsWith("item:")))) {
    const hasJpg = formats.some((f) => f.ext === "jpg" || f.mediaKind === "image");
    if (!hasJpg) {
      formats = [
        {
          id: multi ? "item:0" : "best",
          ext: "jpg",
          qualityLabel: "JPG",
          mediaKind: "image",
          filesize: null,
          height: null,
        },
        ...formats.filter((f) => f.mediaKind !== "image"),
      ];
    } else {
      formats = formats.map((f) =>
        f.mediaKind === "image"
          ? { ...f, id: multi ? "item:0" : f.id, qualityLabel: "JPG", ext: "jpg" }
          : f
      );
    }
  }

  return {
    platform,
    sourceUrl: url,
    mediaType,
    title: primary.title || primary.fulltitle || "",
    author: primary.uploader || primary.channel || primary.creator || "",
    thumbnail: pickThumbnail(primary),
    stats: {
      likes: primary.like_count ?? null,
      comments: primary.comment_count ?? null,
      views: primary.view_count ?? null,
    },
    slides,
    formats,
  };
}

export async function downloadMedia(url, formatId) {
  if (!FORMAT_ID_SAFE.test(formatId) || formatId.length > 80) {
    throw new AppError("Invalid format", 400);
  }

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "questsave-"));
  const output = path.join(tmpDir, "clip.%(ext)s");
  const itemMatch = /^item:(\d+)$/.exec(formatId);
  const timeout = { timeoutMs: Math.max(env.ytdlp.timeoutMs, 180_000) };

  try {
    if (itemMatch) {
      const playlistItem = String(Number(itemMatch[1]) + 1);
      await runYtdlp(
        [
          "--playlist-items",
          playlistItem,
          "-f",
          "best",
          "--yes-playlist",
          "-o",
          output,
          "--merge-output-format",
          "mp4",
          ...commonArgs(),
          url,
        ],
        timeout
      );
    } else {
      const ytdlpFormat = formatId === "best" ? "best" : formatId;
      const downloadArgs = (id) => [
        "-f",
        id,
        "--no-playlist",
        "-o",
        output,
        "--merge-output-format",
        "mp4",
        ...commonArgs(),
        url,
      ];

      try {
        await runYtdlp(downloadArgs(ytdlpFormat), timeout);
      } catch (err) {
        if (ytdlpFormat !== "bv*+ba/b" && ytdlpFormat !== "best") {
          await runYtdlp(downloadArgs("bv*+ba/b"), timeout);
        } else {
          throw err;
        }
      }
    }

    const files = await readdir(tmpDir);
    const clipFile = files.find((name) => name.startsWith("clip."));
    if (!clipFile) {
      throw new AppError("Download finished but no file was produced.", 500);
    }

    const filePath = path.join(tmpDir, clipFile);
    const info = await stat(filePath);
    const ext = path.extname(clipFile).slice(1) || "mp4";

    return {
      stream: createReadStream(filePath),
      filename: `questsave.${ext}`,
      contentType: contentTypeFor(ext),
      size: info.size,
      cleanup: () => rm(tmpDir, { recursive: true, force: true }),
    };
  } catch (err) {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

function contentTypeFor(ext) {
  const map = {
    mp4: "video/mp4",
    webm: "video/webm",
    mkv: "video/x-matroska",
    m4a: "audio/mp4",
    mp3: "audio/mpeg",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  return map[ext.toLowerCase()] || "application/octet-stream";
}
