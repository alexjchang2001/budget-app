export type DeficitCheckResult = {
  deficit: boolean;
  condition: "A" | "B" | null;
};

export type DeficitPlan = {
  billsAmount: number;
  debtAmount: number;
  savingsAmount: number;
  foodAmount: number;
  flexAmount: number;
};

export type LTRResult = DeficitPlan | { fallback: "emergency"; reason: string };

type BucketRow = {
  id: string;
  type: string;
  allocation_pct: number;
  deficit_floor_pct: number | null;
};

// All amounts in cents.
// Condition A: distributable < income * 8%
// Condition B: after reserving debt floor (5%) and savings floor (3%),
//              remaining distributable < food_weekly_minimum
export function checkDeficitTrigger(
  income: number,
  distributable: number,
  foodMin: number
): DeficitCheckResult {
  if (distributable < income * 0.08) {
    return { deficit: true, condition: "A" };
  }
  const afterFloors = distributable - income * 0.05 - income * 0.03;
  if (afterFloors < foodMin) {
    return { deficit: true, condition: "B" };
  }
  return { deficit: false, condition: null };
}

export function checkInsolvent(
  income: number,
  billTotal: number,
  debtFloor: number,
  savingsFloor: number,
  foodMin: number
): boolean {
  return income < billTotal + debtFloor + savingsFloor + foodMin;
}

export function computeEmergency(income: number, billTotal: number): DeficitPlan {
  const distributable = Math.max(0, income - billTotal);
  const debtAmount = Math.floor(income * 0.05);
  const savingsAmount = Math.floor(income * 0.03);
  const foodAmount = Math.max(5000, distributable - debtAmount - savingsAmount);
  return { billsAmount: billTotal, debtAmount, savingsAmount, foodAmount, flexAmount: 0 };
}

export function computeOptimal(
  income: number,
  billTotal: number,
  buckets: BucketRow[]
): DeficitPlan {
  const distributable = Math.max(0, income - billTotal);
  const debtB = buckets.find((b) => b.type === "debt")!;
  const savingsB = buckets.find((b) => b.type === "savings")!;

  const debtFull = Math.floor((distributable * debtB.allocation_pct) / 100);
  const savingsFull = Math.floor((distributable * savingsB.allocation_pct) / 100);
  const debtFloor = Math.floor((income * (debtB.deficit_floor_pct ?? 5)) / 100);
  const savingsFloor = Math.floor((income * (savingsB.deficit_floor_pct ?? 3)) / 100);

  const canAffordFull = debtFull + savingsFull <= distributable;
  const debtAmount = canAffordFull ? debtFull : debtFloor;
  const savingsAmount = canAffordFull ? savingsFull : savingsFloor;
  const foodAmount = Math.max(0, distributable - debtAmount - savingsAmount);

  return { billsAmount: billTotal, debtAmount, savingsAmount, foodAmount, flexAmount: 0 };
}

export function computeLongTermResponsible(
  income: number,
  billTotal: number,
  buckets: BucketRow[],
  foodMin: number
): LTRResult {
  const distributable = Math.max(0, income - billTotal);
  const debtB = buckets.find((b) => b.type === "debt")!;
  const savingsB = buckets.find((b) => b.type === "savings")!;
  const flexB = buckets.find((b) => b.type === "flex");

  const debtFloor = Math.floor((income * (debtB.deficit_floor_pct ?? 5)) / 100);
  const savingsFloor = Math.floor((income * (savingsB.deficit_floor_pct ?? 3)) / 100);

  if (debtFloor + savingsFloor + foodMin > distributable) {
    return { fallback: "emergency", reason: "floors_insufficient" };
  }

  // Uniform cut: normal allocs are income * pct; cut proportionally to fit distributable.
  const nonBill = buckets.filter((b) => b.type !== "bills");
  const totalNormal = nonBill.reduce(
    (sum, b) => sum + Math.floor((income * b.allocation_pct) / 100),
    0
  );
  const cutPct = totalNormal > 0 ? (totalNormal - distributable) / totalNormal : 0;
  const flexNormal = flexB ? Math.floor((income * flexB.allocation_pct) / 100) : 0;
  const flexProposed = Math.max(0, Math.floor(flexNormal * (1 - cutPct)));

  // Debt and savings get their max(proposed, floor); flex and food absorb the cut.
  const debtProposed = Math.max(
    Math.floor((Math.floor((income * debtB.allocation_pct) / 100)) * (1 - cutPct)),
    debtFloor
  );
  const savingsProposed = Math.max(
    Math.floor((Math.floor((income * savingsB.allocation_pct) / 100)) * (1 - cutPct)),
    savingsFloor
  );

  const remaining = distributable - debtProposed - savingsProposed;
  if (remaining < foodMin) {
    return { fallback: "emergency", reason: "floors_insufficient" };
  }

  const flexAmount = Math.max(0, Math.min(flexProposed, remaining - foodMin));
  const foodAmount = remaining - flexAmount;
  const residue = distributable - debtProposed - savingsProposed - foodAmount - flexAmount;

  return {
    billsAmount: billTotal,
    debtAmount: debtProposed,
    savingsAmount: savingsProposed,
    foodAmount,
    flexAmount: flexAmount + residue,
  };
}
