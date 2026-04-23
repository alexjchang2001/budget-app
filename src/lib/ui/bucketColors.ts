export type ColorLevel = "green" | "amber" | "red";

/**
 * Screen 2 color logic (Buckets).
 * GREEN <60% spent, AMBER 60–89%, RED ≥90%.
 */
export function getBucketColor(spent: number, allocated: number): ColorLevel {
  if (allocated <= 0) return "green";
  const ratio = spent / allocated;
  if (ratio < 0.6) return "green";
  if (ratio < 0.9) return "amber";
  return "red";
}
