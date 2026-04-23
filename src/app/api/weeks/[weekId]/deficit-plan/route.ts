import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-server";

type Params = { params: { weekId: string } };

const VALID_PLANS = ["optimal", "emergency", "long_term_responsible"] as const;
type PlanType = (typeof VALID_PLANS)[number];

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

  const supabase = createAdminClient();
  const { weekId } = params;

  const { data: week } = await supabase
    .from("week")
    .select("id, week_end, user_id")
    .eq("id", weekId)
    .eq("user_id", userId)
    .single();

  if (!week) {
    return new Response(JSON.stringify({ error: "Week not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // deficit_plan_expires_at = end of week (Thursday midnight UTC)
  const expiresAt = new Date(`${week.week_end}T23:59:59Z`).toISOString();

  const { error } = await supabase
    .from("week")
    .update({
      deficit_plan: plan,
      deficit_plan_chosen_at: new Date().toISOString(),
      deficit_plan_expires_at: expiresAt,
    })
    .eq("id", weekId);

  if (error) {
    return new Response(JSON.stringify({ error: "Failed to store plan" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ ok: true, weekId, plan, expiresAt }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
