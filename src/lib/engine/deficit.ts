// Deficit trigger and plan computation.
// T2.2 implements checkDeficitTrigger.
// T2.5 extends this file with computeOptimal, computeEmergency,
// computeLongTermResponsible, and checkInsolvent.

export type DeficitCheckResult = {
  deficit: boolean;
  condition: "A" | "B" | null;
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
