import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-server";
import { encryptToken } from "@/lib/teller/client";
import { jsonError, jsonOk } from "@/lib/http";

export async function POST(request: NextRequest): Promise<Response> {
  let userId: string;
  try {
    ({ userId } = await requireAuth());
  } catch {
    return jsonError(401, "Unauthorized");
  }

  let enrollmentId: string;
  let accessToken: string;
  try {
    const body = (await request.json()) as {
      enrollment_id: string;
      access_token: string;
    };
    if (!body.enrollment_id || !body.access_token) throw new Error("missing");
    enrollmentId = body.enrollment_id;
    accessToken = body.access_token;
  } catch {
    return jsonError(400, "enrollment_id and access_token required");
  }

  const { encrypted, iv, tag } = encryptToken(accessToken);
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("user")
    .update({
      teller_enrollment_id: enrollmentId,
      teller_access_token: encrypted,
      teller_access_token_iv: iv,
      teller_access_token_tag: tag,
      teller_sync_failed: false,
    })
    .eq("id", userId);

  if (error) return jsonError(500, "Failed to store credentials");
  return jsonOk({ ok: true });
}
