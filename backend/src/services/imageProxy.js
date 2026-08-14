import axios from "axios";
import { AppError } from "../utils/AppError.js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const HOST_ALLOW = [
  /(^|\.)tiktok\.com$/i,
  /tiktokcdn/i,
  /musical\.ly$/i,
  /(^|\.)instagram\.com$/i,
  /cdninstagram/i,
  /(^|\.)facebook\.com$/i,
  /fbcdn/i,
  /scontent/i,
  /(^|\.)fb\.watch$/i,
  /(^|\.)pinterest\./i,
  /pinimg/i,
  /(^|\.)twimg\.com$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)x\.com$/i,
  /(^|\.)ytimg\.com$/i,
  /(^|\.)ggpht\.com$/i,
  /(^|\.)googleusercontent\.com$/i,
  /(^|\.)tikwm\.com$/i,
  /(^|\.)youtube\.com$/i,
];

function hostAllowed(hostname) {
  const host = hostname.toLowerCase();
  return HOST_ALLOW.some((re) => re.test(host));
}

function refererForHost(hostname) {
  const host = hostname.toLowerCase();
  if (host.includes("tiktok") || host.includes("musical")) return "https://www.tiktok.com/";
  if (host.includes("instagram") || host.includes("cdninstagram")) return "https://www.instagram.com/";
  if (host.includes("facebook") || host.includes("fbcdn") || host.includes("scontent") || host.includes("fb.")) {
    return "https://www.facebook.com/";
  }
  if (host.includes("pinimg") || host.includes("pinterest")) return "https://www.pinterest.com/";
  if (host.includes("twimg") || host.includes("twitter") || host === "x.com" || host.endsWith(".x.com")) {
    return "https://x.com/";
  }
  if (host.includes("ytimg") || host.includes("ggpht") || host.includes("youtube")) {
    return "https://www.youtube.com/";
  }
  if (host.includes("tikwm")) return "https://www.tikwm.com/";
  return "https://www.google.com/";
}

export async function fetchProxiedImage(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new AppError("Invalid image URL", 400);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new AppError("Invalid image URL", 400);
  }

  if (!hostAllowed(parsed.hostname)) {
    throw new AppError("Image host is not allowed", 400);
  }

  try {
    const response = await axios.get(parsed.toString(), {
      responseType: "stream",
      timeout: 30_000,
      maxRedirects: 5,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: refererForHost(parsed.hostname),
      },
      validateStatus: (status) => status >= 200 && status < 400,
    });

    return {
      stream: response.data,
      contentType: response.headers["content-type"] || "image/jpeg",
      size: Number(response.headers["content-length"]) || 0,
    };
  } catch {
    throw new AppError("Could not load image", 502);
  }
}
