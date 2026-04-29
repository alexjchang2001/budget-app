import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase-server";
import { TransactionRow } from "@/lib/supabase";
import { triggerAllocationForDeposit } from "@/lib/classification/deposit-detection";

type Body = { txId: string };

function parseBody(body: unknown): Body | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.txId !== "string") return null;
  return { txId: b.txId };
}

async function markAsDeposit(txId: string, userId: string): Promise<TransactionRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("transaction")
    .update({ is_direct_deposit: true })
    .eq("id", txId)
    .eq("user_id", userId)
    .select("*")
    .single();
  return (data as TransactionRow | null) ?? null;
}

export async function POST(req: NextRequest) {
  let userId: string;
  try { ({ userId } = await requireAuth()); } catch { return jsonError(401, "Unauthorized"); }

  const body = await req.json().catch(() => null);
  const parsed = parseBody(body);
  if (!parsed) return jsonError(400, "Missing txId");

  const tx = await markAsDeposit(parsed.txId, userId).catch(() => null);
  if (!tx) return jsonError(404, "Transaction not found");

  try {
    await triggerAllocationForDeposit(tx, { id: userId });
  } catch {
    return jsonError(500, "Allocation failed");
  }
  return jsonOk({ ok: true, weekId: tx.week_id });
}
