import { z } from "zod";
import Clip from "../models/Clip.js";
import Share from "../models/Share.js";
import { detectPlatform, sanitizeFormatId } from "../services/platform.js";
import { getResolved, setResolved } from "../services/resolveCache.js";
import { downloadTikTok, isTikTokFormat, resolveTikTok } from "../services/tiktok.js";
import { downloadTwitter, isTwitterFormat, resolveTwitter } from "../services/twitter.js";
import {
  downloadSocialMedia,
  isRapidApiPlatform,
  resolveSocialMedia,
} from "../services/rapidApi/socialMediaDownloader.js";
import {
  downloadStreamSaver,
  isStreamSaverFormat,
  isStreamSaverPlatform,
  resolveStreamSaver,
  searchYouTube,
} from "../services/streamSaver.js";
import { downloadMedia, resolveMedia } from "../services/ytdlp.js";
import { resolvePlayUrl } from "../services/playUrl.js";
import { proxyCdnUrl, refererForMediaUrl, requestRange } from "../services/cdnProxy.js";
import env from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { buildDownloadFilename } from "../utils/downloadFilename.js";
import { signStreamToken, verifyStreamToken } from "../utils/streamToken.js";

const urlSchema = z.object({
  url: z.string().trim().min(1, "Paste a link first"),
});

const LEGACY_FALLBACK_PLATFORMS = new Set([
  "twitter",
  "youtube",
  "instagram",
  "facebook",
  "pinterest",
  "threads",
  "soundcloud",
]);

async function resolvePreview(platform, url) {
  if (platform === "tiktok") {
    return resolveTikTok(url);
  }

  if (isStreamSaverPlatform(platform)) {
    try {
      return await resolveStreamSaver(url, platform);
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[streamsaver]", err.message);
      }
      if (!LEGACY_FALLBACK_PLATFORMS.has(platform)) throw err;
      try {
        if (platform === "twitter") return await resolveTwitter(url);
        if (isRapidApiPlatform(platform) && env.rapidApi.key) {
          return await resolveSocialMedia(url, platform);
        }
        return await resolveMedia(url, platform);
      } catch (fallbackErr) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[streamsaver fallback]", fallbackErr.message);
        }
        throw err;
      }
    }
  }

  return resolveMedia(url, platform);
}

function serializeClip(clip) {
  const owner = clip.userId;
  const ownerUsername =
    owner && typeof owner === "object" && owner.username ? owner.username : undefined;

  return {
    id: clip._id,
    platform: clip.platform,
    sourceUrl: clip.sourceUrl,
    title: clip.title,
    author: clip.author,
    thumbnail: clip.thumbnail,
    formatId: clip.formatId || "",
    mediaType: clip.mediaType,
    playUrl: clip.playUrl || "",
    visibility: clip.visibility === "public" ? "public" : "private",
    ownerUsername,
    createdAt: clip.createdAt,
  };
}

async function fetchMediaFile(sourceUrl, formatId, { range } = {}) {
  const { platform, url } = detectPlatform(sourceUrl);
  const id = sanitizeFormatId(formatId);
  const options = { range };

  if (isTikTokFormat(id)) {
    return downloadTikTok(url, id, options);
  }
  if (isStreamSaverFormat(id)) {
    return downloadStreamSaver(url, id, platform, options);
  }
  if (isTwitterFormat(id)) {
    return downloadTwitter(url, id, options);
  }
  if (isRapidApiPlatform(platform)) {
    return downloadSocialMedia(url, id, platform, options);
  }
  return downloadMedia(url, id, options);
}

function playableContentType(contentType, fallback = "video/mp4") {
  const type = String(contentType || "").toLowerCase();
  if (type.includes("mpegurl") || type.includes("video/") || type.includes("audio/")) {
    return contentType;
  }
  return fallback;
}

function pipeInlineStream(res, file, { filename = "questsave-clip" } = {}) {
  res.setHeader("Content-Type", playableContentType(file.contentType));
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  res.setHeader("Accept-Ranges", file.acceptRanges || "bytes");
  if (file.contentRange) {
    res.setHeader("Content-Range", file.contentRange);
  }
  if (file.size) {
    res.setHeader("Content-Length", file.size);
  }
  if (file.statusCode === 206) {
    res.status(206);
  }

  file.stream.on("close", () => {
    file.cleanup();
  });
  file.stream.on("error", () => {
    file.cleanup();
  });
  file.stream.pipe(res);
}

