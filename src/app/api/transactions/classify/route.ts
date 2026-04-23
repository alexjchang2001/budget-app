import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { classifyTransaction } from "@/lib/classification/pipeline";
import { verifyCronSecret } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";

export async function POST(request: NextRequest): Promise<Response> {
  if (!verifyCronSecret(request)) {
    return jsonError(403, "Forbidden");
  }

  let transactionId: string | undefined;
  let tellerTransactionId: string | undefined;

  try {
    const body = (await request.json()) as {
      transaction_id?: string;
      teller_transaction_id?: string;
    };
    transactionId = body.transaction_id;
    tellerTransactionId = body.teller_transaction_id;
  } catch {
    return jsonError(400, "Invalid JSON");
  }

  if (!transactionId && tellerTransactionId) {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("transaction")
      .select("id")
      .eq("teller_transaction_id", tellerTransactionId)
      .single();
    transactionId = data?.id;
  }

  if (!transactionId) {
    return jsonError(400, "transaction_id required");
  }

  try {
    const result = await classifyTransaction(transactionId);
    return jsonOk({ ok: true, ...result });
  } catch (err) {
    console.error("classify error:", err);
    return jsonError(500, "Classification failed");
  }
}
