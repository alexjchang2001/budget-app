import { createAdminClient } from "@/lib/supabase-server";

// Returns how many days remain in the week (today through Thursday inclusive).
// Week runs Friday–Thursday. Friday=5, Saturday=6, Sunday=0, …, Thursday=4.
export function getDaysRemainingInWeek(today: Date): number {
  const day = today.getDay();
  return (4 - day + 7) % 7 + 1; // Fri→7, Sat→6, Sun→5, Mon→4, Tue→3, Wed→2, Thu→1
}

// Current daily limit = remaining balance across non-bill buckets / days left.
// remaining balance = sum(allocated_amount - spent_amount) for non-bill buckets.
export async function computeDailyLimit(weekId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bucket_allocation")
    .select("allocated_amount, spent_amount, bucket!inner(type)")
    .eq("week_id", weekId)
    .neq("bucket.type", "bills");

  if (error) throw error;

  const remaining = (data ?? []).reduce((sum, row) => {
    return sum + (row.allocated_amount - row.spent_amount);
  }, 0);

  const daysLeft = getDaysRemainingInWeek(new Date());
  return Math.floor(remaining / daysLeft);
}

// Opening daily limit = sum of opening allocations for non-bill buckets / 7.
// This is fixed at the time the allocation engine runs and never changes.
export async function computeOpeningDailyLimit(weekId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bucket_allocation")
    .select("opening_allocated_amount, bucket!inner(type)")
    .eq("week_id", weekId)
    .neq("bucket.type", "bills");

  if (error) throw error;

  const total = (data ?? []).reduce(
    (sum, row) => sum + row.opening_allocated_amount,
    0
  );
  return Math.floor(total / 7);
}