function isPlayableContentType(contentType) {
  const type = String(contentType || "").toLowerCase();
  return (
    type.includes("video/") ||
    type.includes("audio/") ||
    type.includes("mpegurl") ||
    type.includes("octet-stream")
  );
}

async function proxyPlayUrl(playUrl, { range, platform } = {}) {
  const file = await proxyCdnUrl(playUrl, {
    referer: refererForMediaUrl(playUrl, platform),
    range,
    contentType: "video/mp4",
    timeout: 4000,
  });

  if (!isPlayableContentType(file.contentType)) {
    file.cleanup();
    throw new Error("Stored play URL is not a media stream");
  }

  file.contentType = playableContentType(file.contentType);
  return file;
}

async function refreshPlayUrl(clip) {
  if (!clip?._id || !clip.formatId) return;
  try {
    const playUrl = await resolvePlayUrl(clip.sourceUrl, clip.formatId);
    if (playUrl) {
      await Clip.updateOne({ _id: clip._id }, { playUrl });
    }
  } catch {
    // ignore background refresh failures
  }
}

async function streamClipMedia(clip, { range } = {}) {
  if (clip.playUrl?.startsWith("http")) {
    try {
      return await proxyPlayUrl(clip.playUrl, { range, platform: clip.platform });
    } catch {
      // stale CDN URLs should not block playback
    }
  }

  const formatId = clip.formatId || "";
  if (!formatId) {
    throw new AppError("This clip has no playable format saved", 422);
  }

  const file = await fetchMediaFile(clip.sourceUrl, formatId, { range });
  file.contentType = playableContentType(file.contentType);
  void refreshPlayUrl(clip);
  return file;
}

async function ensureClipAccess(clipId, userId) {
  const clip = await Clip.findById(clipId);
  if (!clip) {
    throw new AppError("Clip not found", 404);
  }

  if (clip.visibility === "public") {
    return clip;
  }

  if (!userId) {
    throw new AppError("Sign in to continue", 401);
  }

  if (String(clip.userId) === String(userId)) {
    return clip;
  }

  const shared = await Share.findOne({ clipId: clip._id, toUserId: userId });
  if (!shared) {
    throw new AppError("You do not have access to this clip", 403);
  }

  return clip;
}

export const searchYoutube = asyncHandler(async (req, res) => {
  const q = String(req.query.q || req.query.query || req.query.url || "").trim();
  if (!q) {
    throw new AppError("Search query is required", 400);
  }
  const result = await searchYouTube(q);
  res.json(result);
});

export const resolveClip = asyncHandler(async (req, res) => {
  const parsed = urlSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || "Invalid request", 400);
  }

  const { platform, url } = detectPlatform(parsed.data.url);
  const cached = getResolved(url);
  if (cached) {
    res.json(cached);
    return;
  }

  const preview = await resolvePreview(platform, url);
  setResolved(url, preview);
  res.json(preview);
});

function pipeAttachment(res, file, { platform, title }) {
  const ext = (file.filename || "").includes(".")
    ? file.filename.split(".").pop()
    : file.contentType?.includes("image")
      ? "jpg"
      : file.contentType?.includes("audio")
        ? "mp3"
        : "mp4";
  const filename = buildDownloadFilename({ platform, title, ext });

  res.setHeader("Content-Type", playableContentType(file.contentType, file.contentType || "application/octet-stream"));
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  if (file.size) {
    res.setHeader("Content-Length", file.size);
  }

  file.stream.on("close", () => {
    file.cleanup();
  });
  file.stream.on("error", () => {
    file.cleanup();
  });
  file.stream.pipe(res);
}

export const downloadClip = asyncHandler(async (req, res) => {
  const parsed = urlSchema
    .extend({
      formatId: z.string().trim().min(1, "Choose a download format"),
      title: z.string().optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || "Invalid request", 400);
  }

  const { platform, url } = detectPlatform(parsed.data.url);
  const formatId = sanitizeFormatId(parsed.data.formatId);
  const file = await fetchMediaFile(url, formatId);
  const title = parsed.data.title?.trim() || getResolved(url)?.title || "";
  pipeAttachment(res, file, { platform, title });
});

