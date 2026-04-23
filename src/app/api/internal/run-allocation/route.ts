import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-server";
import { runAllocationEngine } from "@/lib/engine/allocation";
import {
  createProvisionalWeek,
  getMostRecentFriday,
  reassignFridayTransactions,
  promoteProvisionalWeek,
} from "@/lib/engine/week";

type RequestBody = {
  weekId: string | undefined;
  incomeActual: number | undefined;
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function parseRequestBody(
  request: NextRequest
): Promise<RequestBody | Response> {
  try {
    const body = (await request.json()) as {
      weekId?: string;
      incomeActual?: number;
    };
    return { weekId: body.weekId, incomeActual: body.incomeActual };
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }
}

async function verifyWeekOwnership(
  weekId: string,
  userId: string
): Promise<Response | null> {
  const supabase = createAdminClient();
  const { data: owned } = await supabase
    .from("week")
    .select("id")
    .eq("id", weekId)
    .eq("user_id", userId)
    .single();
  if (!owned) return jsonResponse(404, { error: "Week not found" });
  return null;
}

async function resolveWeekId(userId: string): Promise<string> {
  const supabase = createAdminClient();
  const friday = getMostRecentFriday(new Date());
  const fridayStr = friday.toISOString().split("T")[0];

  const { data: existing } = await supabase
    .from("week")
    .select("id, status")
    .eq("user_id", userId)
    .eq("week_start", fridayStr)
    .single();

  if (existing) return existing.id;

  const week = await createProvisionalWeek(userId);
  await reassignFridayTransactions(week.id, friday);
  return week.id;
}

async function resolveIncome(
  userId: string,
  incomeActual: number | undefined
): Promise<number> {
  if (incomeActual !== undefined) return incomeActual;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("user")
    .select("baseline_weekly_income")
    .eq("id", userId)
    .single();
  return data?.baseline_weekly_income ?? 0;
}

async function executeAllocation(
  userId: string,
  body: RequestBody
): Promise<Response> {
  if (body.weekId) {
    const ownership = await verifyWeekOwnership(body.weekId, userId);
    if (ownership) return ownership;
  }
  const weekId = body.weekId ?? (await resolveWeekId(userId));

  if (body.incomeActual !== undefined) {
    const today = new Date().toISOString().split("T")[0];
    await promoteProvisionalWeek(weekId, {
      incomeActual: body.incomeActual,
      payday: today,
    });
  }

  const income = await resolveIncome(userId, body.incomeActual);
  const result = await runAllocationEngine(weekId, income, userId);
  return jsonResponse(200, { ok: true, weekId, result });
}

export async function POST(request: NextRequest): Promise<Response> {
  let userId: string;
  try {
    ({ userId } = await requireAuth());
  } catch {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  const parsed = await parseRequestBody(request);
  if (parsed instanceof Response) return parsed;

  try {
    return await executeAllocation(userId, parsed);
  } catch (err) {
    console.error("run-allocation error:", err);
    return jsonResponse(500, { error: "Internal error" });
  }
}
