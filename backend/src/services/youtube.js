import axios from "axios";
import { Innertube, ClientType, Log } from "youtubei.js";
import { AppError } from "../utils/AppError.js";
import { resolveMedia, downloadMedia } from "./ytdlp.js";

// Avoid flooding stdout with JIT parser warnings on bot-check responses.
Log.setLevel(Log.Level.ERROR);

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const CACHE_TTL_MS = 5 * 60 * 1000;

/** Prefer mobile clients first — they often return progressive URLs without nsig. */
const CLIENT_ORDER = [
  ClientType.ANDROID,
  ClientType.ANDROID_VR,
  ClientType.IOS,
  ClientType.TV,
  ClientType.MWEB,
  ClientType.WEB,
];

/** @type {Map<string, Promise<import('youtubei.js').Innertube>>} */
const innertubeByClient = new Map();

/** @type {Map<string, { expires: number, urls: Record<string, string> }>} */
const mediaCache = new Map();

export function videoIdFromUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      if (id) return id;
    }

    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      const watchId = parsed.searchParams.get("v");
      if (watchId) return watchId;
      for (const kind of ["shorts", "embed", "live"]) {
        const match = parsed.pathname.match(new RegExp(`/${kind}/([^/?#]+)`));
        if (match?.[1]) return match[1];
      }
    }
  } catch {
    // ignore
  }
  return "";
}

function cacheKey(url) {
  const id = videoIdFromUrl(url);
  return id ? `youtube:${id}` : url.split("?")[0];
}

function putCache(url, urls) {
  const usable = Object.fromEntries(
    Object.entries(urls).filter(([, value]) => typeof value === "string" && value.startsWith("http"))
  );
  if (!Object.keys(usable).length) return;
  mediaCache.set(cacheKey(url), {
    expires: Date.now() + CACHE_TTL_MS,
    urls: usable,
  });
}

function getCache(url) {
  const entry = mediaCache.get(cacheKey(url));
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    mediaCache.delete(cacheKey(url));
    return null;
  }
  return entry;
}

function getInnertube(clientType) {
  const key = String(clientType);
  if (!innertubeByClient.has(key)) {
    const needsPlayer =
      clientType === ClientType.WEB ||
      clientType === ClientType.MWEB ||
      clientType === ClientType.TV;
    innertubeByClient.set(
      key,
      Innertube.create({
        client_type: clientType,
        retrieve_player: needsPlayer,
      })
    );
  }
  return innertubeByClient.get(key);
}

function heightOf(format) {
  if (format.height && format.height > 0 && format.height < 9000) return format.height;
  const label = String(format.quality_label || "");
  const match = /^(\d{3,4})p/i.exec(label);
  return match ? Number(match[1]) : 0;
}

function extOf(format) {
  const mime = String(format.mime_type || "").toLowerCase();
  if (mime.includes("audio/webm") || mime.includes("video/webm")) return "webm";
  if (mime.includes("audio/mp4") || mime.includes("audio/m4a")) return "m4a";
  if (mime.includes("audio/mpeg")) return "mp3";
  if (mime.includes("mp4")) return "mp4";
  return format.has_audio && !format.has_video ? "m4a" : "mp4";
}

function isBotCheck(info, err) {
  const status = String(info?.playability_status?.status || "").toUpperCase();
  const reason = String(info?.playability_status?.reason || err?.message || "").toLowerCase();
  return (
    status === "LOGIN_REQUIRED" ||
    reason.includes("sign in to confirm") ||
    reason.includes("not a bot") ||
    reason.includes("confirm you're not a bot") ||
    reason.includes("confirm you’re not a bot")
  );
}

async function formatUrl(format, player) {
  if (format.url && format.url.startsWith("http")) return format.url;
  try {
    const deciphered = await format.decipher(player);
    if (deciphered && deciphered.startsWith("http")) return deciphered;
  } catch {
    // ignore decipher failures
  }
  return "";
}

/**
 * Build preview + CDN URL map from an Innertube VideoInfo / MediaInfo.
 * Prefers progressive (combined A/V) so Orizon does not need ffmpeg.
 */
