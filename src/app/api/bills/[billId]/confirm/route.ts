import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-server";
import {
  getPriorityOrderedBuckets,
  rerouteFreedBillAmount,
  getBillsBucketId,
} from "@/lib/engine/reroute";
import { computeDailyLimit } from "@/lib/engine/daily-limit";
import { getMostRecentFriday } from "@/lib/engine/week";

type Params = { params: { billId: string } };

export async function POST(
  request: NextRequest,
  { params }: Params
): Promise<Response> {
  let userId: string;
  try {
    ({ userId } = await requireAuth(request));
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let confirmedBy: "user" | "teller";
  let transactionId: string | undefined;
  try {
    const body = (await request.json()) as {
      confirmed_by: "user" | "teller";
      transaction_id?: string;
    };
    if (body.confirmed_by !== "user" && body.confirmed_by !== "teller") {
      throw new Error("invalid confirmed_by");
    }
    confirmedBy = body.confirmed_by;
    transactionId = body.transaction_id;
  } catch {
    return new Response(JSON.stringify({ error: "confirmed_by required: user|teller" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createAdminClient();
  const { billId } = params;

  // Verify bill ownership
  const { data: bill } = await supabase
    .from("bill")
    .select("id, amount, user_id")
    .eq("id", billId)
    .eq("user_id", userId)
    .single();

  if (!bill) {
    return new Response(JSON.stringify({ error: "Bill not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get current week
  const friday = getMostRecentFriday(new Date());
  const fridayStr = friday.toISOString().split("T")[0];
  const { data: week } = await supabase
    .from("week")
    .select("id, status")
    .eq("user_id", userId)
    .eq("week_start", fridayStr)
    .single();

  if (!week) {
    return new Response(JSON.stringify({ error: "No active week found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check if already confirmed
  const { data: billStatus } = await supabase
    .from("bill_status")
    .select("status")
    .eq("week_id", week.id)
    .eq("bill_id", billId)
    .single();

  if (billStatus && billStatus.status !== "unpaid") {
    return new Response(JSON.stringify({ error: "Bill already confirmed" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Find bills bucket and highest-priority non-bill target
  const [billsBucketId, priorityBuckets] = await Promise.all([
    getBillsBucketId(week.id),
    getPriorityOrderedBuckets(week.id),
  ]);

  if (!billsBucketId) {
    return new Response(JSON.stringify({ error: "Bills bucket not allocated" }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  const targetBucketId = priorityBuckets[0]?.bucket_id ?? null;

  await rerouteFreedBillAmount(
    week.id,
    billsBucketId,
    targetBucketId,
    bill.amount,
    billId,
    confirmedBy,
    transactionId
  );

  const dailyLimit = await computeDailyLimit(week.id);

  return new Response(
    JSON.stringify({ ok: true, weekId: week.id, dailyLimit }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
