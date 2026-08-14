const TTL_MS = 5 * 60 * 1000;

/** @type {Map<string, { expires: number, preview: object }>} */
const cache = new Map();

/** Cache key that keeps YouTube video IDs and X status IDs distinct. */
export function cacheKeyFor(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      if (id) return `youtube:${id}`;
    }

    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      const watchId = parsed.searchParams.get("v");
      if (watchId) return `youtube:${watchId}`;
      for (const kind of ["shorts", "embed", "live"]) {
        const match = parsed.pathname.match(new RegExp(`/${kind}/([^/?#]+)`));
        if (match?.[1]) return `youtube:${match[1]}`;
      }
    }

    if (host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com")) {
      const match = parsed.pathname.match(/\/status\/(\d+)/);
      if (match?.[1]) return `twitter:${match[1]}`;
    }

    parsed.hash = "";
    return parsed.toString();
  } catch {
    return String(url);
  }
}

export function getResolved(url) {
  const entry = cache.get(cacheKeyFor(url));
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(cacheKeyFor(url));
    return null;
  }
  return entry.preview;
}

export function setResolved(url, preview) {
  cache.set(cacheKeyFor(url), { expires: Date.now() + TTL_MS, preview });
}
