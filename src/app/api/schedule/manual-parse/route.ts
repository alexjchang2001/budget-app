import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-server";
import { jsonError, jsonOk } from "@/lib/http";

type Body = { shift_count: number; week_id: string };

function parseBody(body: unknown): Body | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (!Number.isInteger(b.shift_count) || (b.shift_count as number) < 1) return null;
  if (typeof b.week_id !== "string") return null;
  return { shift_count: b.shift_count as number, week_id: b.week_id as string };
}

export async function POST(req: NextRequest) {
  let userId: string;
  try { ({ userId } = await requireAuth()); } catch { return jsonError(401, "Unauthorized"); }

  const body = parseBody(await req.json().catch(() => null));
  if (!body) return jsonError(400, "shift_count (≥1) and week_id required");

  const supabase = createAdminClient();
  const { data: week } = await supabase
    .from("week")
    .select("id")
    .eq("id", body.week_id)
    .eq("user_id", userId)
    .single();
  if (!week) return jsonError(404, "Week not found");

  const { data, error } = await supabase
    .from("schedule_parse")
    .insert({
      user_id: userId,
      week_id: body.week_id,
      raw_screenshot_url: "",
      parsed_shift_count: body.shift_count,
      parsed_shift_days: [],
      confidence: 0,
      confirmed_by_user: false,
    })
    .select("id")
    .single();

  if (error || !data) return jsonError(500, "Failed to create parse record");
  return jsonOk({ parse_id: data.id as string });
}
