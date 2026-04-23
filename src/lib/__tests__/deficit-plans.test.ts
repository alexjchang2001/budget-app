import { describe, it, expect } from "vitest";
import {
  checkInsolvent,
  computeEmergency,
  computeOptimal,
  computeLongTermResponsible,
} from "@/lib/engine/deficit";

// Shared bucket fixture: pcts sum to 100 (non-bill).
const BUCKETS = [
  { id: "debt", type: "debt", allocation_pct: 30, deficit_floor_pct: 5 },
  { id: "savings", type: "savings", allocation_pct: 20, deficit_floor_pct: 3 },
  { id: "food", type: "food", allocation_pct: 30, deficit_floor_pct: null },
  { id: "flex", type: "flex", allocation_pct: 20, deficit_floor_pct: null },
];
const FOOD_MIN = 5000; // $50.00

// ---------------------------------------------------------------------------
// checkInsolvent
// ---------------------------------------------------------------------------
describe("checkInsolvent", () => {
  it("income=$200, bills=$195 → insolvent", () => {
    // debtFloor=1000 (5%), savingsFloor=600 (3%), foodMin=5000
    expect(checkInsolvent(20000, 19500, 1000, 600, 5000)).toBe(true);
  });

  it("healthy income → not insolvent", () => {
    // income=$1000, bills=$400, floors=$50+$30=$80, foodMin=$50 → $580 required < $1000
    expect(checkInsolvent(100000, 40000, 5000, 3000, 5000)).toBe(false);
  });

  it("exactly at boundary → not insolvent (strict less-than)", () => {
    // income = billTotal + debtFloor + savingsFloor + foodMin exactly
    const income = 50000;
    const billTotal = 40000; // distributable=$10000
    const debtFloor = Math.floor(income * 0.05); // 2500
    const savingsFloor = Math.floor(income * 0.03); // 1500
    const foodMin = 6000;
    // income = 50000, rhs = 40000+2500+1500+6000 = 50000 → NOT insolvent (strict <)
    expect(checkInsolvent(income, billTotal, debtFloor, savingsFloor, foodMin)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeEmergency
// ---------------------------------------------------------------------------
describe("computeEmergency", () => {
  it("income=$500 bills=$400: debt=5%, savings=3%, food=remainder, flex=$0", () => {
    const p = computeEmergency(50000, 40000);
    expect(p.billsAmount).toBe(40000);
    expect(p.debtAmount).toBe(2500);   // 50000 * 0.05
    expect(p.savingsAmount).toBe(1500); // 50000 * 0.03
    expect(p.flexAmount).toBe(0);
    // food = distributable - debt - savings = 10000 - 2500 - 1500 = 6000
    expect(p.foodAmount).toBe(6000);
  });

  it("sum equals income", () => {
    const p = computeEmergency(50000, 40000);
    const sum = p.billsAmount + p.debtAmount + p.savingsAmount + p.foodAmount + p.flexAmount;
    expect(sum).toBe(50000);
  });

  it("food is at least $50 (5000 cents)", () => {
    // Very tight: income=$200, bills=$185 → distributable=$15
    // debt=$10(5%), savings=$6(3%), food=max($50, $15-$10-$6)=$50
    const p = computeEmergency(20000, 18500);
    expect(p.foodAmount).toBeGreaterThanOrEqual(5000);
  });

  it("flex is always $0", () => {
    const p = computeEmergency(80000, 30000);
    expect(p.flexAmount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeOptimal
// ---------------------------------------------------------------------------
describe("computeOptimal", () => {
  it("income=$500 bills=$400: flex cut first, debt+savings at user targets", () => {
    // distributable=$10000; debt 30%=$3000, savings 20%=$2000 → fit easily
    const p = computeOptimal(50000, 40000, BUCKETS);
    expect(p.billsAmount).toBe(40000);
    expect(p.debtAmount).toBe(3000);   // 30% of $10000
    expect(p.savingsAmount).toBe(2000); // 20% of $10000
    expect(p.flexAmount).toBe(0);
    expect(p.foodAmount).toBe(5000);   // remainder = $10000-$3000-$2000
  });

  it("sum equals income", () => {
    const p = computeOptimal(50000, 40000, BUCKETS);
    const sum = p.billsAmount + p.debtAmount + p.savingsAmount + p.foodAmount + p.flexAmount;
    expect(sum).toBe(50000);
  });

  it("falls back to floors when full alloc exceeds distributable", () => {
    // Tiny distributable: income=$100, bills=$98 → distributable=$2
    // debtFull=30%*200=$60, savingsFull=20%*200=$40 → $60+$40=$100 > $200 (no, wait)
    // Let me redo: income=$10000, bills=$9800 → distributable=$200
    // debtFull=30%*200=60, savingsFull=20%*200=40 → $100 vs $200 → canAffordFull=true
    // floors not needed. Let's use extreme case:
    // income=$10000, bills=$9970 → distributable=$30
    // debtFull=9, savingsFull=6 → 15 < 30 → canAffordFull still true
    // OK the condition is debtFull+savingsFull <= distributable, which is always true
    // when pcts sum ≤ 50%. Let me create a case where it fails:
    // buckets where debt 60%, savings 40% → sum 100%
    const heavyBuckets = [
      { id: "debt", type: "debt", allocation_pct: 60, deficit_floor_pct: 5 },
      { id: "savings", type: "savings", allocation_pct: 40, deficit_floor_pct: 3 },
      { id: "food", type: "food", allocation_pct: 0, deficit_floor_pct: null },
      { id: "flex", type: "flex", allocation_pct: 0, deficit_floor_pct: null },
    ];
    // income=$10000, bills=$9500 → distributable=$500
    // debtFull=300, savingsFull=200 → sum=500 = distributable → canAffordFull=true (≤)
    // Let's go higher: debt 70%, savings 40% = 110% of distributable → always > distributable
    const overBuckets = [
      { id: "debt", type: "debt", allocation_pct: 70, deficit_floor_pct: 5 },
      { id: "savings", type: "savings", allocation_pct: 40, deficit_floor_pct: 3 },
      { id: "food", type: "food", allocation_pct: 0, deficit_floor_pct: null },
      { id: "flex", type: "flex", allocation_pct: 0, deficit_floor_pct: null },
    ];
    // debtFull=70%*500=350, savingsFull=40%*500=200 → 550 > 500 → floors used
    const p = computeOptimal(10000, 9500, overBuckets);
    expect(p.debtAmount).toBe(Math.floor(10000 * 0.05)); // 500
    expect(p.savingsAmount).toBe(Math.floor(10000 * 0.03)); // 300
    expect(p.flexAmount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeLongTermResponsible
// ---------------------------------------------------------------------------
describe("computeLongTermResponsible", () => {
  it("income=$300 bills=$280 → fallback emergency (floors insufficient)", () => {
    const r = computeLongTermResponsible(30000, 28000, BUCKETS, FOOD_MIN);
    expect(r).toEqual({ fallback: "emergency", reason: "floors_insufficient" });
  });

  it("healthy case: sum equals distributable", () => {
    // income=$1000, bills=$100 → distributable=$900
    const p = computeLongTermResponsible(100000, 10000, BUCKETS, FOOD_MIN);
    if ("fallback" in p) throw new Error("unexpected fallback");
    const distributable = 100000 - 10000;
    const sum = p.debtAmount + p.savingsAmount + p.foodAmount + p.flexAmount;
    expect(sum).toBe(distributable);
    expect(p.billsAmount).toBe(10000);
  });

  it("healthy case: debt ≥ floor, savings ≥ floor", () => {
    const p = computeLongTermResponsible(100000, 10000, BUCKETS, FOOD_MIN);
    if ("fallback" in p) throw new Error("unexpected fallback");
    expect(p.debtAmount).toBeGreaterThanOrEqual(Math.floor(100000 * 0.05));
    expect(p.savingsAmount).toBeGreaterThanOrEqual(Math.floor(100000 * 0.03));
  });

  it("healthy case: food ≥ foodMin", () => {
    const p = computeLongTermResponsible(100000, 10000, BUCKETS, FOOD_MIN);
    if ("fallback" in p) throw new Error("unexpected fallback");
    expect(p.foodAmount).toBeGreaterThanOrEqual(FOOD_MIN);
  });

  it("fallback when floors + foodMin exceed distributable", () => {
    // income=$500, bills=$492 → distributable=$8
    // debtFloor=25, savingsFloor=15, foodMin=5000 → 5040 > 800 → fallback
    const r = computeLongTermResponsible(50000, 49200, BUCKETS, FOOD_MIN);
    expect(r).toEqual({ fallback: "emergency", reason: "floors_insufficient" });
  });
});

// ---------------------------------------------------------------------------
// Cross-plan: all sums equal distributable
// ---------------------------------------------------------------------------
describe("all plans sum to income", () => {
  const income = 50000;
  const billTotal = 40000;

  it("optimal sums to income", () => {
    const p = computeOptimal(income, billTotal, BUCKETS);
    const sum = p.billsAmount + p.debtAmount + p.savingsAmount + p.foodAmount + p.flexAmount;
    expect(sum).toBe(income);
  });

  it("emergency sums to income", () => {
    const p = computeEmergency(income, billTotal);
    const sum = p.billsAmount + p.debtAmount + p.savingsAmount + p.foodAmount + p.flexAmount;
    expect(sum).toBe(income);
  });

  it("ltr sums to distributable when not fallback", () => {
    const p = computeLongTermResponsible(100000, 10000, BUCKETS, FOOD_MIN);
    if ("fallback" in p) return;
    const sum = p.debtAmount + p.savingsAmount + p.foodAmount + p.flexAmount;
    expect(sum).toBe(100000 - 10000);
  });
});
