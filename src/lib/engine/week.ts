import { createAdminClient } from "@/lib/supabase-server";

export type WeekRow = {
  id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  status: "projected" | "active" | "closed";
  income_actual: number | null;
  rounding_residue: number;
};

export type PromoteDepositData = {
  incomeActual: number;
  payday: string;
};

// Returns most recent Friday ≤ date (day=0 is Sunday, 5 is Friday)
export function getMostRecentFriday(date: Date): Date {
  const d = new Date(date);
  const daysBack = (d.getDay() + 2) % 7; // Fri→0, Sat→1, Sun→2, … Thu→6
  d.setDate(d.getDate() - daysBack);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekEnd(friday: Date): Date {
  const d = new Date(friday);
  d.setDate(d.getDate() + 6); // Friday + 6 = Thursday
  return d;
}

export async function createProvisionalWeek(userId: string): Promise<WeekRow> {
  const supabase = createAdminClient();
  const friday = getMostRecentFriday(new Date());
  const thursday = getWeekEnd(friday);

  const { data, error } = await supabase
    .from("week")
    .insert({
      user_id: userId,
      week_start: friday.toISOString().split("T")[0],
      week_end: thursday.toISOString().split("T")[0],
      status: "projected",
    })
    .select()
    .single();

  if (error) throw error;
  return data as WeekRow;
}

export async function reassignFridayTransactions(
  weekId: string,
  friday: Date
): Promise<void> {
  const supabase = createAdminClient();
  const fridayStr = friday.toISOString().split("T")[0];

  // Transactions posted on the same Friday belong to the new week, not the prior one
  await supabase
    .from("transaction")
    .update({ week_id: weekId })
    .gte("posted_at", `${fridayStr}T00:00:00.000Z`)
    .lt("posted_at", `${fridayStr}T23:59:59.999Z`)
    .neq("week_id", weekId);
}

export async function promoteProvisionalWeek(
  weekId: string,
  deposit: PromoteDepositData
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("week")
    .update({
      status: "active",
      income_actual: deposit.incomeActual,
      payday: deposit.payday,
    })
    .eq("id", weekId)
    .eq("status", "projected");

  if (error) throw error;
}
