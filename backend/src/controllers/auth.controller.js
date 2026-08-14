import crypto from "crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import env from "../config/env.js";
import User from "../models/User.js";
import Otp from "../models/Otp.js";
import { sendOtpEmail } from "../services/mail.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const emailSchema = z.string().trim().email("Enter a valid email");
const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(24, "Username must be at most 24 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers, and underscores only");

const requestSchema = z.object({
  email: emailSchema,
  username: usernameSchema.optional(),
});

const verifySchema = z.object({
  email: emailSchema,
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
  username: usernameSchema.optional(),
});

const otpAttempts = new Map();

function hashOtp(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function assertRateLimit(email) {
  const now = Date.now();
  const entry = otpAttempts.get(email) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + 15 * 60 * 1000;
  }
  if (entry.count >= 5) {
    throw new AppError("Too many codes requested. Try again in a few minutes.", 429);
  }
  entry.count += 1;
  otpAttempts.set(email, entry);
}

function setAuthCookie(res, userId) {
  const token = jwt.sign({ userId }, env.jwtSecret, { expiresIn: "30d" });
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

function publicUser(user) {
  return { id: user._id, email: user.email, username: user.username };
}

async function issueOtp(email, pendingUsername) {
  assertRateLimit(email);
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await Otp.deleteMany({ email });
  await Otp.create({
    email,
    codeHash: hashOtp(code),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    pendingUsername: pendingUsername || undefined,
  });
  await sendOtpEmail(email, code);
}

export const requestOtp = asyncHandler(async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || "Invalid request", 400);
  }

  const email = parsed.data.email.toLowerCase();
  const username = parsed.data.username?.toLowerCase();
  const existing = await User.findOne({ email });

  if (existing) {
    await issueOtp(email);
    return res.json({ exists: true, message: "Check your email for a sign-in code." });
  }

  if (!username) {
    return res.json({ needsUsername: true });
  }

  const taken = await User.findOne({ username });
  if (taken) {
    throw new AppError("That username is taken", 409);
  }

  await issueOtp(email, username);
  res.json({ exists: false, message: "Check your email for a sign-in code." });
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || "Invalid request", 400);
  }

  const email = parsed.data.email.toLowerCase();
  const record = await Otp.findOne({ email });
  if (!record || record.expiresAt < new Date()) {
    throw new AppError("That code is invalid or expired", 400);
  }

  if (record.codeHash !== hashOtp(parsed.data.code)) {
    throw new AppError("That code is invalid or expired", 400);
  }

  let user = await User.findOne({ email });
  if (!user) {
    const username = (parsed.data.username || record.pendingUsername || "").toLowerCase();
    if (!username) {
      throw new AppError("Choose a username to create your account", 400);
    }
    const taken = await User.findOne({ username });
    if (taken) {
      throw new AppError("That username is taken", 409);
    }
    user = await User.create({ email, username });
  }

  await Otp.deleteMany({ email });
  setAuthCookie(res, user._id);
  res.json({ user: publicUser(user) });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

export const logout = asyncHandler(async (_req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    path: "/",
  });
  res.json({ ok: true });
});
