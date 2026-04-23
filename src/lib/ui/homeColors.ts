export type ColorLevel = "green" | "amber" | "red";

/**
 * Screen 1 color logic (Home/daily limit).
 * GREEN ≥30% of opening daily limit, AMBER 10–29%, RED <10%.
 */
export function getHomeColor(current: number, opening: number): ColorLevel {
  if (opening <= 0) return "green";
  const ratio = current / opening;
  if (ratio >= 0.3) return "green";
  if (ratio >= 0.1) return "amber";
  return "red";
}
