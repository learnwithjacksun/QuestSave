import axios from "axios";
import * as cheerio from "cheerio";
import { AppError } from "../utils/AppError.js";
import { resolveMedia } from "./ytdlp.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const TIKTOK_HEADERS = {
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.tiktok.com/",
};

const TIKWM_API = "https://www.tikwm.com/api/";
const CACHE_TTL_MS = 5 * 60 * 1000;

/** @type {Map<string, { expires: number, cookies: string, urls: Record<string, string> }>} */
const mediaCache = new Map();

function cacheKey(url) {
  return url.split("?")[0];
}

function putCache(url, urls, cookies = "") {
  const usable = Object.fromEntries(
    Object.entries(urls).filter(([, value]) => typeof value === "string" && value.startsWith("http"))
  );
  if (!Object.keys(usable).length) return;
  mediaCache.set(cacheKey(url), {
    expires: Date.now() + CACHE_TTL_MS,
    cookies,
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

function cookieFromResponse(headers) {
  const setCookie = headers["set-cookie"];
  if (!setCookie) return "";
  const list = Array.isArray(setCookie) ? setCookie : [setCookie];
  return list.map((part) => String(part).split(";")[0]).join("; ");
}

function findItemStruct(node, depth = 0) {
  if (!node || typeof node !== "object" || depth > 14) return null;

  if (node.video?.playAddr || node.video?.downloadAddr || node.imagePost) {
    return node;
  }

  if (node.itemStruct) {
    const nested = findItemStruct(node.itemStruct, depth + 1);
    if (nested) return nested;
  }

  const detail = node["webapp.video-detail"]?.itemInfo?.itemStruct;
  if (detail) {
    const nested = findItemStruct(detail, depth + 1);
    if (nested) return nested;
    return detail;
  }

  if (node.ItemModule && typeof node.ItemModule === "object") {
    for (const value of Object.values(node.ItemModule)) {
      const nested = findItemStruct(value, depth + 1);
      if (nested) return nested;
    }
  }

  for (const value of Object.values(node)) {
    if (!value || typeof value !== "object") continue;
    const nested = findItemStruct(value, depth + 1);
    if (nested) return nested;
  }

  return null;
}

function parseEmbeddedJson(html) {
  const $ = cheerio.load(html);
  const candidates = [
    $("#__UNIVERSAL_DATA_FOR_REHYDRATION__").text(),
    $("#SIGI_STATE").text() || $("#SIGI_STATE").html(),
    $("#__NEXT_DATA__").text(),
  ];

  for (const raw of candidates) {
    const text = String(raw || "").trim();
    if (!text) continue;
    try {
      return JSON.parse(text);
    } catch {
      // keep looking
    }
  }

  return null;
}

/** Full-res download URL first; smaller candidate for carousel preview when available. */
function imageEntriesFromItem(item) {
  const images = item?.imagePost?.images;
  if (!Array.isArray(images)) return [];
  return images
    .map((img) => {
      const list = (img?.imageURL?.urlList || []).filter(
        (src) => typeof src === "string" && src.startsWith("http")
      );
      if (!list.length) return null;
      return {
        full: list[0],
        preview: list[1] || list[list.length - 1] || list[0],
      };
    })
    .filter(Boolean);
}

function previewFromItem(url, item) {
  const video = item.video || {};
  const author = item.author || {};
  const stats = item.stats || {};
  const images = imageEntriesFromItem(item);
  const playAddr = video.playAddr || video.PlayAddrStruct?.UrlList?.[0] || "";
  const downloadAddr = video.downloadAddr || "";
  const cover =
    video.originCover || video.cover || video.dynamicCover || images[0]?.preview || images[0]?.full || "";

  const urls = {};
  if (playAddr) urls["tt:play"] = playAddr;
  if (downloadAddr && downloadAddr !== playAddr) urls["tt:download"] = downloadAddr;
  images.forEach((entry, index) => {
    urls[`tt:img:${index}`] = entry.full;
  });

  const formats = [];
  if (urls["tt:play"] || urls["tt:download"]) {
    formats.push({
      id: urls["tt:play"] ? "tt:play" : "tt:download",
      ext: "mp4",
      qualityLabel: "MP4",
      mediaKind: "video",
      filesize: null,
      height: video.height || null,
    });
  }
  if (images.length) {
    formats.push({
      id: "tt:img:0",
      ext: "jpg",
      qualityLabel: "JPG",
      mediaKind: "image",
      filesize: null,
      height: null,
    });
  }

  if (!formats.length) return null;

  const mediaType = images.length && !playAddr ? "image" : images.length && playAddr ? "mixed" : "video";
  const nickname = author.nickname || author.uniqueId || "";

  return {
    preview: {
      platform: "tiktok",
      sourceUrl: url,
      mediaType,
      title: item.desc || item.title || "",
      author: nickname,
      thumbnail: cover,
      stats: {
        likes: stats.diggCount ?? null,
        comments: stats.commentCount ?? null,
        views: stats.playCount ?? null,
      },
      slides: images.length
        ? images.map((entry, index) => ({
            id: String(index),
            thumbnail: entry.preview,
            title: item.desc || `Photo ${index + 1}`,
            downloadId: `tt:img:${index}`,
            mediaKind: "image",
          }))
        : [{ id: String(item.id || "0"), thumbnail: cover, title: item.desc || "", mediaKind: "video" }],
      formats,
    },
    urls,
  };
}

async function scrapeTikTok(url) {
  const response = await axios.get(url, {
    headers: TIKTOK_HEADERS,
    maxRedirects: 5,
    timeout: 20_000,
    responseType: "text",
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const data = parseEmbeddedJson(response.data);
  if (!data) return null;

  const item = findItemStruct(data);
  if (!item) return null;

  const mapped = previewFromItem(url, item);
  if (!mapped) return null;

  putCache(url, mapped.urls, cookieFromResponse(response.headers));
  return mapped.preview;
}

function previewFromTikWm(url, payload) {
  const data = payload?.data;
  if (!data || payload.code !== 0) return null;

  const images = Array.isArray(data.images) ? data.images.filter((src) => typeof src === "string") : [];
  const urls = {};
  if (data.hdplay) urls["tikwm:hd"] = data.hdplay;
  if (data.play) urls["tikwm:play"] = data.play;
  if (data.wmplay) urls["tikwm:wm"] = data.wmplay;
  if (data.music) urls["tikwm:music"] = data.music;
  images.forEach((src, index) => {
    urls[`tikwm:img:${index}`] = src;
  });

  const formats = [];
  const videoId = urls["tikwm:hd"] ? "tikwm:hd" : urls["tikwm:play"] ? "tikwm:play" : urls["tikwm:wm"] ? "tikwm:wm" : null;
  if (videoId) {
    formats.push({
      id: videoId,
      ext: "mp4",
      qualityLabel: "MP4",
      mediaKind: "video",
      filesize: null,
      height: data.height || null,
    });
  }
  if (urls["tikwm:music"]) {
    formats.push({
      id: "tikwm:music",
      ext: "mp3",
      qualityLabel: "MP3",
      mediaKind: "audio",
      filesize: null,
      height: null,
    });
  }
  if (images.length) {
    formats.push({
      id: "tikwm:img:0",
      ext: "jpg",
      qualityLabel: "JPG",
      mediaKind: "image",
      filesize: null,
      height: null,
    });
  }

  if (!formats.length) return null;

  const mediaType = images.length && !data.play && !data.hdplay ? "image" : images.length && videoId ? "mixed" : "video";
  const author = data.author?.nickname || data.author?.unique_id || "";
  const cover = data.cover || data.origin_cover || images[0] || "";

  return {
    preview: {
      platform: "tiktok",
      sourceUrl: url,
      mediaType,
      title: data.title || "",
      author,
      thumbnail: cover,
      stats: {
        likes: data.digg_count ?? null,
        comments: data.comment_count ?? null,
        views: data.play_count ?? null,
      },
      slides: images.length
        ? images.map((thumbnail, index) => ({
            id: String(index),
            thumbnail,
            title: data.title || `Photo ${index + 1}`,
            downloadId: `tikwm:img:${index}`,
            mediaKind: "image",
          }))
        : [{ id: String(data.id || "0"), thumbnail: cover, title: data.title || "", mediaKind: "video" }],
      formats,
    },
    urls,
  };
}

async function resolveTikWm(url) {
  const response = await axios.post(
    TIKWM_API,
    new URLSearchParams({ url, hd: "1" }).toString(),
    {
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Referer: "https://www.tikwm.com/",
      },
      timeout: 25_000,
    }
  );

  const mapped = previewFromTikWm(url, response.data);
  if (!mapped) return null;
  putCache(url, mapped.urls);
  return mapped.preview;
}

export async function resolveTikTok(url) {
  try {
    const scraped = await scrapeTikTok(url);
    if (scraped) return scraped;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[tiktok scrape]", err.message);
    }
  }

  try {
    const tikwm = await resolveTikWm(url);
    if (tikwm) return tikwm;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[tikwm]", err.message);
    }
  }

  return resolveMedia(url, "tiktok");
}

function filenameFor(formatId, contentType) {
  if (formatId.includes("music") || contentType.includes("audio")) return "questsave.mp3";
  if (formatId.includes(":img:") || contentType.includes("image")) return "questsave.jpg";
  return "questsave.mp4";
}

function refererFor(formatId) {
  return formatId.startsWith("tikwm:") ? "https://www.tikwm.com/" : "https://www.tiktok.com/";
}

const FORMAT_ALIASES = {
  "tt:play": ["tikwm:hd", "tikwm:play", "tt:download"],
  "tt:download": ["tikwm:wm", "tikwm:play", "tikwm:hd"],
  "tikwm:hd": ["tikwm:play", "tt:play"],
  "tikwm:play": ["tikwm:hd", "tt:play"],
  "tikwm:wm": ["tt:download", "tikwm:play"],
};

function pickCachedMedia(cached, formatId) {
  if (!cached) return null;
  if (cached.urls[formatId]) {
    return { mediaUrl: cached.urls[formatId], resolvedId: formatId, cookies: cached.cookies };
  }
  for (const alt of FORMAT_ALIASES[formatId] || []) {
    if (cached.urls[alt]) {
      return { mediaUrl: cached.urls[alt], resolvedId: alt, cookies: cached.cookies };
    }
  }
  const imgMatch = /^(?:tt|tikwm):img:(\d+)$/.exec(formatId);
  if (imgMatch) {
    for (const alt of [`tt:img:${imgMatch[1]}`, `tikwm:img:${imgMatch[1]}`]) {
      if (cached.urls[alt]) {
        return { mediaUrl: cached.urls[alt], resolvedId: alt, cookies: cached.cookies };
      }
    }
  }
  const fallback = Object.entries(cached.urls).find(
    ([id]) => !id.includes("img") && !id.includes("music")
  );
  if (!fallback) return null;
  return { mediaUrl: fallback[1], resolvedId: fallback[0], cookies: cached.cookies };
}

async function proxyCdn(mediaUrl, formatId, cookies = "") {
  const response = await axios.get(mediaUrl, {
    responseType: "stream",
    maxRedirects: 5,
    timeout: 180_000,
    headers: {
      "User-Agent": USER_AGENT,
      Referer: refererFor(formatId),
      Accept: "*/*",
      ...(cookies ? { Cookie: cookies } : {}),
    },
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const contentType = response.headers["content-type"] || "application/octet-stream";
  const size = Number(response.headers["content-length"]) || 0;

  return {
    stream: response.data,
    filename: filenameFor(formatId, contentType),
    contentType,
    size,
    cleanup: () => {
      response.data.destroy?.();
    },
  };
}

export function isTikTokFormat(formatId) {
  return formatId.startsWith("tt:") || formatId.startsWith("tikwm:");
}

export async function downloadTikTok(url, formatId) {
  let cached = getCache(url);
  if (!pickCachedMedia(cached, formatId)) {
    await resolveTikTok(url);
    cached = getCache(url);
  }

  let picked = pickCachedMedia(cached, formatId);
  if (!picked) {
    throw new AppError("Could not resolve a downloadable file for this TikTok.", 422);
  }

  try {
    return await proxyCdn(picked.mediaUrl, picked.resolvedId, picked.cookies);
  } catch {
    if (!formatId.startsWith("tt:")) {
      throw new AppError("Could not download this TikTok. Try another format.", 502);
    }

    try {
      await resolveTikWm(url);
    } catch {
      throw new AppError("Could not download this TikTok. Try another format.", 502);
    }

    picked = pickCachedMedia(getCache(url), formatId);
    if (!picked) {
      throw new AppError("Could not download this TikTok. Try another format.", 502);
    }

    try {
      return await proxyCdn(picked.mediaUrl, picked.resolvedId, picked.cookies);
    } catch {
      throw new AppError("Could not download this TikTok. Try another format.", 502);
    }
  }
}
