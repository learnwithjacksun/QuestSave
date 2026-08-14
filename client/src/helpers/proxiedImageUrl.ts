const API_URL = (import.meta.env.VITE_BASE_URL || "").replace(/\/$/, "");

/** Rewrite CDN thumbnails through our allowlisted image proxy so browsers can display them. */
export function proxiedImageUrl(raw?: string | null) {
  if (!raw) return "";
  if (raw.startsWith("data:") || raw.startsWith("blob:")) return raw;
  if (!API_URL) return raw;
  if (raw.includes("/api/media/image")) return raw;
  return `${API_URL}/api/media/image?url=${encodeURIComponent(raw)}`;
}
