export type FypFrom = "library" | "fyp" | "home" | "shared" | "youtube" | "discover" | "youtube-search";

export function fypWatchPath(clipId: string, from: FypFrom = "fyp") {
  const params = new URLSearchParams({ watch: clipId, from });
  return `/fyp?${params.toString()}`;
}

export function fypBackPath(from: string, youtubeQuery = "") {
  if (from === "library") return "/library";
  if (from === "shared") return "/library?tab=shared";
  if (from === "home") return "/";
  if (from === "discover") return "/fyp";
  if (from === "fyp") return "/fyp?tab=library";
  if (from === "youtube-search") {
    return youtubeQuery
      ? `/youtube-search?q=${encodeURIComponent(youtubeQuery)}`
      : "/youtube-search";
  }
  return "/fyp";
}
