import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-server";
import {
  DeficitPlan,
  LTRResult,
  computeOptimal,
  computeEmergency,
  computeLongTermResponsible,
} from "@/lib/engine/deficit";

type Params = { params: { weekId: string } };

const VALID_PLANS = ["optimal", "emergency", "long_term_responsible"] as const;
type PlanType = (typeof VALID_PLANS)[number];

type BucketRow = {
  id: string;
  type: string;
  allocation_pct: number;
  deficit_floor_pct: number | null;
};

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

  // long_term_responsible — fall through to emergency if floors insufficient
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
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let plan: PlanType;
  try {
    const body = (await request.json()) as { plan: string };
    if (!VALID_PLANS.includes(body.plan as PlanType)) throw new Error("invalid");
    plan = body.plan as PlanType;
  } catch {
    return new Response(
      JSON.stringify({ error: "plan required: optimal|emergency|long_term_responsible" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { weekId } = params;
  const ctx = await getWeekContext(weekId, userId);
  if (!ctx) {
    return new Response(JSON.stringify({ error: "Week not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { income, billTotal, buckets, foodMin, weekEnd } = ctx;
  const computed = selectPlan(plan, income, billTotal, buckets, foodMin);

  await persistAllocations(weekId, userId, computed, buckets, income);

  const supabase = createAdminClient();
  const expiresAt = new Date(`${weekEnd}T23:59:59Z`).toISOString();
  await supabase
    .from("week")
    .update({
      deficit_plan: plan,
      deficit_plan_chosen_at: new Date().toISOString(),
      deficit_plan_expires_at: expiresAt,
    })
    .eq("id", weekId);

  return new Response(
    JSON.stringify({ ok: true, weekId, plan, computed, expiresAt }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
