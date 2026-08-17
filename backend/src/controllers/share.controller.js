import { z } from "zod";
import Clip from "../models/Clip.js";
import Share from "../models/Share.js";
import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function serializeSharedClip(share, clip, fromUser) {
  return {
    shareId: share._id,
    sharedAt: share.createdAt,
    sharedBy: {
      id: fromUser._id,
      username: fromUser.username,
    },
    clip: {
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
    },
  };
}

export const createShare = asyncHandler(async (req, res) => {
  const parsed = z
    .object({
      clipId: z.string().trim().min(1, "Choose a clip to share"),
      username: z.string().trim().min(3, "Enter a username"),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || "Invalid request", 400);
  }

  const username = parsed.data.username.replace(/^@/, "").toLowerCase();
  const clip = await Clip.findOne({
    _id: parsed.data.clipId,
    userId: req.user._id,
  });

  if (!clip) {
    throw new AppError("Clip not found", 404);
  }

  const recipient = await User.findOne({ username }).select("_id username");
  if (!recipient) {
    throw new AppError("User not found", 404);
  }

  if (String(recipient._id) === String(req.user._id)) {
    throw new AppError("You cannot share a clip with yourself", 400);
  }

  const existing = await Share.findOne({
    clipId: clip._id,
    toUserId: recipient._id,
  });

  if (existing) {
    throw new AppError(`Already shared with @${recipient.username}`, 409);
  }

  const share = await Share.create({
    clipId: clip._id,
    fromUserId: req.user._id,
    toUserId: recipient._id,
  });

  res.status(201).json({
    share: {
      id: share._id,
      username: recipient.username,
    },
  });
});

export const listReceivedShares = asyncHandler(async (req, res) => {
  const shares = await Share.find({ toUserId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate({ path: "clipId" })
    .populate({ path: "fromUserId", select: "username" })
    .lean();

  const items = shares
    .filter((share) => share.clipId)
    .map((share) =>
      serializeSharedClip(share, share.clipId, share.fromUserId)
    );

  res.json({ shares: items });
});

export const deleteShare = asyncHandler(async (req, res) => {
  const share = await Share.findById(req.params.id);
  if (!share) {
    throw new AppError("Share not found", 404);
  }

  const isRecipient = String(share.toUserId) === String(req.user._id);
  const isOwner = String(share.fromUserId) === String(req.user._id);
  if (!isRecipient && !isOwner) {
    throw new AppError("Share not found", 404);
  }

  await share.deleteOne();
  res.json({ ok: true });
});
