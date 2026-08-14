import { z } from "zod";
import Clip from "../models/Clip.js";
import { detectPlatform, sanitizeFormatId } from "../services/platform.js";
import { getResolved, setResolved } from "../services/resolveCache.js";
import { downloadTikTok, isTikTokFormat, resolveTikTok } from "../services/tiktok.js";
import { downloadMedia, resolveMedia } from "../services/ytdlp.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

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
    createdAt: clip.createdAt,
  };
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

  const preview = platform === "tiktok" ? await resolveTikTok(url) : await resolveMedia(url, platform);
  setResolved(url, preview);
  res.json(preview);
});

export const downloadClip = asyncHandler(async (req, res) => {
  const parsed = urlSchema
    .extend({ formatId: z.string().trim().min(1, "Choose a download format") })
    .safeParse(req.body);

  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || "Invalid request", 400);
  }

  const { url } = detectPlatform(parsed.data.url);
  const formatId = sanitizeFormatId(parsed.data.formatId);
  const file = isTikTokFormat(formatId)
    ? await downloadTikTok(url, formatId)
    : await downloadMedia(url, formatId);

  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
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
  const clip = await Clip.create({
    userId: req.user._id,
    platform: parsed.data.platform || detected.platform,
    sourceUrl: detected.url,
    title: parsed.data.title || "",
    author: parsed.data.author || "",
    thumbnail: parsed.data.thumbnail || "",
    formatId: parsed.data.formatId || "",
    mediaType: parsed.data.mediaType || "video",
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

  res.json({ ok: true });
});
