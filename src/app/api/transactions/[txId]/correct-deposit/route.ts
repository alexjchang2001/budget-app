import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase-server";
import { classifyTransaction } from "@/lib/classification/pipeline";

async function clearDepositFlag(txId: string, userId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("transaction")
    .update({ is_direct_deposit: false })
    .eq("id", txId)
    .eq("user_id", userId)
    .select("id")
    .single();
  return !!data;
}

export async function POST(_req: NextRequest, { params }: { params: { txId: string } }) {
  let userId: string;
  try { ({ userId } = await requireAuth()); } catch { return jsonError(401, "Unauthorized"); }

  const cleared = await clearDepositFlag(params.txId, userId).catch(() => false);
  if (!cleared) return jsonError(404, "Transaction not found");

  classifyTransaction(params.txId).catch(() => {/* best-effort re-classify */});
  return jsonOk({ ok: true });
}
