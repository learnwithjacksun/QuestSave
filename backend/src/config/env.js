const required = ["MONGODB_URI", "JWT_SECRET", "CLIENT_ORIGIN"];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

const env = {
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  clientOrigin: process.env.CLIENT_ORIGIN,
  nodeEnv: process.env.NODE_ENV || "development",
  brevo: {
    apiKey: process.env.BREVO_API_KEY,
    fromName: process.env.MAIL_FROM_NAME || "QuestSave",
    fromEmail: process.env.MAIL_FROM_EMAIL || "noreply@questlabs.cc",
  },
  ytdlp: {
    path: process.env.YTDLP_PATH || "yt-dlp",
    timeoutMs: Number(process.env.YTDLP_TIMEOUT_MS) || 60_000,
    /** Netscape cookies file for Pinterest / X / TikTok last-resort fallbacks (optional). */
    cookies: process.env.YTDLP_COOKIES || "",
    /** e.g. chrome, chromium, firefox — only works when the browser profile exists on the server. */
    cookiesFromBrowser: process.env.YTDLP_COOKIES_FROM_BROWSER || "",
    /** curl_cffi target such as chrome; leave empty to skip impersonation. */
    impersonate: process.env.YTDLP_IMPERSONATE || "",
  },
  rapidApi: {
    key: process.env.RAPIDAPI_KEY || "",
    timeoutMs: Number(process.env.RAPIDAPI_TIMEOUT_MS) || 90_000,
    youtubeHost:
      process.env.RAPIDAPI_YOUTUBE_HOST || "ytstream-download-youtube-videos.p.rapidapi.com",
    instagramHost:
      process.env.RAPIDAPI_INSTAGRAM_HOST ||
      "instagram-post-reels-stories-downloader-api.p.rapidapi.com",
    facebookHost:
      process.env.RAPIDAPI_FACEBOOK_HOST ||
      "new-facebook-downloader-reels-watch-share-links.p.rapidapi.com",
    /** Optional ISO 3166 country for YTStream (`cgeo`). */
    youtubeCgeo: process.env.RAPIDAPI_YOUTUBE_CGEO || "",
  },
  ffmpeg: {
    path: process.env.FFMPEG_PATH || "ffmpeg",
    timeoutMs: Number(process.env.FFMPEG_TIMEOUT_MS) || 180_000,
  },
};

export default env;
