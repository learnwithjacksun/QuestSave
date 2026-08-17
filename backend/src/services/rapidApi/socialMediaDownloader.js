import axios from "axios";
import env from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { proxyCdnUrl } from "../cdnProxy.js";

const RAPIDAPI_PLATFORMS = new Set(["youtube", "instagram", "facebook"]);
const CACHE_TTL_MS = 5 * 60 * 1000;

/** @type {Map<string, { expires: number, media: Record<string, object> }>} */
const mediaCache = new Map();

export function isRapidApiPlatform(platform) {
  return RAPIDAPI_PLATFORMS.has(platform);
}

export function youtubeVideoIdFromUrl(url) {
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

export function instagramShortcodeFromUrl(url) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const markers = new Set(["p", "reel", "reels", "tv", "share"]);
    for (let i = 0; i < parts.length; i += 1) {
      if (markers.has(parts[i].toLowerCase()) && parts[i + 1]) {
        const code = parts[i + 1];
        if (parts[i].toLowerCase() === "share" && markers.has(code.toLowerCase()) && parts[i + 2]) {
          return parts[i + 2];
        }
        if (/^[A-Za-z0-9_-]+$/.test(code)) return code;
      }
    }
  } catch {
    // ignore
  }
  return "";
}

function cacheKey(url, platform) {
  if (platform === "youtube") {
    const id = youtubeVideoIdFromUrl(url);
    if (id) return `youtube:${id}`;
  }
  if (platform === "instagram") {
    const code = instagramShortcodeFromUrl(url);
    if (code) return `instagram:${code}`;
  }
  return `${platform}:${String(url).split("?")[0]}`;
}

function putCache(url, platform, media) {
  const usable = Object.fromEntries(
    Object.entries(media).filter(([, value]) => value?.videoUrl)
  );
  if (!Object.keys(usable).length) return;
  mediaCache.set(cacheKey(url, platform), {
    expires: Date.now() + CACHE_TTL_MS,
    media: usable,
  });
}

function getCache(url, platform) {
  const entry = mediaCache.get(cacheKey(url, platform));
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    mediaCache.delete(cacheKey(url, platform));
    return null;
  }
  return entry;
}

function requireKey() {
  if (!env.rapidApi.key) {
    throw new AppError(
      "YouTube, Instagram, and Facebook downloads are not configured on this server.",
      503
    );
  }
}

function refererFor(platform) {
  if (platform === "instagram") return "https://www.instagram.com/";
  if (platform === "facebook") return "https://www.facebook.com/";
  return "https://www.youtube.com/";
}

function httpUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value) ? value : "";
}

function mediaUrlFromItem(item) {
  return (
    httpUrl(item?.url) ||
    httpUrl(item?.link) ||
    httpUrl(item?.downloadUrl) ||
    httpUrl(item?.download_url) ||
    httpUrl(item?.videoUrl) ||
    httpUrl(item?.video_url)
  );
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function parseSize(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    return n > 0 ? n : null;
  }
  const match = raw.match(/([\d.]+)\s*(kb|mb|gb|b)\b/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === "gb") return Math.round(amount * 1e9);
  if (unit === "mb") return Math.round(amount * 1e6);
  if (unit === "kb") return Math.round(amount * 1e3);
  return Math.round(amount);
}

