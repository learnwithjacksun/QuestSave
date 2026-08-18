export function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** YouTube search text that Stream Saver accepts as platform `yts`. */
export function isSearchQuery(value: string) {
  const trimmed = value.trim();
  if (!trimmed || isValidHttpUrl(trimmed) || trimmed.includes("://")) return false;
  if (trimmed.length < 2 || trimmed.length > 200) return false;
  return !/^[\w-]+(\.[\w-]+)+([/:?#].*)?$/i.test(trimmed);
}

export function isResolvableInput(value: string) {
  return isValidHttpUrl(value) || isSearchQuery(value);
}
