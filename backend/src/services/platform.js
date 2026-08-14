import { AppError } from "../utils/AppError.js";

const PLATFORM_HOSTS = {
  youtube: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"],
  tiktok: ["tiktok.com", "www.tiktok.com", "vm.tiktok.com", "vt.tiktok.com", "m.tiktok.com"],
  instagram: ["instagram.com", "www.instagram.com", "instagr.am"],
  twitter: ["twitter.com", "www.twitter.com", "x.com", "www.x.com", "mobile.twitter.com"],
  facebook: [
    "facebook.com",
    "www.facebook.com",
    "m.facebook.com",
    "web.facebook.com",
    "fb.watch",
    "www.fb.watch",
    "fb.com",
    "www.fb.com",
  ],
  pinterest: [
    "pinterest.com",
    "www.pinterest.com",
    "pin.it",
    "www.pin.it",
    "pinterest.co.uk",
    "pinterest.ca",
  ],
};

export function detectPlatform(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new AppError("Enter a valid URL", 400);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new AppError("Only http and https URLs are supported", 400);
  }

  const host = parsed.hostname.toLowerCase();

  for (const [platform, hosts] of Object.entries(PLATFORM_HOSTS)) {
    if (hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
      return { platform, url: parsed.toString() };
    }
  }

  throw new AppError(
    "This platform is not supported yet. Try TikTok, Instagram, X, YouTube, Facebook, or Pinterest.",
    400
  );
}

export function sanitizeFormatId(formatId) {
  if (!formatId || typeof formatId !== "string") {
    throw new AppError("Choose a download format", 400);
  }
  if (!/^[a-zA-Z0-9._+\-*/[\]():]+$/.test(formatId) || formatId.length > 80) {
    throw new AppError("Invalid format", 400);
  }
  return formatId;
}