export const previewStream = asyncHandler(async (req, res) => {
  const parsed = z
    .object({
      url: z.string().trim().min(1),
      formatId: z.string().trim().min(1),
    })
    .safeParse(req.query);

  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || "Invalid request", 400);
  }

  const { url } = detectPlatform(parsed.data.url);
  const formatId = sanitizeFormatId(parsed.data.formatId);
  const file = await fetchMediaFile(url, formatId, { range: requestRange(req) });
  pipeInlineStream(res, file);
});

export const clipStreamAccess = asyncHandler(async (req, res) => {
  const clip = await ensureClipAccess(req.params.id, req.user?._id);
  const token = signStreamToken({
    clipId: clip._id,
    userId: req.user?._id || clip.userId,
  });

  res.json({ token });
});

export const downloadSavedClip = asyncHandler(async (req, res) => {
  let userId = req.user?._id;
  const token = req.query.token;
  if (typeof token === "string" && token) {
    const payload = verifyStreamToken(token);
    if (String(payload.clipId) !== String(req.params.id)) {
      throw new AppError("Invalid download link", 401);
    }
    userId = payload.userId;
  }

  const clip = await ensureClipAccess(req.params.id, userId);
  const formatId = clip.formatId || "";
  if (!formatId) {
    throw new AppError("This clip has no download format saved", 422);
  }

  const file = await fetchMediaFile(clip.sourceUrl, formatId);
  pipeAttachment(res, file, {
    platform: clip.platform,
    title: clip.title || "",
  });
});

export const streamClip = asyncHandler(async (req, res) => {
  const token = req.query.token;
  if (!token || typeof token !== "string") {
    throw new AppError("Missing stream token", 401);
  }

  const payload = verifyStreamToken(token);
  if (String(payload.clipId) !== String(req.params.id)) {
    throw new AppError("Invalid stream link", 401);
  }

  const clip = await ensureClipAccess(req.params.id, payload.userId);
  const file = await streamClipMedia(clip, { range: requestRange(req) });
  pipeInlineStream(res, file, { filename: clip.title || "questsave-clip" });
});

export const listDiscover = asyncHandler(async (req, res) => {
  const clips = await Clip.find({ visibility: "public" })
    .sort({ createdAt: -1 })
    .limit(80)
    .populate("userId", "username")
    .lean();

  res.json({
    clips: clips.map((clip) => serializeClip(clip)),
  });
});

export const saveClip = asyncHandler(async (req, res) => {
  const parsed = z
    .object({
      url: z.string().trim().min(1),
      platform: z.string().trim().optional(),
      title: z.string().optional(),
      author: z.string().optional(),
      thumbnail: z.string().optional(),
      formatId: z.string().optional(),
      mediaType: z.enum(["video", "image", "audio", "mixed"]).optional(),
      visibility: z.enum(["private", "public"]).optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || "Invalid request", 400);
  }

  const detected = detectPlatform(parsed.data.url);
  const formatId = parsed.data.formatId || "";
  let playUrl = "";

  if (formatId) {
    try {
      playUrl = await resolvePlayUrl(detected.url, formatId);
    } catch {
      playUrl = "";
    }
  }

  const clip = await Clip.create({
    userId: req.user._id,
    platform: parsed.data.platform || detected.platform,
    sourceUrl: detected.url,
    title: parsed.data.title || "",
    author: parsed.data.author || "",
    thumbnail: parsed.data.thumbnail || "",
    formatId,
    mediaType: parsed.data.mediaType || "video",
    playUrl,
    visibility: parsed.data.visibility === "public" ? "public" : "private",
  });

  res.status(201).json({ clip: serializeClip(clip) });
});

export const listClips = asyncHandler(async (req, res) => {
  const clips = await Clip.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  res.json({
    clips: clips.map((clip) => serializeClip(clip)),
  });
});

export const deleteClip = asyncHandler(async (req, res) => {
  const clip = await Clip.findOneAndDelete({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!clip) {
    throw new AppError("Clip not found", 404);
  }

  await Share.deleteMany({ clipId: clip._id });
  res.json({ ok: true });
});

export const previewStreamUrl = asyncHandler(async (req, res) => {
  const parsed = z
    .object({
      url: z.string().trim().min(1),
      formatId: z.string().trim().min(1),
    })
    .safeParse(req.query);

  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || "Invalid request", 400);
  }

  const { url } = detectPlatform(parsed.data.url);
  const formatId = sanitizeFormatId(parsed.data.formatId);

  res.json({
    path: `/api/clips/preview/stream?url=${encodeURIComponent(url)}&formatId=${encodeURIComponent(formatId)}`,
  });
});
