import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-server";
import {
  DeficitPlan,
  LTRResult,
  BucketRow,
  VALID_PLANS,
  PlanType,
  computeOptimal,
  computeEmergency,
  computeLongTermResponsible,
} from "@/lib/engine/deficit";
import { jsonError, jsonOk } from "@/lib/http";

type Params = { params: { weekId: string } };

async function getWeekContext(
  weekId: string,
  userId: string
): Promise<{ income: number; billTotal: number; buckets: BucketRow[]; foodMin: number; weekEnd: string } | null> {
  const supabase = createAdminClient();

  const [weekRes, billsRes, bucketsRes, configRes] = await Promise.all([
    supabase.from("week").select("income_actual, week_end").eq("id", weekId).eq("user_id", userId).single(),
    supabase.from("bill").select("amount").eq("user_id", userId).eq("active", true),
    supabase.from("bucket").select("id, type, allocation_pct, deficit_floor_pct").eq("user_id", userId),
    supabase.from("classification_config").select("food_weekly_minimum").single(),
  ]);

  if (!weekRes.data) return null;

  let income = weekRes.data.income_actual ?? 0;
  if (!income) {
    const userRes = await supabase.from("user").select("baseline_weekly_income").eq("id", userId).single();
    income = userRes.data?.baseline_weekly_income ?? 0;
  }

  const billTotal = (billsRes.data ?? []).reduce((sum, b) => sum + b.amount, 0);
  const buckets = (bucketsRes.data ?? []) as BucketRow[];
  const foodMin = configRes.data?.food_weekly_minimum ?? 5000;

  return { income, billTotal, buckets, foodMin, weekEnd: weekRes.data.week_end as string };
}

function selectPlan(plan: PlanType, income: number, billTotal: number, buckets: BucketRow[], foodMin: number): DeficitPlan {
  if (plan === "emergency") return computeEmergency(income, billTotal);
  if (plan === "optimal") return computeOptimal(income, billTotal, buckets);

  const result: LTRResult = computeLongTermResponsible(income, billTotal, buckets, foodMin);
  return "fallback" in result ? computeEmergency(income, billTotal) : result;
}

async function persistAllocations(
  weekId: string,
  userId: string,
  computed: DeficitPlan,
  buckets: BucketRow[],
  income: number
): Promise<void> {
  const supabase = createAdminClient();
  const byType = new Map(buckets.map((b) => [b.type, b]));

  type Entry = { bucket_id: string; allocated_amount: number; floor_amount: number };
  const allocations: Entry[] = [];

  const amountByType: [string, number][] = [
    ["bills", computed.billsAmount],
    ["debt", computed.debtAmount],
    ["savings", computed.savingsAmount],
    ["food", computed.foodAmount],
    ["flex", computed.flexAmount],
  ];

  for (const [type, amount] of amountByType) {
    const b = byType.get(type);
    if (b) {
      const floor = b.deficit_floor_pct ? Math.floor((income * b.deficit_floor_pct) / 100) : 0;
      allocations.push({ bucket_id: b.id, allocated_amount: amount, floor_amount: floor });
    }
  }

  await supabase.rpc("run_allocation_writes", {
    p_week_id: weekId,
    p_user_id: userId,
    p_allocations: JSON.stringify(allocations),
    p_rounding_residue: 0,
  });
}

export async function POST(
  request: NextRequest,
  { params }: Params
): Promise<Response> {
  let userId: string;
  try {
    ({ userId } = await requireAuth());
  } catch {
    return jsonError(401, "Unauthorized");
  }

  let plan: PlanType;
  try {
    const body = (await request.json()) as { plan: string };
    if (!VALID_PLANS.includes(body.plan as PlanType)) throw new Error("invalid");
    plan = body.plan as PlanType;
  } catch {
    return jsonError(400, "plan required: optimal|emergency|long_term_responsible");
  }

  const { weekId } = params;
  const ctx = await getWeekContext(weekId, userId);
  if (!ctx) {
    return jsonError(404, "Week not found");
  }

  const { income, billTotal, buckets, foodMin, weekEnd } = ctx;
  let computed: DeficitPlan;
  try {
    computed = selectPlan(plan, income, billTotal, buckets, foodMin);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Plan computation failed";
    return jsonError(422, msg);
  }

  const supabase = createAdminClient();
  const expiresAt = new Date(`${weekEnd}T23:59:59Z`).toISOString();

  await persistAllocations(weekId, userId, computed, buckets, income);
  await supabase
    .from("week")
    .update({
      deficit_plan: plan,
      deficit_plan_chosen_at: new Date().toISOString(),
      deficit_plan_expires_at: expiresAt,
    })
    .eq("id", weekId);

  return jsonOk({ ok: true, weekId, plan, computed, expiresAt });
}
