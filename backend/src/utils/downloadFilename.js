const UNSAFE = /[<>:"/\\|?*\x00-\x1f]/g;

export function sanitizeTitle(title) {
  if (!title || typeof title !== "string") return "";
  return title
    .trim()
    .replace(UNSAFE, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function randomToken(length = 4) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function buildDownloadFilename({ platform, title, ext }) {
  const safePlatform = String(platform || "clip")
    .toLowerCase()
    .replace(UNSAFE, "")
    .replace(/\s+/g, "_") || "clip";

  const sanitized = sanitizeTitle(title);
  const slug =
    sanitized.length >= 1 && sanitized.length <= 10 ? sanitized : randomToken(4);

  const safeExt = String(ext || "mp4")
    .toLowerCase()
    .replace(/^\./, "")
    .replace(UNSAFE, "") || "mp4";

  return `questsave_${safePlatform}_${slug}.${safeExt}`;
}
