import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase-server";
import { classifyTransaction } from "@/lib/classification/pipeline";

async function clearDepositFlagAndGetWeek(txId: string, userId: string): Promise<{ weekId: string | null } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("transaction")
    .update({ is_direct_deposit: false })
    .eq("id", txId)
    .eq("user_id", userId)
    .select("week_id")
    .single();
  if (!data) return null;
  return { weekId: data.week_id as string | null };
}

async function revertWeekIfNoDeposits(weekId: string, userId: string): Promise<void> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("transaction")
    .select("id", { count: "exact", head: true })
    .eq("week_id", weekId)
    .eq("is_direct_deposit", true);
  if (count === 0) {
    await supabase
      .from("week")
      .update({ income_actual: null, status: "projected" })
      .eq("id", weekId)
      .eq("user_id", userId);
  }
}

export async function POST(_req: NextRequest, { params }: { params: { txId: string } }) {
  let userId: string;
  try { ({ userId } = await requireAuth()); } catch { return jsonError(401, "Unauthorized"); }

  const result = await clearDepositFlagAndGetWeek(params.txId, userId).catch(() => null);
  if (!result) return jsonError(404, "Transaction not found");

  if (result.weekId) {
    await revertWeekIfNoDeposits(result.weekId, userId).catch(() => {/* best-effort */});
  }
  await classifyTransaction(params.txId).catch(() => {/* best-effort re-classify */});
  return jsonOk({ ok: true });
}