function parseCount(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function pickThumbnail(value) {
  if (httpUrl(value)) return value;
  const list = asArray(value).filter(Boolean);
  const ranked = [...list].sort(
    (a, b) => Number(b?.width || b?.height || 0) - Number(a?.width || a?.height || 0)
  );
  return httpUrl(ranked[0]?.url) || httpUrl(ranked[0]) || "";
}

function extFromMime(mime, kind) {
  const value = String(mime || "").toLowerCase();
  if (value.includes("webm")) return "webm";
  if (value.includes("audio/mp4") || value.includes("audio/m4a")) return "m4a";
  if (value.includes("audio/mpeg")) return "mp3";
  if (value.includes("jpeg") || value.includes("jpg")) return "jpg";
  if (value.includes("png")) return "png";
  if (value.includes("webp")) return "webp";
  if (value.includes("gif")) return "gif";
  if (value.includes("mp4")) return "mp4";
  if (kind === "audio") return "m4a";
  if (kind === "image") return "jpg";
  return "mp4";
}

function mediaKindFromType(type) {
  const value = String(type || "").toLowerCase();
  if (/image|jpeg|jpg|png|webp|gif/.test(value)) return "image";
  if (/audio/.test(value)) return "audio";
  return "video";
}

function youtubeCombined(item) {
  const mime = String(item?.mimeType || item?.mime_type || "").toLowerCase();
  const itag = Number(item?.itag || 0);
  if ([18, 22].includes(itag)) return true;
  const hasVideo = /video\/|avc1|av01|mp4v|h264/.test(mime);
  const hasAudio = /mp4a|opus|vorbis|audio\//.test(mime);
  if (hasVideo && hasAudio) return true;
  if (item?.audioQuality && (item?.width || item?.height || item?.qualityLabel)) return true;
  return false;
}

function mapAxiosError(err) {
  const status = err?.response?.status;
  const payload = err?.response?.data;
  const message = String(
    (payload && typeof payload === "object" && (payload.message || payload.error || payload.detail)) ||
      err?.message ||
      ""
  );

  if (/not subscribed/i.test(message)) {
    return new AppError("The download service rejected this request. Try again later.", 502);
  }
  if (status === 401 || status === 403) {
    return new AppError("The download service rejected this request. Try again later.", 502);
  }
  if (status === 429) {
    return new AppError("Too many download requests. Try again shortly.", 429);
  }
  if (status === 404) {
    return new AppError("Could not extract media from this URL.", 422);
  }
  if (err?.code === "ECONNABORTED" || /timeout/i.test(err?.message || "")) {
    return new AppError("The download service timed out. Try again.", 504);
  }
  if (err?.code === "ERR_BAD_RESPONSE" || err?.code === "ECONNRESET") {
    return new AppError("Could not read this video from the download service. Try again.", 502);
  }
  if (!err?.response) {
    return new AppError("Could not reach the download service. Try again later.", 503);
  }
  return new AppError("Could not fetch this post. It may have been removed.", 502);
}

async function rapidGet(host, pathname, params) {
  requireKey();
  try {
    const response = await axios.get(`https://${host}${pathname}`, {
      params,
      headers: {
        "x-rapidapi-key": env.rapidApi.key,
        "x-rapidapi-host": host,
        Accept: "application/json",
      },
      timeout: env.rapidApi.timeoutMs,
      validateStatus: (status) => status >= 200 && status < 500,
    });

    const data = response.data;
    const message = String(
      (data && typeof data === "object" && (data.message || data.error || data.detail)) || ""
    );

    if (response.status === 429) {
      throw new AppError("Too many download requests. Try again shortly.", 429);
    }
    if (response.status === 401 || response.status === 403 || /not subscribed/i.test(message)) {
      throw new AppError("The download service rejected this request. Try again later.", 502);
    }
    if (response.status === 404 || /not found|unable to download|invalid url/i.test(message)) {
      throw new AppError("Could not extract media from this URL.", 422);
    }
    if (response.status >= 400) {
      throw new AppError("Could not fetch this post. It may have been removed.", 502);
    }
    return data;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (env.nodeEnv !== "production") {
      console.error("[rapidapi]", host, err.code || "", err.response?.status || "", err.message);
    }
    throw mapAxiosError(err);
  }
}

async function fetchYouTube(url) {
  const videoId = youtubeVideoIdFromUrl(url);
  if (!videoId) {
    throw new AppError("Paste a full YouTube link (watch, Shorts, or youtu.be).", 400);
  }
  const params = { id: videoId };
  if (env.rapidApi.youtubeCgeo) params.cgeo = env.rapidApi.youtubeCgeo;
  const data = await rapidGet(env.rapidApi.youtubeHost, "/dl", params);
  const status = String(data?.status || "").toUpperCase();
  const error = String(data?.error || data?.errorMsg || data?.reason || "");
  if (status && status !== "OK") {
    if (/sign in|bot/i.test(error)) {
      throw new AppError("This video requires a login or is blocked.", 403);
    }
    throw new AppError("Could not fetch this video. It may have been removed.", 422);
  }
  return data;
}

async function fetchInstagram(url) {
  if (!instagramShortcodeFromUrl(url)) {
    throw new AppError("Paste a full Instagram post or reel link.", 400);
  }
  const data = await rapidGet(env.rapidApi.instagramHost, "/instagram/", { url });
  if (data?.status === false) {
    throw new AppError("Could not extract media from this URL.", 422);
  }
  return data;
}

async function fetchFacebook(url) {
  return rapidGet(env.rapidApi.facebookHost, "/facebook", { url });
}

function addBest(formats, media) {
  const videos = formats.filter((fmt) => fmt.mediaKind === "video");
  if (!videos.length) return;
  const best = [...videos].sort((a, b) => (b.height || 0) - (a.height || 0))[0];
  if (!best || !media[best.id]) return;
  media["rap:best"] = media[best.id];
  formats.unshift({
    id: "rap:best",
    ext: best.ext,
    qualityLabel: "Best",
    mediaKind: "video",
    filesize: best.filesize,
    height: best.height,
  });
}

function previewFromItems({ platform, sourceUrl, title, author, thumbnail, stats, items, slidesMode }) {
  const referer = refererFor(platform);
  /** @type {Record<string, object>} */
  const media = {};
  /** @type {Array<object>} */
  const formats = [];
  const slides = [];
  const kinds = new Set();
  const seenHeights = new Set();

  items.forEach((item, index) => {
    const url = httpUrl(item.url);
    if (!url) return;
    const kind = item.kind || "video";
    const mime = item.mime || (kind === "image" ? "image/jpeg" : "video/mp4");
    const ext = item.ext || extFromMime(mime, kind);
    const height = Number(item.height || 0) || 0;
    const formatId = slidesMode
      ? `rap:s:${index}`
      : height
        ? `rap:h:${height}`
        : `rap:${kind[0]}:${index}`;

    if (!slidesMode && height && seenHeights.has(height) && kind === "video") return;
    if (!slidesMode && height) seenHeights.add(height);

    media[formatId] = {
      videoUrl: url,
      mimeType: mime,
      ext,
      referer,
      mediaKind: kind,
    };
    formats.push({
      id: formatId,
      ext,
      qualityLabel: item.qualityLabel || (height ? `${height}p` : ext.toUpperCase()),
      mediaKind: kind,
      filesize: parseSize(item.filesize),
      height: height || null,
    });
    kinds.add(kind);
    slides.push({
      id: String(item.id || index),
      thumbnail: httpUrl(item.thumb) || thumbnail,
      title: item.title || title || `Slide ${index + 1}`,
      mediaKind: kind,
      downloadId: slidesMode ? formatId : undefined,
    });
  });

  formats.sort((a, b) => {
    if (a.mediaKind !== b.mediaKind) return a.mediaKind === "video" ? -1 : 1;
    return (b.height || 0) - (a.height || 0);
  });

  if (formats.some((fmt) => fmt.mediaKind === "video")) {
    addBest(formats, media);
  }

  if (!formats.length) {
    throw new AppError("No downloadable video with audio was available for this post.", 422);
  }

  const mediaType =
    kinds.size === 1 ? [...kinds][0] : kinds.has("video") && kinds.has("image") ? "mixed" : [...kinds][0] || "video";

  return {
    preview: {
      platform,
      sourceUrl,
      mediaType,
      title,
      author,
      thumbnail,
      stats: stats || { likes: null, comments: null, views: null },
      slides: slides.length
        ? slidesMode
          ? slides
          : [
              {
                id: "0",
                thumbnail,
                title,
                mediaKind: mediaType === "mixed" ? "video" : mediaType,
              },
            ]
        : [
            {
              id: "0",
              thumbnail,
              title,
              mediaKind: mediaType,
            },
          ],
      formats: formats.slice(0, 12),
    },
    media,
  };
}

function normalizeYouTube(data, sourceUrl) {
  const combined = [...asArray(data?.formats), ...asArray(data?.adaptiveFormats)].filter(
    (item) => mediaUrlFromItem(item) && youtubeCombined(item)
  );
  const items = combined.map((item) => ({
    kind: "video",
    url: mediaUrlFromItem(item),
    mime: item.mimeType || item.mime_type,
    height: item.height,
    qualityLabel: item.qualityLabel || item.quality_label,
    filesize: item.contentLength || item.content_length,
  }));
  return previewFromItems({
    platform: "youtube",
    sourceUrl,
    title: data?.title || "",
    author: data?.channelTitle || data?.author || "",
    thumbnail: pickThumbnail(data?.thumbnail),
    stats: {
      likes: null,
      comments: null,
      views: parseCount(data?.viewCount),
    },
    items,
    slidesMode: false,
  });
}

function normalizeInstagram(data, sourceUrl) {
  const results = asArray(data?.result);
  const items = results
    .map((item) => {
      const kind = mediaKindFromType(item?.type);
      return {
        kind,
        url: mediaUrlFromItem(item),
        mime: item?.type,
        ext: extFromMime(item?.type, kind),
        filesize: item?.size,
        thumb: item?.thumb,
        qualityLabel: kind === "video" ? "MP4" : "JPG",
      };
    })
    .filter((item) => httpUrl(item.url));
  const slidesMode = items.length > 1;
  return previewFromItems({
    platform: "instagram",
    sourceUrl,
    title: "",
    author: "",
    thumbnail: httpUrl(items[0]?.thumb) || "",
    stats: { likes: null, comments: null, views: null },
    items,
    slidesMode,
  });
}

function facebookMediaItems(data) {
  const raw = asArray(data?.media);
  if (raw.length) return raw;
  const nested = data?.data && typeof data.data === "object" ? data.data : null;
  if (nested) return asArray(nested.media);
  return [];
}

function facebookQualityHeight(quality) {
  const value = String(quality || "").toLowerCase();
  if (value.includes("1080") || value === "fhd" || value === "fullhd") return 1080;
  if (value.includes("720") || value === "hd") return 720;
  if (value.includes("480")) return 480;
  if (value.includes("360") || value === "sd") return 360;
  const match = /(\d{3,4})p/.exec(value);
  return match ? Number(match[1]) : 0;
}

function normalizeFacebook(data, sourceUrl) {
  const raw = facebookMediaItems(data).filter((item) => httpUrl(item?.url));
  const kinds = new Set(raw.map((item) => mediaKindFromType(item.type)));
  const videos = raw.filter((item) => mediaKindFromType(item.type) === "video");
  const qualityVariants = videos.length > 1 && videos.every((item) => item.quality) && kinds.size === 1;
  const slidesMode = !qualityVariants && raw.length > 1;

  const items = raw.map((item) => {
    const kind = mediaKindFromType(item.type);
    const height = facebookQualityHeight(item.quality);
    const label =
      item.quality && String(item.quality).trim()
        ? String(item.quality).toUpperCase()
        : kind === "video"
          ? "MP4"
          : "JPG";
    return {
      kind,
      url: item.url,
      mime: kind === "image" ? "image/jpeg" : "video/mp4",
      ext: item.ext || extFromMime("", kind),
      height,
      qualityLabel: label,
      filesize: item.size || item.filesize,
      thumb: data?.thumbnail,
    };
  });

  return previewFromItems({
    platform: "facebook",
    sourceUrl,
    title: data?.title || "",
    author: data?.author || "",
    thumbnail: pickThumbnail(data?.thumbnail),
    stats: { likes: null, comments: null, views: parseCount(data?.views) },
    items,
    slidesMode,
  });
}

function normalizePreview(data, sourceUrl, platform) {
  if (platform === "youtube") return normalizeYouTube(data, sourceUrl);
  if (platform === "instagram") return normalizeInstagram(data, sourceUrl);
  if (platform === "facebook") return normalizeFacebook(data, sourceUrl);
  throw new AppError("This platform is not supported yet.", 400);
}

export async function resolveSocialMedia(url, platform) {
  if (!isRapidApiPlatform(platform)) {
    throw new AppError("This platform is not supported by the RapidAPI downloader.", 400);
  }
  const data =
    platform === "youtube"
      ? await fetchYouTube(url)
      : platform === "instagram"
        ? await fetchInstagram(url)
        : await fetchFacebook(url);
  const mapped = normalizePreview(data, url, platform);
  putCache(url, platform, mapped.media);
  return mapped.preview;
}

function filenameFor(entry) {
  if (entry.mediaKind === "audio") return `questsave.${entry.ext || "m4a"}`;
  if (entry.mediaKind === "image") return `questsave.${entry.ext || "jpg"}`;
  return `questsave.${entry.ext || "mp4"}`;
}

function contentTypeFor(entry) {
  if (entry.mimeType) return entry.mimeType;
  if (entry.mediaKind === "audio") return "audio/mp4";
  if (entry.mediaKind === "image") return "image/jpeg";
  return entry.ext === "webm" ? "video/webm" : "video/mp4";
}

async function proxyCdn(mediaUrl, entry, range) {
  const file = await proxyCdnUrl(mediaUrl, {
    referer: entry.referer || refererFor("youtube"),
    range,
    filename: filenameFor(entry),
    contentType: contentTypeFor(entry),
  });
  return {
    ...file,
    filename: filenameFor({ ...entry, mimeType: file.contentType }),
    contentType: file.contentType || contentTypeFor(entry),
  };
}

function pickMedia(cached, formatId) {
  if (!cached?.media) return null;
  if (cached.media[formatId]) return cached.media[formatId];
  if (cached.media["rap:best"]) return cached.media["rap:best"];
  const firstVideo = Object.values(cached.media).find((item) => item.mediaKind === "video");
  return firstVideo || Object.values(cached.media)[0] || null;
}

export async function resolveSocialMediaPlayUrl(url, formatId, platform) {
  let cached = getCache(url, platform);
  if (!cached?.media?.[formatId] && !cached?.media?.["rap:best"]) {
    await resolveSocialMedia(url, platform);
    cached = getCache(url, platform);
  }

  const entry = pickMedia(cached, formatId);
  if (!entry?.videoUrl) {
    throw new AppError("Could not resolve a playable URL for this post.", 422);
  }

  return entry.videoUrl;
}

export async function downloadSocialMedia(url, formatId, platform, { range } = {}) {
  let cached = getCache(url, platform);
  if (!cached?.media?.[formatId] && !cached?.media?.["rap:best"]) {
    await resolveSocialMedia(url, platform);
    cached = getCache(url, platform);
  }

  let entry = pickMedia(cached, formatId);
  if (!entry?.videoUrl) {
    throw new AppError("Could not resolve a downloadable file for this post.", 422);
  }

  const run = async (selected) => proxyCdn(selected.videoUrl, selected, range);

  try {
    return await run(entry);
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 503) throw err;
    mediaCache.delete(cacheKey(url, platform));
    try {
      await resolveSocialMedia(url, platform);
      cached = getCache(url, platform);
      entry = pickMedia(cached, formatId);
      if (!entry?.videoUrl) {
        throw new AppError("Could not refresh the download link.", 502);
      }
      return await run(entry);
    } catch (retryErr) {
      if (retryErr instanceof AppError) throw retryErr;
      throw new AppError("Could not download this file. Try another quality.", 502);
    }
  }
}
