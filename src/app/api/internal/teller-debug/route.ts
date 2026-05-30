import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { decryptToken } from "@/lib/teller/client";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { secret } = await req.json().catch(() => ({ secret: "" }));
  if (secret !== "tmp-reset-2026") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("user")
    .select("id, teller_access_token, teller_access_token_iv, teller_access_token_tag")
    .not("teller_enrollment_id", "is", null)
    .limit(1)
    .single();

  if (!data?.teller_access_token) return NextResponse.json({ error: "No token found" });

  let token: string;
  try {
    token = decryptToken(data.teller_access_token, data.teller_access_token_iv, data.teller_access_token_tag);
  } catch (e) {
    return NextResponse.json({ error: "Decrypt failed", detail: String(e) });
  }

  const auth = Buffer.from(token + ":").toString("base64");
  const res = await fetch("https://api.teller.io/accounts", {
    headers: { Authorization: `Basic ${auth}` },
  });

  const body = await res.text();
  return NextResponse.json({
    status: res.status,
    tokenPrefix: token.slice(0, 8) + "...",
    body,
  });
}
