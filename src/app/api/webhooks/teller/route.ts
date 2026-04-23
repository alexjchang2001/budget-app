import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { dollarsToCents } from "@/lib/money";
import { classifyTransaction } from "@/lib/classification/pipeline";
import { verifyTellerHmac } from "@/lib/teller/hmac";
import { jsonError, jsonOk } from "@/lib/http";

type TellerWebhookPayload = {
  type: string;
  payload: {
    account_id?: string;
    enrollment_id?: string;
    transaction?: {
      id: string;
      amount: string;
      description: string;
      details?: { counterparty?: { name?: string } };
      date: string;
    };
  };
};

async function findUserByEnrollment(enrollmentId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data: user } = await supabase
    .from("user")
    .select("id")
    .eq("teller_enrollment_id", enrollmentId)
    .single();
  return user?.id ?? null;
}

async function insertTransaction(
  userId: string,
  tx: NonNullable<TellerWebhookPayload["payload"]["transaction"]>
): Promise<{ id: string } | null> {
  const supabase = createAdminClient();
  const amountCents = dollarsToCents(Math.abs(parseFloat(tx.amount)));
  const { data: inserted, error } = await supabase
    .from("transaction")
    .insert({
      user_id: userId,
      teller_transaction_id: tx.id,
      amount: amountCents,
      description: tx.description,
      merchant_name: tx.details?.counterparty?.name ?? "",
      posted_at: new Date(tx.date).toISOString(),
    })
    .select("id")
    .single();

  if (error && error.code !== "23505") {
    console.error("Webhook insert error:", error);
    throw new Error("DB error");
  }
  return inserted;
}

export async function POST(request: NextRequest): Promise<Response> {
  const body = await request.text();
  const signature = request.headers.get("teller-signature") ?? "";
  const secret = process.env.TELLER_SIGNING_SECRET ?? "";

  if (!verifyTellerHmac(body, signature, secret)) {
    return jsonError(401, "Invalid signature");
  }

  let payload: TellerWebhookPayload;
  try {
    payload = JSON.parse(body) as TellerWebhookPayload;
  } catch {
    return jsonError(400, "Invalid JSON");
  }

  if (payload.type !== "transaction.created") {
    return jsonOk({ ok: true });
  }

  const tx = payload.payload.transaction;
  const enrollmentId = payload.payload.enrollment_id;
  if (!tx || !enrollmentId) {
    return jsonError(400, "Missing transaction data");
  }

  const userId = await findUserByEnrollment(enrollmentId);
  if (!userId) return jsonError(404, "Unknown enrollment");

  let inserted: { id: string } | null;
  try {
    inserted = await insertTransaction(userId, tx);
  } catch {
    return jsonError(500, "DB error");
  }

  if (inserted) {
    const insertedId = inserted.id;
    await classifyTransaction(insertedId).catch((err) => {
      console.error("classify error for tx", insertedId, err);
    });
  }

  return jsonOk({ ok: true });
}
