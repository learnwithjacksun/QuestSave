const TTL_MS = 5 * 60 * 1000;

/** @type {Map<string, { expires: number, preview: object }>} */
const cache = new Map();

function key(url) {
  return String(url).split("?")[0];
}

export function getResolved(url) {
  const entry = cache.get(key(url));
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key(url));
    return null;
  }
  return entry.preview;
}

export function setResolved(url, preview) {
  cache.set(key(url), { expires: Date.now() + TTL_MS, preview });
}
