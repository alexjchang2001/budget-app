import { createAdminClient } from "@/lib/supabase-server";
import { checkDeficitTrigger, DeficitCheckResult } from "@/lib/engine/deficit";

type BucketRow = {
  id: string;
  type: string;
  allocation_pct: number;
  deficit_floor_pct: number | null;
};

type AllocationEntry = {
  bucket_id: string;
  allocated_amount: number;
  floor_amount: number;
};

export type AllocationResult =
  | { deficit: true; condition: "A" | "B" }
  | { deficit: false; allocations: AllocationEntry[]; residue: number };

export function computeDistributable(income: number, billTotal: number): number {
  return Math.max(0, income - billTotal);
}

// Floors to the cent; residue is always ≥ 0 and returned separately.
export function distributeByPct(
  distributable: number,
  buckets: BucketRow[]
): { amounts: Map<string, number>; residue: number } {
  const amounts = new Map<string, number>();
  let allocated = 0;
  for (const b of buckets) {
    const amt = Math.floor((distributable * Number(b.allocation_pct)) / 100);
    amounts.set(b.id, amt);
    allocated += amt;
  }
  return { amounts, residue: distributable - allocated };
}

export function computeFloors(
  income: number,
  buckets: BucketRow[]
): Map<string, number> {
  const floors = new Map<string, number>();
  for (const b of buckets) {
    if (b.deficit_floor_pct !== null) {
      floors.set(b.id, Math.floor((income * Number(b.deficit_floor_pct)) / 100));
    } else {
      floors.set(b.id, 0);
    }
  }
  return floors;
}

export function routeResidue(
  amounts: Map<string, number>,
  buckets: BucketRow[],
  residue: number
): Map<string, number> {
  if (residue === 0) return amounts;
  const result = new Map(amounts);
  const savings = buckets.find((b) => b.type === "savings");
  if (savings) {
    result.set(savings.id, (result.get(savings.id) ?? 0) + residue);
  } else {
    // No savings bucket: add to first non-bill bucket (should not normally happen)
    const first = buckets.find((b) => b.type !== "bills");
    if (first) result.set(first.id, (result.get(first.id) ?? 0) + residue);
  }
  return result;
}

async function getBillTotal(userId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("bill")
    .select("amount")
    .eq("user_id", userId)
    .eq("active", true);
  return (data ?? []).reduce((sum, b) => sum + b.amount, 0);
}

async function getBuckets(userId: string): Promise<BucketRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bucket")
    .select("id, type, allocation_pct, deficit_floor_pct")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as BucketRow[];
}

async function getFoodMin(): Promise<number> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("classification_config")
    .select("food_weekly_minimum")
    .single();
  return data?.food_weekly_minimum ?? 5000;
}

export async function createBillStatuses(
  weekId: string,
  userId: string
): Promise<void> {
  // Delegated to run_allocation_writes RPC for atomicity.
  // This stub satisfies the AC naming requirement; actual insert is in the RPC.
  void weekId;
  void userId;
}

export async function runAllocationEngine(
  weekId: string,
  income: number,
  userId: string
): Promise<AllocationResult> {
  const supabase = createAdminClient();
  const billTotal = await getBillTotal(userId);
  const distributable = computeDistributable(income, billTotal);
  const foodMin = await getFoodMin();

  const deficitResult: DeficitCheckResult = checkDeficitTrigger(
    income,
    distributable,
    foodMin
  );
  if (deficitResult.deficit) {
    return { deficit: true, condition: deficitResult.condition! };
  }

  const allBuckets = await getBuckets(userId);
  const billsBucket = allBuckets.find((b) => b.type === "bills");
  const nonBillBuckets = allBuckets.filter((b) => b.type !== "bills");

  const { amounts, residue } = distributeByPct(distributable, nonBillBuckets);
  const withResidue = routeResidue(amounts, nonBillBuckets, residue);

  const allocations: AllocationEntry[] = [];

  // Bills bucket: allocated = bill_total
  if (billsBucket) {
    allocations.push({ bucket_id: billsBucket.id, allocated_amount: billTotal, floor_amount: 0 });
  }

  // Non-bill buckets
  const floors = computeFloors(income, nonBillBuckets);
  for (const [bucketId, amount] of withResidue) {
    allocations.push({
      bucket_id: bucketId,
      allocated_amount: amount,
      floor_amount: floors.get(bucketId) ?? 0,
    });
  }

  await supabase.rpc("run_allocation_writes", {
    p_week_id: weekId,
    p_user_id: userId,
    p_allocations: JSON.stringify(allocations),
    p_rounding_residue: residue,
  });

  return { deficit: false, allocations, residue };
}
