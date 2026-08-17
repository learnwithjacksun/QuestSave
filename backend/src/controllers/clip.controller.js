import { z } from "zod";
import axios from "axios";
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
import { downloadMedia, resolveMedia } from "../services/ytdlp.js";
import { resolvePlayUrl } from "../services/playUrl.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { buildDownloadFilename } from "../utils/downloadFilename.js";
import { signStreamToken, verifyStreamToken } from "../utils/streamToken.js";

const urlSchema = z.object({
  url: z.string().trim().min(1, "Paste a link first"),
});

function serializeClip(clip) {
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
    createdAt: clip.createdAt,
  };
}

async function fetchMediaFile(sourceUrl, formatId) {
  const { platform, url } = detectPlatform(sourceUrl);
  const id = sanitizeFormatId(formatId);

  if (isTikTokFormat(id)) {
    return downloadTikTok(url, id);
  }
  if (isTwitterFormat(id)) {
    return downloadTwitter(url, id);
  }
  if (isRapidApiPlatform(platform)) {
    return downloadSocialMedia(url, id, platform);
  }
  return downloadMedia(url, id);
}

function pipeInlineStream(res, file, { filename = "questsave-clip" } = {}) {
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  if (file.size) {
    res.setHeader("Content-Length", file.size);
  }
  res.setHeader("Accept-Ranges", "bytes");

  file.stream.on("close", () => {
    file.cleanup();
  });
  file.stream.on("error", () => {
    file.cleanup();
  });
  file.stream.pipe(res);
}

const STREAM_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function proxyPlayUrl(playUrl) {
  const response = await axios.get(playUrl, {
    responseType: "stream",
    maxRedirects: 5,
    timeout: 180_000,
    headers: {
      "User-Agent": STREAM_USER_AGENT,
      Accept: "*/*",
    },
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const contentType = response.headers["content-type"] || "video/mp4";
  const size = Number(response.headers["content-length"]) || 0;

  return {
    stream: response.data,
    contentType,
    size,
    cleanup: () => {
      response.data.destroy?.();
    },
  };
}

async function streamClipMedia(clip) {
  if (clip.playUrl?.startsWith("http")) {
    try {
      return await proxyPlayUrl(clip.playUrl);
    } catch {
      // fall through to resolve/download pipeline
    }
  }

  const formatId = clip.formatId || "";
  if (!formatId) {
    throw new AppError("This clip has no playable format saved", 422);
  }

  return fetchMediaFile(clip.sourceUrl, formatId);
}

async function ensureClipAccess(clipId, userId) {
  const clip = await Clip.findById(clipId);
  if (!clip) {
    throw new AppError("Clip not found", 404);
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

  const preview =
    platform === "tiktok"
      ? await resolveTikTok(url)
      : platform === "twitter"
        ? await resolveTwitter(url)
        : isRapidApiPlatform(platform)
          ? await resolveSocialMedia(url, platform)
          : await resolveMedia(url, platform);
  setResolved(url, preview);
  res.json(preview);
});

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
  const ext = (file.filename || "").includes(".")
    ? file.filename.split(".").pop()
    : file.contentType?.includes("image")
      ? "jpg"
      : file.contentType?.includes("audio")
        ? "mp3"
        : "mp4";

  const filename = buildDownloadFilename({ platform, title, ext });

  res.setHeader("Content-Type", file.contentType);
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
  const file = await fetchMediaFile(url, formatId);
  pipeInlineStream(res, file);
});

export const clipStreamAccess = asyncHandler(async (req, res) => {
  const clip = await ensureClipAccess(req.params.id, req.user._id);
  const token = signStreamToken({
    clipId: clip._id,
    userId: req.user._id,
  });

  const base = `${req.protocol}://${req.get("host")}`;
  res.json({
    src: `${base}/api/clips/${clip._id}/stream?token=${encodeURIComponent(token)}`,
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
  const file = await streamClipMedia(clip);
  pipeInlineStream(res, file, { filename: clip.title || "questsave-clip" });
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
  const base = `${req.protocol}://${req.get("host")}`;

  res.json({
    src: `${base}/api/clips/preview/stream?url=${encodeURIComponent(url)}&formatId=${encodeURIComponent(formatId)}`,
  });
});
