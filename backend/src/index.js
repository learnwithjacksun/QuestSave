import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import env from "./config/env.js";
import { connectDb } from "./config/db.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { AppError } from "./utils/AppError.js";
import authRoutes from "./routes/auth.routes.js";
import clipRoutes from "./routes/clip.routes.js";
import mediaRoutes from "./routes/media.routes.js";

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
    exposedHeaders: ["Content-Disposition"],
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/clips", clipRoutes);
app.use("/api/media", mediaRoutes);

app.use((_req, _res, next) => {
  next(new AppError("Not found", 404));
});

app.use(errorHandler);

connectDb()
  .then(async () => {
    try {
      const { spawnSync } = await import("child_process");
      const check = spawnSync(env.ytdlp.path, ["--version"], { encoding: "utf8" });
      if (check.error?.code === "ENOENT") {
        console.warn(
          `[warn] yt-dlp not found at "${env.ytdlp.path}". YouTube/Instagram/Facebook/X/Pinterest resolve will fail until it is installed (TikTok can still work via the dedicated scraper).`
        );
      } else if (check.status === 0) {
        console.log(`yt-dlp ${String(check.stdout || check.stderr).trim()}`);
      }
    } catch {
      // ignore probe failures
    }

    app.listen(env.port, () => {
      console.log(`QuestSave API running on : http://localhost:${env.port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server", err);
    process.exit(1);
  });
