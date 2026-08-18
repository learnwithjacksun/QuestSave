import axios from "axios";
import env from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { proxyCdnUrl, refererForMediaUrl } from "./cdnProxy.js";

const FORMAT_PREFIX = "ss:";
const CACHE_TTL_MS = 5 * 60 * 1000;

const STREAMSAVER_PLATFORMS = new Set([
  "youtube",
  "instagram",
  "facebook",
  "twitter",
  "pinterest",
  "threads",
  "soundcloud",
  "douyin",
  "xiaohongshu",
  "xiaohongshu-profile",
  "snackvideo",
  "cocofun",
  "kuaishou",
  "capcut",
  "gdrive",
  "mediafire",
  "spotify",
  "yts",
]);

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** @type {Map<string, { expires: number, platform: string, sourceUrl: string, media: Record<string, object> }>} */
const mediaCache = new Map();

export function isStreamSaverPlatform(platform) {
  return STREAMSAVER_PLATFORMS.has(platform);
}

export function isStreamSaverFormat(formatId) {
  return String(formatId || "").startsWith(FORMAT_PREFIX);
}

function cacheKey(url) {
  return String(url).trim();
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

function putCache(url, platform, media) {
  if (!media || !Object.keys(media).length) return;
  mediaCache.set(cacheKey(url), {
    expires: Date.now() + CACHE_TTL_MS,
    platform,
    sourceUrl: url,
    media,
  });
}

function httpUrl(value) {
  return typeof value === "string" && value.startsWith("http") ? value : "";
}

function streamSaverHint(platform) {
  if (platform === "twitter") return "twitter";
  if (STREAMSAVER_PLATFORMS.has(platform)) return platform;
  return "";
}

function extFromFormat(fmt, kind) {
  const mime = String(fmt.mimeType || "").toLowerCase();
  const id = String(fmt.id || "").toLowerCase();
  if (mime.includes("mp3") || mime === "audio/mpeg" || id === "mp3") return "mp3";
  if (mime.includes("m4a") || id === "m4a") return "m4a";
  if (mime.includes("jpeg") || mime.includes("jpg") || id === "jpg" || id === "jpeg") return "jpg";
  if (mime.includes("png") || id === "png") return "png";
  if (mime.includes("webp") || id === "webp") return "webp";
  if (mime.includes("gif") || id === "gif") return "gif";
  if (mime.includes("webm") || id === "webm") return "webm";
  if (mime.includes("mp4") || id === "mp4") return "mp4";
  if (kind === "audio") return "mp3";
  if (kind === "image") return "jpg";
  return "mp4";
}

function kindFromFormat(fmt) {
  const kind = String(fmt.kind || "").toLowerCase();
  if (kind === "audio" || kind === "image" || kind === "video") return kind;
  const mime = String(fmt.mimeType || "").toLowerCase();
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "video";
}

function qualityLabel(fmt, ext) {
  const label = String(fmt.label || "")
    .replace(/\s*[·•|]\s*(video|audio|image|file)\s*$/i, "")
    .trim();
  if (label) return label;
  return ext.toUpperCase();
}

function parseHeight(label) {
  const match = /(\d{3,4})\s*p/i.exec(String(label || ""));
  return match ? Number(match[1]) : null;
}

function internalFormatId(rawId) {
  const safe = String(rawId || "file").replace(/[^a-zA-Z0-9._+\-]/g, "_");
  return `${FORMAT_PREFIX}${safe}`.slice(0, 80);
}

function upstreamFormatId(formatId) {
  const value = String(formatId || "");
  return value.startsWith(FORMAT_PREFIX) ? value.slice(FORMAT_PREFIX.length) : value;
}

function filenameFor(entry) {
  if (entry?.mediaKind === "audio") return `questsave.${entry.ext || "mp3"}`;
  if (entry?.mediaKind === "image") return `questsave.${entry.ext || "jpg"}`;
  return `questsave.${entry?.ext || "mp4"}`;
}

async function messageFromBody(data) {
  if (!data) return "";
  if (Buffer.isBuffer(data)) {
    try {
      return JSON.parse(data.toString("utf8")).message || "";
    } catch {
      return "";
    }
  }
  if (typeof data === "string") {
    try {
      return JSON.parse(data).message || data;
    } catch {
      return data;
    }
  }
  if (typeof data === "object" && typeof data.message === "string" && !data.pipe) {
    return data.message;
  }
  if (data && typeof data.pipe === "function") {
    const chunks = [];
    for await (const chunk of data) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const text = Buffer.concat(chunks).toString("utf8");
    try {
      return JSON.parse(text).message || "";
    } catch {
      return "";
    }
  }
  return "";
}

async function wrapStreamSaverError(err, fallback) {
  if (err instanceof AppError) return err;
  const message = (await messageFromBody(err?.response?.data)) || err?.message || fallback;
  const status = err?.response?.status;
  if (status === 400 || status === 404) return new AppError(message, status);
  return new AppError(message || fallback, 502);
}

async function streamSaverGet(path, params, { responseType = "json", range = "" } = {}) {
  const headers = {
    Accept: responseType === "json" ? "application/json" : "*/*",
    "User-Agent": USER_AGENT,
  };
  if (range) headers.Range = range;

  return axios.get(`${env.streamSaver.baseUrl}${path}`, {
    params,
    headers,
    responseType,
    timeout: responseType === "json" ? env.streamSaver.timeoutMs : Math.max(env.streamSaver.timeoutMs, 180_000),
    maxRedirects: 5,
    validateStatus: (status) => status >= 200 && status < 400,
  });
}

function mapPreview(info, sourceUrl, platform) {
  const formatsIn = Array.isArray(info?.formats) ? info.formats : [];
  const media = {};
  const formats = [];
  const imageSlides = [];
  const kinds = new Set();

  formatsIn.forEach((fmt, index) => {
    const kind = kindFromFormat(fmt);
    const ext = extFromFormat(fmt, kind);
    const id = internalFormatId(fmt.id || `${kind}-${index}`);
    const url = httpUrl(fmt.url);
    const mimeType = fmt.mimeType || (kind === "image" ? "image/jpeg" : kind === "audio" ? "audio/mpeg" : "video/mp4");
    const label = qualityLabel(fmt, ext);

    media[id] = {
      upstreamId: String(fmt.id || ""),
      url,
      mimeType,
      ext,
      mediaKind: kind,
    };
    formats.push({
      id,
      ext,
      qualityLabel: label,
      mediaKind: kind,
      filesize: null,
      height: parseHeight(fmt.label) || parseHeight(label),
    });
    kinds.add(kind);

    if (kind === "image") {
      imageSlides.push({
        id: String(index),
        thumbnail: url || httpUrl(info.thumbnail) || "",
        title: info.title || `Photo ${imageSlides.length + 1}`,
        downloadId: id,
        mediaKind: "image",
      });
    }
  });

  if (!formats.length) {
    throw new AppError("No downloadable formats found", 404);
  }

  const previewType = String(info.previewType || "").toLowerCase();
  const mediaType =
    kinds.size === 1
      ? [...kinds][0]
      : kinds.has("video") && kinds.has("image")
        ? "mixed"
        : previewType === "audio" || previewType === "image" || previewType === "video"
          ? previewType
          : [...kinds][0] || "video";

  const thumbnail = httpUrl(info.thumbnail) || imageSlides[0]?.thumbnail || "";
  const title = info.title || "";
  const slides =
    imageSlides.length > 1
      ? imageSlides
      : [
          {
            id: "0",
            thumbnail,
            title,
            mediaKind: mediaType === "mixed" ? "video" : mediaType,
            downloadId: imageSlides.length === 1 ? imageSlides[0].downloadId : undefined,
          },
        ];

  return {
    preview: {
      platform: isStreamSaverPlatform(info.platform) ? info.platform : platform,
      sourceUrl,
      mediaType,
      title,
      author: info.author || "",
      thumbnail,
      stats: { likes: null, comments: null, views: null },
      slides,
      formats,
    },
    media,
  };
}

function pickMedia(cached, formatId) {
  if (!cached?.media) return null;
  if (cached.media[formatId]) return cached.media[formatId];
  const upstream = upstreamFormatId(formatId);
  const prefixed = internalFormatId(upstream);
  if (cached.media[prefixed]) return cached.media[prefixed];
  const match = Object.values(cached.media).find((item) => item.upstreamId === formatId || item.upstreamId === upstream);
  if (match) return match;
  const firstVideo = Object.values(cached.media).find((item) => item.mediaKind === "video");
  return firstVideo || Object.values(cached.media)[0] || null;
}

async function fetchInfo(url, platform) {
  const params = { url };
  const hint = streamSaverHint(platform);
  if (hint) params.platform = hint;

  try {
    const response = await streamSaverGet("/info", params);
    return response.data;
  } catch (err) {
    throw await wrapStreamSaverError(err, "Could not fetch media");
  }
}

export async function resolveStreamSaver(url, platform) {
  const info = await fetchInfo(url, platform);
  const mapped = mapPreview(info, url, platform);
  putCache(url, mapped.preview.platform || platform, mapped.media);
  return mapped.preview;
}

async function ensureFormat(url, formatId, platform) {
  let cached = getCache(url);
  let entry = pickMedia(cached, formatId);
  if (entry) return { cached, entry };

  await resolveStreamSaver(url, platform);
  cached = getCache(url);
  entry = pickMedia(cached, formatId);
  if (!entry) {
    throw new AppError("Could not resolve a downloadable file for this link.", 422);
  }
  return { cached, entry };
}

async function proxyCached(entry, platform, range) {
  if (!httpUrl(entry.url)) {
    throw new AppError("Could not resolve a downloadable file for this link.", 422);
  }
  const file = await proxyCdnUrl(entry.url, {
    referer: refererForMediaUrl(entry.url, platform),
    range,
    filename: filenameFor(entry),
    contentType: entry.mimeType,
  });
  return {
    ...file,
    filename: filenameFor({ ...entry, mimeType: file.contentType }),
    contentType: file.contentType || entry.mimeType,
  };
}

async function streamFromDownload(url, entry, platform, range) {
  const params = { url };
  if (entry.upstreamId) params.id = entry.upstreamId;
  const hint = streamSaverHint(platform);
  if (hint) params.platform = hint;

  try {
    const response = await streamSaverGet("/download", params, { responseType: "stream", range });
    const type = response.headers["content-type"] || entry.mimeType || "application/octet-stream";
    if (String(type).includes("application/json")) {
      const message = (await messageFromBody(response.data)) || "Could not download media file";
      throw new AppError(message, 502);
    }

    return {
      stream: response.data,
      filename: filenameFor({ ...entry, mimeType: type }),
      contentType: type,
      size: Number(response.headers["content-length"]) || 0,
      contentRange: response.headers["content-range"] || "",
      acceptRanges: response.headers["accept-ranges"] || "bytes",
      statusCode: response.status === 206 ? 206 : 200,
      cleanup: () => {
        response.data.destroy?.();
      },
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw await wrapStreamSaverError(err, "Could not download media file");
  }
}

export async function resolveStreamSaverPlayUrl(url, formatId, platform) {
  const { entry } = await ensureFormat(url, formatId, platform);
  if (!httpUrl(entry.url)) {
    throw new AppError("Could not resolve a playable URL for this link.", 422);
  }
  return entry.url;
}

export async function downloadStreamSaver(url, formatId, platform, { range } = {}) {
  const { entry } = await ensureFormat(url, formatId, platform);

  if (httpUrl(entry.url)) {
    try {
      return await proxyCached(entry, platform, range);
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 422) throw err;
    }
  }

  try {
    return await streamFromDownload(url, entry, platform, range);
  } catch (err) {
    mediaCache.delete(cacheKey(url));
    const refreshed = await ensureFormat(url, formatId, platform);
    if (httpUrl(refreshed.entry.url)) {
      try {
        return await proxyCached(refreshed.entry, platform, range);
      } catch {
        // last resort: Stream Saver /download
      }
    }
    return streamFromDownload(url, refreshed.entry, platform, range);
  }
}

function formatTimestamp(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function youtubeIdFromUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") return parsed.pathname.split("/").filter(Boolean)[0] || "";
    return parsed.searchParams.get("v") || "";
  } catch {
    return "";
  }
}

