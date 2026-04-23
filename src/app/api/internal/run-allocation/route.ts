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

export async function POST(request: NextRequest): Promise<Response> {
  let userId: string;
  try {
    ({ userId } = await requireAuth());
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let weekId: string | undefined;
  let incomeActual: number | undefined;

  try {
    const body = (await request.json()) as {
      weekId?: string;
      incomeActual?: number;
    };
    weekId = body.weekId;
    incomeActual = body.incomeActual;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createAdminClient();

    // Verify weekId belongs to caller when explicitly provided
    if (weekId) {
      const { data: owned } = await supabase
        .from("week")
        .select("id")
        .eq("id", weekId)
        .eq("user_id", userId)
        .single();
      if (!owned) {
        return new Response(JSON.stringify({ error: "Week not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // If no weekId provided, create or find the current provisional week
    if (!weekId) {
      const friday = getMostRecentFriday(new Date());
      const fridayStr = friday.toISOString().split("T")[0];

      const { data: existing } = await supabase
        .from("week")
        .select("id, status")
        .eq("user_id", userId)
        .eq("week_start", fridayStr)
        .single();

      if (existing) {
        weekId = existing.id;
      } else {
        const week = await createProvisionalWeek(userId);
        await reassignFridayTransactions(week.id, friday);
        weekId = week.id;
      }
    }

    // Promote to active if income provided
    if (incomeActual !== undefined) {
      const today = new Date().toISOString().split("T")[0];
      await promoteProvisionalWeek(weekId, {
        incomeActual,
        payday: today,
      });
    }

    const income =
      incomeActual ??
      (await (async () => {
        const { data } = await supabase
          .from("user")
          .select("baseline_weekly_income")
          .eq("id", userId)
          .single();
        return data?.baseline_weekly_income ?? 0;
      })());

    const result = await runAllocationEngine(weekId, income, userId);

    return new Response(JSON.stringify({ ok: true, weekId, result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("run-allocation error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
