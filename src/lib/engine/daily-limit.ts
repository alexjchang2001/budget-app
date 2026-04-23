import { createAdminClient } from "@/lib/supabase-server";

// Returns how many days remain in the week (today through Thursday inclusive).
// Week runs Friday–Thursday (UTC). Friday=5, …, Thursday=4.
export function getDaysRemainingInWeek(today: Date): number {
  const day = today.getUTCDay();
  return (4 - day + 7) % 7 + 1; // Fri→7, Sat→6, Sun→5, Mon→4, Tue→3, Wed→2, Thu→1
}

async function sumNonBillAllocations(
  weekId: string,
  column: "allocated_amount" | "opening_allocated_amount"
): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bucket_allocation")
    .select(`${column}, bucket!inner(type)`)
    .eq("week_id", weekId)
    .neq("bucket.type", "bills");
  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + (row[column] as number), 0);
}

// Current daily limit = remaining balance across non-bill buckets / days left.
export async function computeDailyLimit(weekId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bucket_allocation")
    .select("allocated_amount, spent_amount, bucket!inner(type)")
    .eq("week_id", weekId)
    .neq("bucket.type", "bills");
  if (error) throw error;

  const remaining = (data ?? []).reduce(
    (sum, row) => sum + (row.allocated_amount - row.spent_amount),
    0
  );
  const daysLeft = getDaysRemainingInWeek(new Date());
  return Math.floor(remaining / daysLeft);
}

// Opening daily limit = sum of opening allocations for non-bill buckets / 7.
export async function computeOpeningDailyLimit(weekId: string): Promise<number> {
  const total = await sumNonBillAllocations(weekId, "opening_allocated_amount");
  return Math.floor(total / 7);
}
