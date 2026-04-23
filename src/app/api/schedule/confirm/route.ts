import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase-server";
import { dollarsToCents } from "@/lib/money";

type ConfirmBody = {
  parse_id: string;
  per_shift_min: number;
  per_shift_max: number;
  week_id: string;
};

function parseBody(body: unknown): ConfirmBody | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.parse_id !== "string") return null;
  if (typeof b.per_shift_min !== "number" || b.per_shift_min <= 0) return null;
  if (typeof b.per_shift_max !== "number" || b.per_shift_max <= 0) return null;
  if (typeof b.week_id !== "string") return null;
  if (b.per_shift_min >= b.per_shift_max) return null;
  return b as unknown as ConfirmBody;
}

async function loadParse(parseId: string, userId: string): Promise<{ shift_count: number } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("schedule_parse").select("shift_count, user_id").eq("id", parseId).single();
  if (!data || data.user_id !== userId) return null;
  return { shift_count: data.shift_count as number };
}

async function applyConfirmation(parseId: string, weekId: string, userId: string, lowCents: number, highCents: number): Promise<void> {
  const supabase = createAdminClient();
  const [parseUpdate, weekUpdate] = await Promise.all([
    supabase.from("schedule_parse").update({ confirmed_by_user: true }).eq("id", parseId),
    supabase.from("week").update({ income_projected_low: lowCents, income_projected_high: highCents }).eq("id", weekId).eq("user_id", userId),
  ]);
  if (parseUpdate.error) throw new Error("Failed to confirm parse");
  if (weekUpdate.error) throw new Error("Failed to update week projections");
}

export async function POST(req: NextRequest) {
  let userId: string;
  try { ({ userId } = await requireAuth()); } catch { return jsonError(401, "Unauthorized"); }

  const body = await req.json().catch(() => null);
  const parsed = parseBody(body);
  if (!parsed) return jsonError(400, "Invalid request body");

  const row = await loadParse(parsed.parse_id, userId);
  if (!row) return jsonError(404, "Schedule parse not found");

  const lowCents = dollarsToCents(parsed.per_shift_min * row.shift_count);
  const highCents = dollarsToCents(parsed.per_shift_max * row.shift_count);

  try {
    await applyConfirmation(parsed.parse_id, parsed.week_id, userId, lowCents, highCents);
    return jsonOk({ income_projected_low: lowCents, income_projected_high: highCents });
  } catch {
    return jsonError(500, "Internal error");
  }
}
