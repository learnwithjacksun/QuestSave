import env from "../config/env.js";
import { AppError } from "../utils/AppError.js";

export function errorHandler(err, _req, res, _next) {
  const status = err instanceof AppError ? err.statusCode : err.statusCode || 500;
  // Always surface AppError messages (including missing yt-dlp / cookie guidance).
  const message =
    err instanceof AppError
      ? err.message
      : status >= 500 && env.nodeEnv === "production"
        ? "Something went wrong"
        : err.message || "Something went wrong";

  if (env.nodeEnv !== "production") {
    console.error(err);
  } else if (!(err instanceof AppError) || status >= 500) {
    console.error(err);
  }

  res.status(status).json({ message });
}
