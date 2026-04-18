import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { classifyTransaction } from "@/lib/classification/pipeline";

export async function POST(request: NextRequest): Promise<Response> {
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
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Resolve teller_transaction_id → internal id if needed
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
    return new Response(JSON.stringify({ error: "transaction_id required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const result = await classifyTransaction(transactionId);
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("classify error:", err);
    return new Response(JSON.stringify({ error: "Classification failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
