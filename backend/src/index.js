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
import shareRoutes from "./routes/share.routes.js";

const app = express();
app.set("trust proxy", 1);

app.use(
  cors({
    origin: ["https://questsave.orzn.app","http://localhost:3001"],
    credentials: true,
    exposedHeaders: ["Content-Disposition", "Content-Range", "Accept-Ranges", "Content-Length"],
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/clips", clipRoutes);
app.use("/api/shares", shareRoutes);
app.use("/api/media", mediaRoutes);

app.use((_req, _res, next) => {
  next(new AppError("Not found", 404));
});

app.use(errorHandler);

connectDb()
  .then(async () => {
    try {
      const { spawnSync } = await import("child_process");
      const check = spawnSync(env.ytdlp.path, ["--version"], {
        encoding: "utf8",
      });
      if (check.error?.code === "ENOENT") {
        console.warn(
          `[warn] yt-dlp not found at "${env.ytdlp.path}". It is only used as a last-resort fallback now.`,
        );
      } else if (check.status === 0) {
        console.log(`yt-dlp ${String(check.stdout || check.stderr).trim()}`);
      }
    } catch {
      // ignore probe failures
    }

    if (!env.streamSaver.baseUrl) {
      console.warn("[warn] STREAMSAVER_API_BASE is not set. Non-TikTok downloads will fail.");
    }

    app.listen(env.port, () => {
      console.log(`QuestSave API running on : http://localhost:${env.port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server", err);
    process.exit(1);
  });
