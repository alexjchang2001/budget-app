import { createAdminClient } from "@/lib/supabase-server";
import { TransactionRow, UserRow } from "@/lib/supabase";
import { runAllocationEngine } from "@/lib/engine/allocation";
import {
  createProvisionalWeek,
  getMostRecentFriday,
  reassignFridayTransactions,
  promoteProvisionalWeek,
} from "@/lib/engine/week";

const DEPOSIT_KEYWORDS = [
  "direct deposit",
  "payroll",
  "ach credit",
  "direct dep",
];

// Fri=5, Sat=6, Sun=0 are all valid deposit days
const DEPOSIT_DAYS = new Set([5, 6, 0]);

export function isDirectDepositBySignals(
  tx: Pick<TransactionRow, "amount" | "description" | "merchant_name" | "posted_at">,
  baselineIncome: number
): boolean {
  if (tx.amount <= 0) return false;

  const text = `${tx.description} ${tx.merchant_name}`.toLowerCase();
  if (!DEPOSIT_KEYWORDS.some((kw) => text.includes(kw))) return false;

  if (baselineIncome > 0 && tx.amount < baselineIncome * 0.6) return false;

  const day = new Date(tx.posted_at).getDay();
  if (!DEPOSIT_DAYS.has(day)) return false;

  return true;
}

async function getOrCreateCurrentWeek(
  userId: string
): Promise<{ weekId: string; isNew: boolean; hadPriorDeposit: boolean }> {
  const supabase = createAdminClient();
  const friday = getMostRecentFriday(new Date());
  const fridayStr = friday.toISOString().split("T")[0];

  const { data: existing } = await supabase
    .from("week")
    .select("id, status, income_actual")
    .eq("user_id", userId)
    .eq("week_start", fridayStr)
    .single();

  if (existing) {
    return {
      weekId: existing.id,
      isNew: false,
      hadPriorDeposit: existing.income_actual !== null,
    };
  }

  const week = await createProvisionalWeek(userId);
  await reassignFridayTransactions(week.id, friday);
  return { weekId: week.id, isNew: true, hadPriorDeposit: false };
}

export async function triggerAllocationForDeposit(
  tx: TransactionRow,
  user: Pick<UserRow, "id">
): Promise<void> {
  const supabase = createAdminClient();
  const { weekId, hadPriorDeposit } = await getOrCreateCurrentWeek(user.id);

  // Second deposit mid-week: expire any active deficit plan
  if (hadPriorDeposit) {
    await supabase
      .from("week")
      .update({ deficit_plan_expires_at: new Date().toISOString() })
      .eq("id", weekId);
  }

  await promoteProvisionalWeek(weekId, {
    incomeActual: tx.amount,
    payday: tx.posted_at.split("T")[0],
  });

  await runAllocationEngine(weekId, tx.amount, user.id);
}

export async function detectAndHandleDeposit(
  tx: TransactionRow,
  user: Pick<UserRow, "id" | "baseline_weekly_income">
): Promise<boolean> {
  if (!isDirectDepositBySignals(tx, user.baseline_weekly_income)) return false;

  const supabase = createAdminClient();
  await supabase
    .from("transaction")
    .update({ is_direct_deposit: true })
    .eq("id", tx.id);

  await triggerAllocationForDeposit(tx, user);
  return true;
}