async function mapInfo(info, sourceUrl, player) {
  const streaming = info.streaming_data;
  if (!streaming) {
    if (isBotCheck(info)) {
      throw new AppError(
        "YouTube is blocking this server IP. Try again later, or configure cookies / yt-dlp on a host that can pass the bot check.",
        403
      );
    }
    throw new AppError("Could not extract media from this YouTube URL.", 422);
  }

  const all = [...(streaming.formats || []), ...(streaming.adaptive_formats || [])];
  const progressive = [];
  const audioOnly = [];

  for (const format of all) {
    if (!format?.itag) continue;
    const url = await formatUrl(format, player);
    if (!url) continue;

    if (format.has_video && format.has_audio) {
      progressive.push({ format, url });
    } else if (format.has_audio && !format.has_video) {
      audioOnly.push({ format, url });
    }
  }

  if (!progressive.length && !audioOnly.length) {
    if (isBotCheck(info)) {
      throw new AppError(
        "YouTube is blocking this server IP. Try again later, or configure cookies / yt-dlp on a host that can pass the bot check.",
        403
      );
    }
    throw new AppError(
      "No progressive YouTube formats were available. Install yt-dlp and ffmpeg for adaptive downloads.",
      422
    );
  }

  progressive.sort((a, b) => heightOf(b.format) - heightOf(a.format) || b.format.bitrate - a.format.bitrate);
  audioOnly.sort((a, b) => (b.format.bitrate || 0) - (a.format.bitrate || 0));

  /** @type {Record<string, string>} */
  const urls = {};
  /** @type {Array<object>} */
  const formats = [];
  /** @type {Set<string>} */
  const seenHeights = new Set();

  if (progressive.length) {
    const best = progressive[0];
    urls["yt:best"] = best.url;
    formats.push({
      id: "yt:best",
      ext: extOf(best.format),
      qualityLabel: "Best",
      mediaKind: "video",
      filesize: best.format.content_length ?? null,
      height: heightOf(best.format) || null,
    });

    for (const item of progressive) {
      const height = heightOf(item.format);
      const itagId = `yt:itag:${item.format.itag}`;
      urls[itagId] = item.url;

      if (height && !seenHeights.has(String(height))) {
        seenHeights.add(String(height));
        const heightId = `yt:h:${height}`;
        urls[heightId] = item.url;
        formats.push({
          id: heightId,
          ext: extOf(item.format),
          qualityLabel: `${height}p`,
          mediaKind: "video",
          filesize: item.format.content_length ?? null,
          height,
        });
      } else if (!height) {
        formats.push({
          id: itagId,
          ext: extOf(item.format),
          qualityLabel: item.format.quality_label || "MP4",
          mediaKind: "video",
          filesize: item.format.content_length ?? null,
          height: null,
        });
      }
    }
  }

  if (audioOnly[0]) {
    const item = audioOnly[0];
    const id = `yt:itag:${item.format.itag}`;
    urls[id] = item.url;
    formats.push({
      id,
      ext: extOf(item.format),
      qualityLabel: (extOf(item.format) || "M4A").toUpperCase(),
      mediaKind: "audio",
      filesize: item.format.content_length ?? null,
      height: null,
    });
  }

  // Cap picker options similarly to ytdlp mapFormats.
  const limited = formats.slice(0, 12);
  const basic = info.basic_info || {};
  const thumb =
    (Array.isArray(basic.thumbnail) && basic.thumbnail[0]?.url) ||
    basic.thumbnail?.[basic.thumbnail.length - 1]?.url ||
    (typeof basic.thumbnail === "string" ? basic.thumbnail : "") ||
    "";

  const mediaType = progressive.length ? "video" : "audio";
  const preview = {
    platform: "youtube",
    sourceUrl,
    mediaType,
    title: basic.title || "",
    author: basic.author || basic.channel?.name || "",
    thumbnail: thumb,
    stats: {
      likes: basic.like_count ?? null,
      comments: null,
      views: basic.view_count ?? null,
    },
    slides: [
      {
        id: String(basic.id || videoIdFromUrl(sourceUrl) || "0"),
        thumbnail: thumb,
        title: basic.title || "",
        mediaKind: mediaType,
      },
    ],
    formats: limited,
  };

  return { preview, urls };
}

