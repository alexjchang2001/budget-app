import { describe, it, expect } from "vitest";
import { getMostRecentFriday, getWeekEnd } from "@/lib/engine/week";
import {
  computeDistributable,
  distributeByPct,
  computeFloors,
  routeResidue,
} from "@/lib/engine/allocation";
import { checkDeficitTrigger } from "@/lib/engine/deficit";
import { getDaysRemainingInWeek } from "@/lib/engine/daily-limit";

// ---------------------------------------------------------------------------
// getMostRecentFriday
// ---------------------------------------------------------------------------
describe("getMostRecentFriday", () => {
  const cases: Array<[string, string]> = [
    ["2026-04-17", "2026-04-17"], // Friday → same day
    ["2026-04-18", "2026-04-17"], // Saturday → prior Friday
    ["2026-04-19", "2026-04-17"], // Sunday
    ["2026-04-20", "2026-04-17"], // Monday
    ["2026-04-21", "2026-04-17"], // Tuesday
    ["2026-04-22", "2026-04-17"], // Wednesday
    ["2026-04-23", "2026-04-17"], // Thursday
  ];
  it.each(cases)("given %s returns %s", (input, expected) => {
    const result = getMostRecentFriday(new Date(input));
    expect(result.toISOString().split("T")[0]).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// getWeekEnd
// ---------------------------------------------------------------------------
describe("getWeekEnd", () => {
  it("returns the Thursday 6 days after the Friday", () => {
    const friday = new Date("2026-04-17");
    const thursday = getWeekEnd(friday);
    expect(thursday.toISOString().split("T")[0]).toBe("2026-04-23");
  });
});

// ---------------------------------------------------------------------------
// getDaysRemainingInWeek
// ---------------------------------------------------------------------------
describe("getDaysRemainingInWeek", () => {
  const cases: Array<[string, number]> = [
    ["2026-04-17", 7], // Friday
    ["2026-04-18", 6], // Saturday
    ["2026-04-19", 5], // Sunday
    ["2026-04-20", 4], // Monday
    ["2026-04-21", 3], // Tuesday
    ["2026-04-22", 2], // Wednesday
    ["2026-04-23", 1], // Thursday
  ];
  it.each(cases)("given %s returns %d days remaining", (dateStr, expected) => {
    expect(getDaysRemainingInWeek(new Date(dateStr))).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// computeDistributable
// ---------------------------------------------------------------------------
describe("computeDistributable", () => {
  it("subtracts bill total from income", () => {
    expect(computeDistributable(50000, 20000)).toBe(30000);
  });

  it("floors at 0 when bills exceed income", () => {
    expect(computeDistributable(10000, 20000)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// distributeByPct
// ---------------------------------------------------------------------------
describe("distributeByPct", () => {
  const buckets = [
    { id: "debt", type: "debt", allocation_pct: 30, deficit_floor_pct: 5 },
    { id: "savings", type: "savings", allocation_pct: 20, deficit_floor_pct: 3 },
    { id: "food", type: "food", allocation_pct: 30, deficit_floor_pct: 10 },
    { id: "flex", type: "flex", allocation_pct: 20, deficit_floor_pct: null },
  ];

  it("distributes proportionally and floors to cent", () => {
    const { amounts } = distributeByPct(30000, buckets);
    expect(amounts.get("debt")).toBe(9000);
    expect(amounts.get("savings")).toBe(6000);
    expect(amounts.get("food")).toBe(9000);
    expect(amounts.get("flex")).toBe(6000);
  });

  it("residue is distributable minus sum of allocations", () => {
    const { amounts, residue } = distributeByPct(33333, buckets);
    const total = [...amounts.values()].reduce((a, b) => a + b, 0);
    expect(total + residue).toBe(33333);
    expect(residue).toBeGreaterThanOrEqual(0);
  });

  it("routes rounding residue: distributable=$333 with 3 equal 33% buckets", () => {
    const three = [
      { id: "a", type: "debt", allocation_pct: 33.33, deficit_floor_pct: 5 },
      { id: "savings", type: "savings", allocation_pct: 33.33, deficit_floor_pct: 3 },
      { id: "b", type: "food", allocation_pct: 33.33, deficit_floor_pct: 10 },
    ];
    const { residue } = distributeByPct(33300, three);
    expect(residue).toBeGreaterThanOrEqual(0);
    expect(residue).toBeLessThanOrEqual(6); // base 3.33¢ unallocated + 2.67¢ floor truncation
  });
});

// ---------------------------------------------------------------------------
// routeResidue
// ---------------------------------------------------------------------------
describe("routeResidue", () => {
  const buckets = [
    { id: "debt", type: "debt", allocation_pct: 30, deficit_floor_pct: 5 },
    { id: "savings", type: "savings", allocation_pct: 20, deficit_floor_pct: 3 },
    { id: "food", type: "food", allocation_pct: 30, deficit_floor_pct: 10 },
  ];

  it("adds residue to savings bucket", () => {
    const amounts = new Map([["debt", 9000], ["savings", 6000], ["food", 9000]]);
    const result = routeResidue(amounts, buckets, 1);
    expect(result.get("savings")).toBe(6001);
    expect(result.get("debt")).toBe(9000);
  });

  it("returns unchanged map when residue is 0", () => {
    const amounts = new Map([["savings", 6000]]);
    const result = routeResidue(amounts, buckets, 0);
    expect(result.get("savings")).toBe(6000);
  });
});

// ---------------------------------------------------------------------------
// computeFloors
// ---------------------------------------------------------------------------
describe("computeFloors", () => {
  it("computes floor as pct of income", () => {
    const buckets = [
      { id: "debt", type: "debt", allocation_pct: 30, deficit_floor_pct: 5 },
      { id: "savings", type: "savings", allocation_pct: 20, deficit_floor_pct: 3 },
      { id: "flex", type: "flex", allocation_pct: 20, deficit_floor_pct: null },
    ];
    const floors = computeFloors(100000, buckets);
    expect(floors.get("debt")).toBe(5000);
    expect(floors.get("savings")).toBe(3000);
    expect(floors.get("flex")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// checkDeficitTrigger
// ---------------------------------------------------------------------------
describe("checkDeficitTrigger", () => {
  const FOOD_MIN = 5000; // $50.00

  it("returns no deficit for healthy income", () => {
    // income=$500, distributable=$300 — neither condition fires
    const result = checkDeficitTrigger(50000, 30000, FOOD_MIN);
    expect(result.deficit).toBe(false);
    expect(result.condition).toBeNull();
  });

  it("fires Condition A: distributable < income * 8%", () => {
    // income=$100 ($10000 cents), bills=$93 → distributable=$7 → 7 < 800
    const result = checkDeficitTrigger(10000, 700, FOOD_MIN);
    expect(result.deficit).toBe(true);
    expect(result.condition).toBe("A");
  });

  it("fires Condition B: after floors, remaining < food_min", () => {
    // income=$1000 ($100000), distributable=$100 ($10000¢) — passes Condition A (10% > 8%)
    // after floors: 10000 - 5000 - 3000 = 2000 < 5000 → Condition B
    const result = checkDeficitTrigger(100000, 10000, FOOD_MIN);
    expect(result.deficit).toBe(true);
    expect(result.condition).toBe("B");
  });

  it("Condition A takes priority over B", () => {
    // distributable is < 8% of income AND would also fail B
    const result = checkDeficitTrigger(10000, 200, FOOD_MIN);
    expect(result.condition).toBe("A");
  });
});
