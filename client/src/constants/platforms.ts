export const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  youtube: "YouTube",
  yts: "YouTube search",
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "X (Twitter)",
  pinterest: "Pinterest",
  threads: "Threads",
  soundcloud: "SoundCloud",
  spotify: "Spotify",
  douyin: "Douyin",
  xiaohongshu: "Xiaohongshu",
  "xiaohongshu-profile": "Xiaohongshu profile",
  snackvideo: "SnackVideo",
  cocofun: "Cocofun",
  kuaishou: "Kuaishou",
  capcut: "CapCut",
  gdrive: "Google Drive",
  mediafire: "MediaFire",
};

export const PLATFORM_FILTERS = [
  { value: "all", label: "All platforms" },
  ...Object.entries(PLATFORM_LABELS).map(([value, label]) => ({ value, label })),
];
