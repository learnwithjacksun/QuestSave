import axios from "axios";
import { AppError } from "../utils/AppError.js";
import { resolveMedia } from "./ytdlp.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const CACHE_TTL_MS = 5 * 60 * 1000;

/** @type {Map<string, { expires: number, urls: Record<string, string> }>} */
const mediaCache = new Map();

function statusIdFromUrl(url) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/status\/(\d+)/);
    return match?.[1] || "";
  } catch {
    return "";
  }
}

function screenNameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0] && parts[0] !== "i" && parts[0] !== "status") return parts[0];
  } catch {
    // ignore
  }
  return "";
}

function cacheKey(url) {
  const id = statusIdFromUrl(url);
  return id ? `twitter:${id}` : url.split("?")[0];
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

function syndicationToken(tweetId) {
  const value = (Number(tweetId) / 1e15) * Math.PI;
  return value.toString(36).replace(/(0+|\.)/g, "");
}

function bestVideoUrl(variants = []) {
  const mp4s = variants
    .filter((v) => typeof v?.url === "string" && (v.content_type || v.contentType || "").includes("mp4"))
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
  if (mp4s[0]?.url) return mp4s[0].url;
  const any = variants.find((v) => typeof v?.url === "string" && v.url.startsWith("http"));
  return any?.url || "";
}

function pickPhotoUrl(photo) {
  return (
    photo?.url ||
    photo?.media_url_https ||
    photo?.media_url ||
    (typeof photo === "string" ? photo : "") ||
    ""
  );
}

function normalizeFxMedia(tweet) {
  const media = tweet?.media || {};
  const all = Array.isArray(media.all)
    ? media.all
    : [
        ...(Array.isArray(media.videos) ? media.videos : []),
        ...(Array.isArray(media.photos) ? media.photos : []),
        ...(Array.isArray(media.gifs) ? media.gifs : []),
      ];

  return all
    .map((item) => {
      const type = String(item?.type || "").toLowerCase();
      if (type === "photo" || type === "image") {
        const url = pickPhotoUrl(item);
        return url ? { kind: "image", url, thumbnail: url } : null;
      }
      if (type === "video" || type === "gif" || type === "animated_gif") {
        const url =
          item?.url ||
          bestVideoUrl(item?.variants || item?.video_info?.variants || []) ||
          "";
        if (!url) return null;
        return {
          kind: "video",
          url,
          thumbnail: item?.thumbnail_url || item?.preview_image_url || item?.poster || "",
        };
      }
      return null;
    })
    .filter(Boolean);
}

function normalizeVxMedia(payload) {
  const extended = Array.isArray(payload?.media_extended) ? payload.media_extended : [];
  if (extended.length) {
    return extended
      .map((item) => {
        const type = String(item?.type || "").toLowerCase();
        const url = item?.url || "";
        if (!url) return null;
        if (type === "image" || type === "photo") {
          return { kind: "image", url, thumbnail: item?.thumbnail_url || url };
        }
        return {
          kind: type === "gif" ? "video" : "video",
          url,
          thumbnail: item?.thumbnail_url || "",
        };
      })
      .filter(Boolean);
  }

  const urls = Array.isArray(payload?.mediaURLs) ? payload.mediaURLs : [];
  return urls
    .map((url) => {
      if (typeof url !== "string" || !url.startsWith("http")) return null;
      const image = /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url) || url.includes("pbs.twimg.com/media");
      return {
        kind: image ? "image" : "video",
        url,
        thumbnail: image ? url : "",
      };
    })
    .filter(Boolean);
}