function normalizeSearchVideo(item) {
  const videoId = String(item?.videoId || "").trim() || youtubeIdFromUrl(item?.url || "");
  const url =
    httpUrl(item?.url) || (videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : "");
  if (!url) return null;

  const author = item?.author && typeof item.author === "object" ? item.author : {};
  return {
    type: "video",
    videoId,
    url,
    title: item?.title || "",
    description: item?.description || "",
    thumbnail:
      httpUrl(item?.thumbnail) ||
      (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ""),
    seconds: Number(item?.seconds) || 0,
    timestamp: item?.timestamp || formatTimestamp(item?.seconds),
    ago: item?.ago || "",
    views: Number(item?.views) || 0,
    author: {
      name: author.name || item?.authorName || "",
      url: httpUrl(author.url) || "",
    },
  };
}

const SEARCH_TTL_MS = 5 * 60 * 1000;
/** @type {Map<string, { expires: number, payload: object }>} */
const searchCache = new Map();

export async function searchYouTube(query) {
  const q = String(query || "").trim();
  if (!q) {
    throw new AppError("Search query is required", 400);
  }

  const key = q.toLowerCase();
  const cached = searchCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.payload;
  }

  try {
    const response = await streamSaverGet("/search", { q });
    const data = response.data;
    const videos = (Array.isArray(data?.videos) ? data.videos : [])
      .map(normalizeSearchVideo)
      .filter(Boolean);

    if (!videos.length) {
      throw new AppError("No videos found", 404);
    }

    const payload = {
      platform: "yts",
      query: data?.query || q,
      videos,
    };
    searchCache.set(key, { expires: Date.now() + SEARCH_TTL_MS, payload });
    return payload;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw await wrapStreamSaverError(err, "Could not search YouTube");
  }
}
