import { AppError } from "../utils/AppError.js";

const PLATFORM_HOSTS = {
  youtube: [
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
    "www.youtu.be",
  ],
  tiktok: ["tiktok.com", "www.tiktok.com", "vm.tiktok.com", "vt.tiktok.com", "m.tiktok.com"],
  instagram: ["instagram.com", "www.instagram.com", "instagr.am"],
  twitter: ["twitter.com", "www.twitter.com", "x.com", "www.x.com", "mobile.twitter.com", "mobile.x.com"],
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
  threads: ["threads.net", "www.threads.net", "threads.com", "www.threads.com"],
  soundcloud: [
    "soundcloud.com",
    "www.soundcloud.com",
    "m.soundcloud.com",
    "on.soundcloud.com",
    "snd.sc",
  ],
  douyin: ["douyin.com", "www.douyin.com", "v.douyin.com", "m.douyin.com", "iesdouyin.com", "www.iesdouyin.com"],
  xiaohongshu: [
    "xiaohongshu.com",
    "www.xiaohongshu.com",
    "xhslink.com",
    "www.xhslink.com",
    "rednote.com",
    "www.rednote.com",
  ],
  snackvideo: ["snackvideo.com", "www.snackvideo.com", "s.snackvideo.com"],
  cocofun: ["icocofun.com", "www.icocofun.com", "cocofun.com", "www.cocofun.com"],
  kuaishou: [
    "kuaishou.com",
    "www.kuaishou.com",
    "v.kuaishou.com",
    "live.kuaishou.com",
    "gifshow.com",
    "www.gifshow.com",
    "m.gifshow.com",
  ],
  capcut: ["capcut.com", "www.capcut.com", "m.capcut.com", "capcut.net", "www.capcut.net"],
  gdrive: ["drive.google.com", "docs.google.com"],
  mediafire: ["mediafire.com", "www.mediafire.com"],
  spotify: ["spotify.com", "open.spotify.com", "spotify.link", "spotify.app.link"],
};

function looksLikeBareHost(value) {
  return /^[\w-]+(\.[\w-]+)+([/:?#].*)?$/i.test(value);
}

function parseInput(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) {
    throw new AppError("Paste a link first", 400);
  }

  try {
    return { kind: "url", parsed: new URL(trimmed), value: trimmed };
  } catch {
    // ignore
  }

  if (looksLikeBareHost(trimmed)) {
    try {
      return { kind: "url", parsed: new URL(`https://${trimmed}`), value: `https://${trimmed}` };
    } catch {
      // ignore
    }
  }

  throw new AppError("Enter a valid URL", 400);
}

function matchHost(host) {
  for (const [platform, hosts] of Object.entries(PLATFORM_HOSTS)) {
    if (hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
      return platform;
    }
  }
  return "";
}

export function detectPlatform(rawUrl) {
  const input = parseInput(rawUrl);
  const parsed = input.parsed;
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new AppError("Only http and https URLs are supported", 400);
  }

  const host = parsed.hostname.toLowerCase();
  let platform = matchHost(host);

  if (platform === "xiaohongshu" && /\/user\/profile\//i.test(parsed.pathname)) {
    platform = "xiaohongshu-profile";
  }

  if (!platform) {
    throw new AppError("This link isn't from a supported platform.", 400);
  }

  return { platform, url: parsed.toString() };
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
