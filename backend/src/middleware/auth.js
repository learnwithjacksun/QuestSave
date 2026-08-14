import jwt from "jsonwebtoken";
import env from "../config/env.js";
import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    throw new AppError("Sign in to continue", 401);
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.userId).select("email username");
    if (!user) {
      throw new AppError("Sign in to continue", 401);
    }
    req.user = user;
    next();
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("Sign in to continue", 401);
  }
});

export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.token;
  if (!token) return next();

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.userId).select("email username");
    req.user = user || null;
  } catch {
    req.user = null;
  }
  next();
});
