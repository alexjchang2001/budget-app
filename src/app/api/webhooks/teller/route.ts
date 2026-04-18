import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { dollarsToCents } from "@/lib/money";

export function verifyTellerHmac(
  body: string,
  signatureHeader: string,
  secret: string
): boolean {
  // Header format: "t=<timestamp>,v1=<hmac_hex>"
  const parts: Record<string, string> = {};
  for (const part of signatureHeader.split(",")) {
    const [k, v] = part.split("=");
    if (k && v) parts[k] = v;
  }
  if (!parts["t"] || !parts["v1"]) return false;

  const payload = `${parts["t"]}.${body}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(parts["v1"], "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}

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

export async function POST(request: NextRequest): Promise<Response> {
  const body = await request.text();
  const signature = request.headers.get("teller-signature") ?? "";
  const secret = process.env.TELLER_SIGNING_SECRET ?? "";

  if (!verifyTellerHmac(body, signature, secret)) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: TellerWebhookPayload;
  try {
    payload = JSON.parse(body) as TellerWebhookPayload;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (payload.type !== "transaction.created") {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const tx = payload.payload.transaction;
  const enrollmentId = payload.payload.enrollment_id;
  if (!tx || !enrollmentId) {
    return new Response(JSON.stringify({ error: "Missing transaction data" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createAdminClient();
  const { data: user } = await supabase
    .from("user")
    .select("id")
    .eq("teller_enrollment_id", enrollmentId)
    .single();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unknown enrollment" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const amountCents = dollarsToCents(Math.abs(parseFloat(tx.amount)));
  const { data: inserted, error } = await supabase
    .from("transaction")
    .insert({
      user_id: user.id,
      teller_transaction_id: tx.id,
      amount: amountCents,
      description: tx.description,
      merchant_name: tx.details?.counterparty?.name ?? null,
      posted_at: new Date(tx.date).toISOString(),
    })
    .select("id")
    .single();

  if (error && error.code !== "23505") {
    console.error("Webhook insert error:", error);
    return new Response(JSON.stringify({ error: "DB error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (inserted) {
    // Enqueue classification — fire and forget
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    fetch(`${baseUrl}/api/transactions/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transaction_id: inserted.id }),
    }).catch(() => {});
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
