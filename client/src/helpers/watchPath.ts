export function fypWatchPath(
  clipId: string,
  from: "library" | "fyp" | "home" | "shared" = "fyp"
) {
  const params = new URLSearchParams({ watch: clipId, from });
  return `/fyp?${params.toString()}`;
}