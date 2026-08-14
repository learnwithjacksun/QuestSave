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
    /** Netscape cookies file for YouTube / X bot checks (optional). */
    cookies: process.env.YTDLP_COOKIES || "",
    /** e.g. chrome, chromium, firefox — only works when the browser profile exists on the server. */
    cookiesFromBrowser: process.env.YTDLP_COOKIES_FROM_BROWSER || "",
    /** curl_cffi target such as chrome; leave empty to skip impersonation. */
    impersonate: process.env.YTDLP_IMPERSONATE || "",
  },
};

export default env;
