import axios from "axios";
import { createReadStream } from "fs";
import env from "../config/env.js";
import { AppError } from "../utils/AppError.js";

export const CDN_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export function refererForPlatform(platform) {
  if (platform === "instagram") return "https://www.instagram.com/";
  if (platform === "facebook") return "https://www.facebook.com/";
  if (platform === "tiktok") return "https://www.tiktok.com/";
  if (platform === "twitter") return "https://x.com/";
  if (platform === "pinterest") return "https://www.pinterest.com/";
  return "https://www.youtube.com/";
}

export function originForReferer(referer) {
  try {
    return new URL(referer).origin;
  } catch {
    return "";
  }
}

export function requestRange(req) {
  const value = req?.headers?.range;
  return typeof value === "string" && /^bytes=/i.test(value) ? value : "";
}

export function parseBytesRange(rangeHeader, size) {
  if (!rangeHeader || !size) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(String(rangeHeader).trim());
  if (!match) return null;

  let start = match[1] === "" ? null : Number(match[1]);
  let end = match[2] === "" ? null : Number(match[2]);
  if (start == null && end == null) return null;
  if (!Number.isFinite(start) && start != null) return null;
  if (!Number.isFinite(end) && end != null) return null;

  if (start == null) {
    start = Math.max(size - end, 0);
    end = size - 1;
  } else {
    if (end == null || end >= size) end = size - 1;
    if (start > end || start >= size) return null;
  }

  return { start, end, total: size };
}

export function applyFileRange(file, filePath, rangeHeader) {
  const parsed = parseBytesRange(rangeHeader, file.size);
  if (!parsed) {
    return {
      ...file,
      acceptRanges: "bytes",
      statusCode: 200,
    };
  }

  file.stream?.destroy?.();
  const stream = createReadStream(filePath, { start: parsed.start, end: parsed.end });
  return {
    ...file,
    stream,
    size: parsed.end - parsed.start + 1,
    contentRange: `bytes ${parsed.start}-${parsed.end}/${parsed.total}`,
    acceptRanges: "bytes",
    statusCode: 206,
  };
}

export async function proxyCdnUrl(mediaUrl, options = {}) {
  const { referer, cookies, range, filename, contentType, sendOrigin = false } = options;
  const headers = {
    "User-Agent": CDN_USER_AGENT,
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
  };

  if (referer) {
    headers.Referer = referer;
    if (sendOrigin) {
      const origin = originForReferer(referer);
      if (origin) headers.Origin = origin;
    }
  }
  if (cookies) headers.Cookie = cookies;
  if (range) headers.Range = range;

  try {
    const parsed = new URL(mediaUrl);
    const host = parsed.hostname.toLowerCase();
    if (host.includes("rapidapi.com") || host.includes("rapidapi.io")) {
      if (env.rapidApi.key) {
        headers["x-rapidapi-key"] = env.rapidApi.key;
        headers["x-rapidapi-host"] = host;
      }
    }
  } catch {
    // ignore invalid URLs; axios will fail below
  }

  try {
    const response = await axios.get(mediaUrl, {
      responseType: "stream",
      maxRedirects: 5,
      timeout: 180_000,
      headers,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    const type = response.headers["content-type"] || contentType || "application/octet-stream";
    const size = Number(response.headers["content-length"]) || 0;

    return {
      stream: response.data,
      filename,
      contentType: type,
      size,
      contentRange: response.headers["content-range"] || "",
      acceptRanges: response.headers["accept-ranges"] || "bytes",
      statusCode: response.status === 206 ? 206 : 200,
      cleanup: () => {
        response.data.destroy?.();
      },
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    const status = err?.response?.status;
    throw new AppError(
      "Could not download this file. Try another quality.",
      status === 403 ? 403 : 502
    );
  }
}
