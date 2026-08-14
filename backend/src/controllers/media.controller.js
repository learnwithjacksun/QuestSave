import { z } from "zod";
import { fetchProxiedImage } from "../services/imageProxy.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const proxyImage = asyncHandler(async (req, res) => {
  const parsed = z
    .object({ url: z.string().trim().min(1) })
    .safeParse({ url: req.query.url });

  if (!parsed.success) {
    throw new AppError("Missing image url", 400);
  }

  const file = await fetchProxiedImage(parsed.data.url);

  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Cache-Control", "private, max-age=3600");
  if (file.size) {
    res.setHeader("Content-Length", file.size);
  }

  file.stream.on("error", () => {
    if (!res.headersSent) {
      res.status(502).end();
    } else {
      res.end();
    }
  });
  file.stream.pipe(res);
});
