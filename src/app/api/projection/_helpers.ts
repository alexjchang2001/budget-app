import { createAdminClient } from "@/lib/supabase-server";

export type BucketBreakdown = {
  name: string;
  type: string;
  allocatedAmount: number;
  spentAmount: number;
};

export type ClosedWeek = {
  id: string;
  weekStart: string;
  weekEnd: string;
  incomeActual: number | null;
  deficitPlan: string | null;
  totalSpent: number;
  totalAllocated: number;
  buckets: BucketBreakdown[];
};

export type ProjectionData = {
  weekId: string;
  incomeProjectedLow: number;
  incomeProjectedHigh: number;
  baselineWeeklyIncome: number;
  lastPerShiftMin: number;
  lastPerShiftMax: number;
  closedWeeks: ClosedWeek[];
};

async function getCurrentWeek(userId: string) {
  const { data } = await createAdminClient()
    .from("week")
    .select("id, income_projected_low, income_projected_high")
    .eq("user_id", userId)
    .order("week_start", { ascending: false })
    .limit(1)
    .single();
  return data;
}

async function getBaselineIncome(userId: string): Promise<number> {
  const { data } = await createAdminClient()
    .from("user")
    .select("baseline_weekly_income")
    .eq("id", userId)
    .single();
  return (data as unknown as { baseline_weekly_income: number } | null)?.baseline_weekly_income ?? 0;
}

async function getLastPerShift(userId: string): Promise<{ min: number; max: number }> {
  const { data } = await createAdminClient()
    .from("schedule_parse")
    .select("per_shift_income_min, per_shift_income_max")
    .eq("user_id", userId)
    .eq("confirmed_by_user", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return { min: 0, max: 0 };
  return { min: data.per_shift_income_min as number, max: data.per_shift_income_max as number };
}

async function getClosedWeeks(userId: string): Promise<ClosedWeek[]> {
  const supabase = createAdminClient();
  const { data: weeks } = await supabase
    .from("week")
    .select("id, week_start, week_end, income_actual, deficit_plan")
    .eq("user_id", userId)
    .eq("status", "closed")
    .order("week_start", { ascending: false });

  if (!weeks || weeks.length === 0) return [];

  const weekIds = weeks.map((w) => w.id as string);
  const { data: allocs } = await supabase
    .from("bucket_allocation")
    .select("week_id, spent_amount, allocated_amount, bucket!inner(name, type)")
    .in("week_id", weekIds);

  const byWeek: Record<string, BucketBreakdown[]> = {};
  for (const alloc of allocs ?? []) {
    const wId = alloc.week_id as string;
    const b = alloc.bucket as unknown as { name: string; type: string };
    if (!byWeek[wId]) byWeek[wId] = [];
    byWeek[wId].push({
      name: b.name,
      type: b.type,
      allocatedAmount: alloc.allocated_amount as number,
      spentAmount: alloc.spent_amount as number,
    });
  }

  return weeks.map((w) => {
    const buckets = byWeek[w.id as string] ?? [];
    return {
      id: w.id as string,
      weekStart: w.week_start as string,
      weekEnd: w.week_end as string,
      incomeActual: w.income_actual as number | null,
      deficitPlan: w.deficit_plan as string | null,
      totalSpent: buckets.reduce((s, b) => s + b.spentAmount, 0),
      totalAllocated: buckets.reduce((s, b) => s + b.allocatedAmount, 0),
      buckets,
    };
  });
}

export async function getProjectionData(userId: string): Promise<ProjectionData | null> {
  const week = await getCurrentWeek(userId);
  if (!week) return null;

  const [baseline, perShift, closedWeeks] = await Promise.all([
    getBaselineIncome(userId),
    getLastPerShift(userId),
    getClosedWeeks(userId),
  ]);

  return {
    weekId: week.id as string,
    incomeProjectedLow: week.income_projected_low as number,
    incomeProjectedHigh: week.income_projected_high as number,
    baselineWeeklyIncome: baseline,
    lastPerShiftMin: perShift.min,
    lastPerShiftMax: perShift.max,
    closedWeeks,
  };
}
