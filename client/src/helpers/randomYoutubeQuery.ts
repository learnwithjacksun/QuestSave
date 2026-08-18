const SEED_QUERIES = [
  "lofi hip hop",
  "nature 4k",
  "street food",
  "soccer highlights",
  "guitar cover",
  "travel vlog",
  "ocean waves",
  "coding tutorial",
  "jazz piano",
  "wildlife documentary",
  "city night drive",
  "workout mix",
];

export function randomYoutubeQuery() {
  return SEED_QUERIES[Math.floor(Math.random() * SEED_QUERIES.length)];
}
