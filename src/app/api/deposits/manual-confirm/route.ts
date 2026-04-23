import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase-server";
import { triggerAllocationForDeposit } from "@/lib/classification/deposit-detection";

type Body = { txId: string };

function parseBody(body: unknown): Body | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.txId !== "string") return null;
  return { txId: b.txId };
}

async function markAsDeposit(txId: string, userId: string): Promise<{ weekId: string } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("transaction")
    .update({ is_direct_deposit: true })
    .eq("id", txId)
    .eq("user_id", userId)
    .select("week_id, amount")
    .single();
  if (!data) return null;
  return { weekId: data.week_id as string };
}

export async function POST(req: NextRequest) {
  let userId: string;
  try { ({ userId } = await requireAuth()); } catch { return jsonError(401, "Unauthorized"); }

  const body = await req.json().catch(() => null);
  const parsed = parseBody(body);
  if (!parsed) return jsonError(400, "Missing txId");

  const result = await markAsDeposit(parsed.txId, userId).catch(() => null);
  if (!result) return jsonError(404, "Transaction not found");

  await triggerAllocationForDeposit(parsed.txId, userId).catch(() => {/* best-effort */});
  return jsonOk({ ok: true, weekId: result.weekId });
}
