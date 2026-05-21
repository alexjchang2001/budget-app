import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";

export async function POST(req: Request): Promise<NextResponse> {
  const { secret } = await req.json().catch(() => ({ secret: "" }));
  if (secret !== "tmp-reset-2026") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = createAdminClient();
  const tables = ["schedule_parse", "bill_status", "bucket_allocation", "transaction", "week", "bill", "bucket", "user"];
  const results: Record<string, string> = {};
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    results[table] = error ? error.message : "ok";
  }
  return NextResponse.json({ results });
}
