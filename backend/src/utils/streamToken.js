import jwt from "jsonwebtoken";
import env from "../config/env.js";
import { AppError } from "./AppError.js";

export function signStreamToken({ clipId, userId }) {
  return jwt.sign(
    { clipId: String(clipId), userId: String(userId), type: "stream" },
    env.jwtSecret,
    { expiresIn: "2h" }
  );
}

export function verifyStreamToken(token) {
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (payload.type !== "stream" || !payload.clipId || !payload.userId) {
      throw new AppError("Invalid stream link", 401);
    }
    return payload;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("Stream link expired. Open the clip again.", 401);
  }
}
