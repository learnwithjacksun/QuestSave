export function formatCount(value: number | null | undefined) {
  if (value == null) return null;
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