function normalizeSyndicationMedia(payload) {
  const details = Array.isArray(payload?.mediaDetails) ? payload.mediaDetails : [];
  if (details.length) {
    return details
      .map((item) => {
        const type = String(item?.type || "").toLowerCase();
        if (type === "photo") {
          const url = item.media_url_https || item.media_url || "";
          return url ? { kind: "image", url, thumbnail: url } : null;
        }
        if (type === "video" || type === "animated_gif") {
          const url = bestVideoUrl(item?.video_info?.variants || []);
          if (!url) return null;
          return {
            kind: "video",
            url,
            thumbnail: item.media_url_https || item.media_url || "",
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  const photos = Array.isArray(payload?.photos) ? payload.photos : [];
  if (photos.length) {
    return photos
      .map((photo) => {
        const url = pickPhotoUrl(photo);
        return url ? { kind: "image", url, thumbnail: url } : null;
      })
      .filter(Boolean);
  }

  if (payload?.video) {
    const url = bestVideoUrl(payload.video.variants || []);
    if (url) {
      return [{ kind: "video", url, thumbnail: payload.video.poster || "" }];
    }
  }

  return [];
}

function buildPreview(url, meta, mediaItems) {
  if (!mediaItems.length) return null;

  const urls = {};
  const slides = mediaItems.map((item, index) => {
    const id = item.kind === "image" ? `x:img:${index}` : `x:video:${index}`;
    urls[id] = item.url;
    return {
      id: String(index),
      thumbnail: item.thumbnail || (item.kind === "image" ? item.url : meta.thumbnail) || item.url,
      title: meta.title || `Media ${index + 1}`,
      downloadId: id,
      mediaKind: item.kind === "image" ? "image" : "video",
    };
  });

  const hasVideo = mediaItems.some((item) => item.kind === "video");
  const hasImage = mediaItems.some((item) => item.kind === "image");
  const mediaType = hasVideo && hasImage ? "mixed" : hasVideo ? "video" : "image";

  const formats = [];
  if (hasVideo) {
    const firstVideo = mediaItems.findIndex((item) => item.kind === "video");
    formats.push({
      id: `x:video:${firstVideo}`,
      ext: "mp4",
      qualityLabel: "MP4",
      mediaKind: "video",
      filesize: null,
      height: null,
    });
  }
  if (hasImage) {
    const firstImage = mediaItems.findIndex((item) => item.kind === "image");
    formats.push({
      id: `x:img:${firstImage}`,
      ext: "jpg",
      qualityLabel: "JPG",
      mediaKind: "image",
      filesize: null,
      height: null,
    });
  }

  return {
    preview: {
      platform: "twitter",
      sourceUrl: url,
      mediaType,
      title: meta.title || "",
      author: meta.author || "",
      thumbnail: slides[0]?.thumbnail || meta.thumbnail || "",
      stats: {
        likes: meta.likes ?? null,
        comments: meta.comments ?? null,
        views: meta.views ?? null,
      },
      slides,
      formats,
    },
    urls,
  };
}

async function fetchJson(url) {
  const response = await axios.get(url, {
    timeout: 20_000,
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
    validateStatus: (status) => status >= 200 && status < 500,
  });
  if (response.status >= 400) return null;
  if (typeof response.data !== "object" || response.data === null) return null;
  return response.data;
}

async function resolveFxTwitter(url) {
  const id = statusIdFromUrl(url);
  if (!id) return null;
  const screen = screenNameFromUrl(url);
  const paths = screen
    ? [`https://api.fxtwitter.com/${screen}/status/${id}`, `https://api.fxtwitter.com/status/${id}`]
    : [`https://api.fxtwitter.com/status/${id}`];

  for (const endpoint of paths) {
    const data = await fetchJson(endpoint);
    const tweet = data?.tweet;
    if (!tweet || tweet.type === "tombstone" || data?.code === 404) continue;
    const mediaItems = normalizeFxMedia(tweet);
    if (!mediaItems.length) continue;
    return buildPreview(
      url,
      {
        title: tweet.text || tweet.raw_text?.text || "",
        author: tweet.author?.name || tweet.author?.screen_name || screen || "",
        thumbnail: tweet.author?.avatar_url || "",
        likes: tweet.likes ?? null,
        comments: tweet.replies ?? null,
        views: tweet.views == null ? null : Number(tweet.views) || null,
      },
      mediaItems
    );
  }
  return null;
}

async function resolveVxTwitter(url) {
  const id = statusIdFromUrl(url);
  if (!id) return null;
  const screen = screenNameFromUrl(url) || "i";
  const data = await fetchJson(`https://api.vxtwitter.com/${screen}/status/${id}`);
  if (!data || data.error || (!data.mediaURLs && !data.media_extended)) return null;
  const mediaItems = normalizeVxMedia(data);
  if (!mediaItems.length) return null;
  return buildPreview(
    url,
    {
      title: data.text || data.tweet?.text || "",
      author: data.user_name || data.user_screen_name || screen,
      thumbnail: "",
      likes: data.likes ?? null,
      comments: data.replies ?? null,
      views: data.views == null ? null : Number(data.views) || null,
    },
    mediaItems
  );
}

async function resolveSyndication(url) {
  const id = statusIdFromUrl(url);
  if (!id) return null;
  const token = syndicationToken(id);
  const data = await fetchJson(
    `https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${token}`
  );
  if (!data || data.__typename === "TweetTombstone" || data.tombstone) return null;
  const mediaItems = normalizeSyndicationMedia(data);
  if (!mediaItems.length) return null;
  return buildPreview(
    url,
    {
      title: data.text || data.full_text || "",
      author: data.user?.name || data.user?.screen_name || "",
      thumbnail: data.user?.profile_image_url_https || "",
      likes: data.favorite_count ?? null,
      comments: data.conversation_count ?? null,
      views: data.views?.count == null ? null : Number(data.views.count) || null,
    },
    mediaItems
  );
}

export async function resolveTwitter(url) {
  if (!statusIdFromUrl(url)) {
    throw new AppError("Paste a full X/Twitter post link that includes /status/…", 400);
  }

  let sawTweet = false;
  for (const resolver of [resolveFxTwitter, resolveVxTwitter, resolveSyndication]) {
    try {
      const mapped = await resolver(url);
      if (mapped?.preview) {
        putCache(url, mapped.urls);
        return mapped.preview;
      }
      if (mapped === null) {
        // resolver ran; check if tweet existed without media via side channel below
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`[twitter ${resolver.name}]`, err.message);
      }
    }
  }

  // Detect text-only posts via FxTwitter before falling back to yt-dlp.
  try {
    const id = statusIdFromUrl(url);
    const screen = screenNameFromUrl(url);
    const endpoints = screen
      ? [`https://api.fxtwitter.com/${screen}/status/${id}`, `https://api.fxtwitter.com/status/${id}`]
      : [`https://api.fxtwitter.com/status/${id}`];
    for (const endpoint of endpoints) {
      const data = await fetchJson(endpoint);
      if (data?.code === 200 && data?.tweet && data.tweet.type !== "tombstone") {
        sawTweet = true;
        break;
      }
    }
  } catch {
    // ignore
  }

  if (sawTweet) {
    throw new AppError("This X post has no downloadable video or images.", 422);
  }

  // Last resort: yt-dlp (typically videos only).
  return resolveMedia(url, "twitter");
}

function filenameFor(formatId, contentType) {
  if (formatId.includes(":img:") || contentType.includes("image")) return "questsave.jpg";
  return "questsave.mp4";
}

export function isTwitterFormat(formatId) {
  return String(formatId || "").startsWith("x:");
}

export async function downloadTwitter(url, formatId) {
  let cached = getCache(url);
  if (!cached?.urls?.[formatId]) {
    await resolveTwitter(url);
    cached = getCache(url);
  }

  const mediaUrl = cached?.urls?.[formatId];
  if (!mediaUrl) {
    throw new AppError("Could not resolve a downloadable file for this X post.", 422);
  }

  try {
    const response = await axios.get(mediaUrl, {
      responseType: "stream",
      maxRedirects: 5,
      timeout: 180_000,
      headers: {
        "User-Agent": USER_AGENT,
        Referer: "https://x.com/",
        Accept: "*/*",
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
  } catch {
    throw new AppError("Could not download this X media. Try again in a moment.", 502);
  }
}
