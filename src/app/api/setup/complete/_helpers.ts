import { createAdminClient } from "@/lib/supabase-server";
import { dollarsToCents } from "@/lib/money";
import {
  createProvisionalWeek,
  getMostRecentFriday,
  reassignFridayTransactions,
} from "@/lib/engine/week";
import { runAllocationEngine } from "@/lib/engine/allocation";

export type BillInput = { name: string; amount: number; due_day: number };
export type BucketInput = {
  name: string;
  allocation_pct: number;
  type: string;
  deficit_floor_pct: number | null;
  priority_order: number;
};

export async function insertBills(
  userId: string,
  bills: BillInput[],
): Promise<void> {
  const supabase = createAdminClient();
  const rows = bills.map((b) => ({
    user_id: userId,
    name: b.name,
    amount: dollarsToCents(b.amount),
    due_day_of_month: b.due_day,
    recurrence: "monthly",
    active: true,
  }));
  const { error } = await supabase.from("bill").insert(rows);
  if (error) throw error;
}

export async function insertBuckets(
  userId: string,
  buckets: BucketInput[],
): Promise<void> {
  const supabase = createAdminClient();
  const billsBucket = {
    user_id: userId,
    name: "Bills",
    type: "bills",
    allocation_pct: 0,
    deficit_floor_pct: null,
    priority_order: 0,
  };
  const rows = [billsBucket, ...buckets.map((b) => ({ user_id: userId, ...b }))];
  const { error } = await supabase.from("bucket").insert(rows);
  if (error) throw error;
}

export async function createAndAllocateWeek(
  userId: string,
  incomeCents: number,
): Promise<string> {
  const friday = getMostRecentFriday(new Date());
  const week = await createProvisionalWeek(userId);
  await reassignFridayTransactions(week.id, friday);
  await runAllocationEngine(week.id, incomeCents, userId);
  return week.id;
}

export async function finalizeUser(
  userId: string,
  incomeCents: number,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("user")
    .update({ baseline_weekly_income: incomeCents, setup_complete: true })
    .eq("id", userId);
  if (error) throw error;
}