async function resolveViaInnertube(url) {
  const videoId = videoIdFromUrl(url);
  if (!videoId) {
    throw new AppError("Paste a full YouTube link (watch, Shorts, or youtu.be).", 400);
  }

  let lastError = null;
  let sawBotCheck = false;

  for (const clientType of CLIENT_ORDER) {
    try {
      const yt = await getInnertube(clientType);
      const info = await yt.getBasicInfo(videoId, clientType);
      if (isBotCheck(info)) {
        sawBotCheck = true;
        lastError = new AppError(
          "YouTube is blocking this server IP. Try again later, or configure cookies / yt-dlp on a host that can pass the bot check.",
          403
        );
        continue;
      }
      const mapped = await mapInfo(info, url, yt.session.player);
      putCache(url, mapped.urls);
      return mapped.preview;
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 400) throw err;
      if (isBotCheck(null, err) || (err instanceof AppError && err.statusCode === 403)) {
        sawBotCheck = true;
      }
      lastError = err;
      if (process.env.NODE_ENV !== "production") {
        console.error(`[youtube ${clientType}]`, err.message || err);
      }
    }
  }

  if (sawBotCheck && lastError instanceof AppError) throw lastError;
  if (lastError instanceof AppError) throw lastError;
  throw new AppError("Could not extract media from this YouTube URL.", 422);
}

function isMissingYtdlp(err) {
  return (
    err instanceof AppError &&
    /yt-dlp is not installed/i.test(err.message || "")
  );
}

export async function resolveYouTube(url) {
  try {
    return await resolveViaInnertube(url);
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 400) throw err;

    try {
      return await resolveMedia(url, "youtube");
    } catch (ytdlpErr) {
      // Prefer the InnerTube bot-check message over a missing-binary error.
      if (isMissingYtdlp(ytdlpErr) && err instanceof AppError && err.statusCode === 403) {
        throw err;
      }
      if (isMissingYtdlp(ytdlpErr) && err instanceof AppError) {
        throw err;
      }
      throw ytdlpErr;
    }
  }
}

export function isYouTubeFormat(formatId) {
  return String(formatId || "").startsWith("yt:");
}

async function proxyCdn(mediaUrl) {
  const response = await axios.get(mediaUrl, {
    responseType: "stream",
    maxRedirects: 5,
    timeout: 180_000,
    headers: {
      "User-Agent": USER_AGENT,
      Referer: "https://www.youtube.com/",
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      Origin: "https://www.youtube.com",
    },
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const contentType = response.headers["content-type"] || "application/octet-stream";
  const size = Number(response.headers["content-length"]) || 0;
  const filename = contentType.includes("audio")
    ? "questsave.m4a"
    : contentType.includes("webm")
      ? "questsave.webm"
      : "questsave.mp4";

  return {
    stream: response.data,
    filename,
    contentType,
    size,
    cleanup: () => {
      response.data.destroy?.();
    },
  };
}

export async function downloadYouTube(url, formatId) {
  let cached = getCache(url);
  if (!cached?.urls?.[formatId]) {
    await resolveYouTube(url);
    cached = getCache(url);
  }

  // If resolve fell through to yt-dlp, formats won't be yt:* — caller shouldn't hit this,
  // but keep a safe fallback.
  if (!cached?.urls?.[formatId]) {
    if (!isYouTubeFormat(formatId)) {
      return downloadMedia(url, formatId);
    }
    throw new AppError("Could not resolve a downloadable file for this YouTube video.", 422);
  }

  try {
    return await proxyCdn(cached.urls[formatId]);
  } catch {
    // Stream URLs expire quickly — refresh once.
    mediaCache.delete(cacheKey(url));
    try {
      await resolveViaInnertube(url);
      cached = getCache(url);
      const mediaUrl = cached?.urls?.[formatId] || cached?.urls?.["yt:best"];
      if (!mediaUrl) {
        throw new AppError("Could not refresh the YouTube download link.", 502);
      }
      return await proxyCdn(mediaUrl);
    } catch (err) {
      if (err instanceof AppError) throw err;
      try {
        return await downloadMedia(url, "bv*+ba/b");
      } catch {
        throw new AppError("Could not download this YouTube video. Try another quality.", 502);
      }
    }
  }
}
