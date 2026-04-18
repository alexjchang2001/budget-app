/**
 * Convert dollars (float) to integer cents.
 * All monetary values in this app are stored as cents.
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Convert integer cents to dollars (float).
 */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/**
 * Format cents as a USD currency string (e.g. "$12.34").
 */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(centsToDollars(cents));
}
