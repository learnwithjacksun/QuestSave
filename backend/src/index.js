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
    origin: env.clientOrigin,
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
  .then(() => {
    app.listen(env.port, () => {
      console.log(`QuestSave API running on : http://localhost:${env.port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server", err);
    process.exit(1);
  });
