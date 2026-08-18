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
  /(^|\.)rapidcdn\.app$/i,
  /(^|\.)ymcdn\.org$/i,
  /(^|\.)threads\.net$/i,
  /(^|\.)threads\.com$/i,
  /(^|\.)sndcdn\.com$/i,
  /(^|\.)soundcloud\.com$/i,
  /(^|\.)douyin\.com$/i,
  /(^|\.)iesdouyin\.com$/i,
  /(^|\.)xiaohongshu\.com$/i,
  /(^|\.)xhscdn\.com$/i,
  /(^|\.)xhslink\.com$/i,
  /(^|\.)rednote\.com$/i,
  /(^|\.)snackvideo\.com$/i,
  /(^|\.)icocofun\.com$/i,
  /(^|\.)cocofun\.com$/i,
  /(^|\.)kuaishou\.com$/i,
  /(^|\.)gifshow\.com$/i,
  /(^|\.)kwimgs\.com$/i,
  /(^|\.)capcut\.com$/i,
  /(^|\.)capcutcdn\.com$/i,
  /(^|\.)mediafire\.com$/i,
  /(^|\.)spotify\.com$/i,
  /(^|\.)scdn\.co$/i,
  /(^|\.)spotifycdn\.com$/i,
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
  if (host.includes("threads")) return "https://www.threads.net/";
  if (host.includes("sndcdn") || host.includes("soundcloud")) return "https://soundcloud.com/";
  if (host.includes("douyin") || host.includes("iesdouyin")) return "https://www.douyin.com/";
  if (host.includes("xiaohongshu") || host.includes("xhscdn") || host.includes("xhslink") || host.includes("rednote")) {
    return "https://www.xiaohongshu.com/";
  }
  if (host.includes("snackvideo")) return "https://www.snackvideo.com/";
  if (host.includes("cocofun")) return "https://www.icocofun.com/";
  if (host.includes("kuaishou") || host.includes("gifshow") || host.includes("kwimgs")) {
    return "https://www.kuaishou.com/";
  }
  if (host.includes("capcut")) return "https://www.capcut.com/";
  if (host.includes("mediafire")) return "https://www.mediafire.com/";
  if (host.includes("spotify") || host.includes("scdn")) return "https://open.spotify.com/";
  if (host.includes("rapidcdn") || host.includes("ymcdn")) return "https://streamsaver.orzn.app/";
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
