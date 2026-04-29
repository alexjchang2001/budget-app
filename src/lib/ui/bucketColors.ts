export type BucketColorLevel = "green" | "amber" | "red";

// Screen 2 color axis: spent/allocated ratio. Independent from homeColors.ts.
export function getBucketColor(spent: number, allocated: number): BucketColorLevel {
  if (allocated <= 0) return "green";
  const ratio = spent / allocated;
  if (ratio < 0.6) return "green";
  if (ratio < 0.9) return "amber";
  return "red";
}
