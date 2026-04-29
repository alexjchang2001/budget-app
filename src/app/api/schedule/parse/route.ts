import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase-server";
import { parseScheduleImage, ParseFailedError } from "@/lib/vision/schedule-parser";

async function uploadScreenshot(userId: string, weekId: string, buffer: Buffer, ext: string): Promise<string> {
  const supabase = createAdminClient();
  const path = `${userId}/${weekId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("schedule-screenshots").upload(path, buffer, { contentType: `image/${ext}` });
  if (error) throw new Error("Storage upload failed");
  const { data } = supabase.storage.from("schedule-screenshots").getPublicUrl(path);
  return data.publicUrl;
}

async function insertScheduleParse(userId: string, weekId: string, screenshotUrl: string, shift_count: number, shift_days: string[], confidence: number): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("schedule_parse").insert({
    user_id: userId,
    week_id: weekId,
    raw_screenshot_url: screenshotUrl,
    parsed_shift_count: shift_count,
    parsed_shift_days: shift_days,
    confidence,
    confirmed_by_user: false,
  }).select("id").single();
  if (error || !data) throw new Error("DB insert failed");
  return data.id as string;
}

async function resolveCurrentWeek(userId: string): Promise<string> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("week").select("id").eq("user_id", userId).order("week_start", { ascending: false }).limit(1).single();
  if (!data) throw new Error("No active week");
  return data.id as string;
}

export async function POST(req: NextRequest) {
  let userId: string;
  try { ({ userId } = await requireAuth()); } catch { return jsonError(401, "Unauthorized"); }

  const form = await req.formData().catch(() => null);
  if (!form) return jsonError(400, "Invalid form data");

  const file = form.get("image") as File | null;
  if (!file) return jsonError(400, "Missing image field");

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/jpeg";
  const ext = mime.split("/")[1] ?? "jpg";

  try {
    const weekId = await resolveCurrentWeek(userId);
    const parsed = await parseScheduleImage(buffer, mime);
    const url = await uploadScreenshot(userId, weekId, buffer, ext);
    const parseId = await insertScheduleParse(userId, weekId, url, parsed.shift_count, parsed.shift_days, parsed.confidence);
    return jsonOk({ shift_count: parsed.shift_count, shift_days: parsed.shift_days, confidence: parsed.confidence, parse_id: parseId });
  } catch (err) {
    if (err instanceof ParseFailedError) return jsonOk({ error: "parse_failed" });
    return jsonError(500, "Internal error");
  }
}
