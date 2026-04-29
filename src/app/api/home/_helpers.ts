import { createAdminClient } from "@/lib/supabase-server";
import { computeDailyLimit, computeOpeningDailyLimit } from "@/lib/engine/daily-limit";

export type BillStatusRow = {
  id: string;
  billId: string;
  name: string;
  amount: number;
  status: string;
};

export type RecentTx = {
  id: string;
  amount: number;
  merchant_name: string;
  description: string;
  posted_at: string;
  is_direct_deposit: boolean;
};

export type HomeData = {
  weekId: string;
  weekStatus: string;
  dailyLimit: number;
  openingDailyLimit: number;
  deficitPlan: string | null;
  incomeActual: number | null;
  incomeProjectedLow: number;
  incomeProjectedHigh: number;
  weekStart: string;
  weekEnd: string;
  billStatuses: BillStatusRow[];
  recentTransactions: RecentTx[];
  syncError: boolean;
  debtPct: number;
  savingsPct: number;
  billsPaid: number;
  billsTotal: number;
};

async function getCurrentWeek(userId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("week")
    .select("id, status, deficit_plan, income_actual, income_projected_low, income_projected_high, week_start, week_end")
    .eq("user_id", userId)
    .order("week_start", { ascending: false })
    .limit(1)
    .single();
  return data;
}

async function getBillStatuses(weekId: string): Promise<BillStatusRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("bill_status")
    .select("id, status, bill!inner(id, name, amount)")
    .eq("week_id", weekId);
  return (data ?? []).map((row) => {
    const bill = row.bill as unknown as { id: string; name: string; amount: number };
    return { id: row.id as string, billId: bill.id, name: bill.name, amount: bill.amount, status: row.status as string };
  });
}

async function getRecentTransactions(userId: string, weekId: string): Promise<RecentTx[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("transaction")
    .select("id, amount, merchant_name, description, posted_at, is_direct_deposit")
    .eq("user_id", userId)
    .eq("week_id", weekId)
    .order("posted_at", { ascending: false })
    .limit(10);
  return (data ?? []) as RecentTx[];
}

async function getAllocPcts(weekId: string): Promise<{ debtPct: number; savingsPct: number }> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("bucket_allocation")
    .select("spent_amount, allocated_amount, bucket!inner(type)")
    .eq("week_id", weekId);

  let debtSpent = 0, debtAlloc = 0, savingsSpent = 0, savingsAlloc = 0;
  for (const row of data ?? []) {
    const type = (row.bucket as unknown as { type: string }).type;
    if (type === "debt") { debtSpent += row.spent_amount; debtAlloc += row.allocated_amount; }
    if (type === "savings") { savingsSpent += row.spent_amount; savingsAlloc += row.allocated_amount; }
  }
  return {
    debtPct: debtAlloc > 0 ? Math.round((debtSpent / debtAlloc) * 100) : 0,
    savingsPct: savingsAlloc > 0 ? Math.round((savingsSpent / savingsAlloc) * 100) : 0,
  };
}

async function getSyncError(userId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("user").select("teller_sync_failed").eq("id", userId).single();
  return !!(data as unknown as { teller_sync_failed: boolean } | null)?.teller_sync_failed;
}

export async function getHomeData(userId: string): Promise<HomeData | null> {
  const week = await getCurrentWeek(userId);
  if (!week) return null;

  const [billStatuses, recentTransactions, allocPcts, syncError, dailyLimit, openingDailyLimit] = await Promise.all([
    getBillStatuses(week.id as string),
    getRecentTransactions(userId, week.id as string),
    getAllocPcts(week.id as string),
    getSyncError(userId),
    computeDailyLimit(week.id as string),
    computeOpeningDailyLimit(week.id as string),
  ]);

  const paid = billStatuses.filter((b) => b.status === "paid").length;
  return {
    weekId: week.id as string,
    weekStatus: week.status as string,
    dailyLimit,
    openingDailyLimit,
    deficitPlan: week.deficit_plan as string | null,
    incomeActual: week.income_actual as number | null,
    incomeProjectedLow: week.income_projected_low as number,
    incomeProjectedHigh: week.income_projected_high as number,
    weekStart: week.week_start as string,
    weekEnd: week.week_end as string,
    billStatuses,
    recentTransactions,
    syncError,
    debtPct: allocPcts.debtPct,
    savingsPct: allocPcts.savingsPct,
    billsPaid: paid,
    billsTotal: billStatuses.length,
  };
}
