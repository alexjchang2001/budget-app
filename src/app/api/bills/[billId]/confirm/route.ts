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

type ConfirmBody = {
  confirmedBy: "user" | "teller";
  transactionId: string | undefined;
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function parseConfirmBody(
  request: NextRequest
): Promise<ConfirmBody | Response> {
  try {
    const body = (await request.json()) as {
      confirmed_by: string;
      transaction_id?: string;
    };
    if (body.confirmed_by !== "user" && body.confirmed_by !== "teller") {
      return jsonResponse(400, { error: "confirmed_by must be user|teller" });
    }
    return {
      confirmedBy: body.confirmed_by,
      transactionId: body.transaction_id,
    };
  } catch {
    return jsonResponse(400, { error: "confirmed_by required: user|teller" });
  }
}

async function loadBillAndWeek(
  userId: string,
  billId: string
): Promise<{ bill: { id: string; amount: number }; weekId: string } | Response> {
  const supabase = createAdminClient();

  const { data: bill } = await supabase
    .from("bill")
    .select("id, amount, user_id")
    .eq("id", billId)
    .eq("user_id", userId)
    .single();
  if (!bill) return jsonResponse(404, { error: "Bill not found" });

  const fridayStr = getMostRecentFriday(new Date()).toISOString().split("T")[0];
  const { data: week } = await supabase
    .from("week")
    .select("id, status")
    .eq("user_id", userId)
    .eq("week_start", fridayStr)
    .single();
  if (!week) return jsonResponse(404, { error: "No active week found" });

  const { data: billStatus } = await supabase
    .from("bill_status")
    .select("status")
    .eq("week_id", week.id)
    .eq("bill_id", billId)
    .single();
  if (billStatus && billStatus.status !== "unpaid") {
    return jsonResponse(409, { error: "Bill already confirmed" });
  }

  return { bill: { id: bill.id, amount: bill.amount }, weekId: week.id };
}

async function performReroute(
  weekId: string,
  billId: string,
  billAmount: number,
  confirmedBy: "user" | "teller",
  transactionId: string | undefined
): Promise<Response | { dailyLimit: number }> {
  const [billsBucketId, priorityBuckets] = await Promise.all([
    getBillsBucketId(weekId),
    getPriorityOrderedBuckets(weekId),
  ]);
  if (!billsBucketId) {
    return jsonResponse(422, { error: "Bills bucket not allocated" });
  }
  const targetBucketId = priorityBuckets[0]?.bucket_id ?? null;

  await rerouteFreedBillAmount(
    weekId,
    billsBucketId,
    targetBucketId,
    billAmount,
    billId,
    confirmedBy,
    transactionId
  );

  const dailyLimit = await computeDailyLimit(weekId);
  return { dailyLimit };
}

export async function POST(
  request: NextRequest,
  { params }: Params
): Promise<Response> {
  let userId: string;
  try {
    ({ userId } = await requireAuth());
  } catch {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  const parsed = await parseConfirmBody(request);
  if (parsed instanceof Response) return parsed;

  const loaded = await loadBillAndWeek(userId, params.billId);
  if (loaded instanceof Response) return loaded;

  const result = await performReroute(
    loaded.weekId,
    loaded.bill.id,
    loaded.bill.amount,
    parsed.confirmedBy,
    parsed.transactionId
  );
  if (result instanceof Response) return result;

  return jsonResponse(200, {
    ok: true,
    weekId: loaded.weekId,
    dailyLimit: result.dailyLimit,
  });
}
