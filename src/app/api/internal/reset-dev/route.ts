import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";

export async function POST(): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 403 });

  const supabase = createAdminClient();
  const tables = ["schedule_parse", "bill_status", "bucket_allocation", "transaction", "week", "bill", "bucket", "user"];
  const results: Record<string, string> = {};

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    results[table] = error ? error.message : "ok";
  }

  return NextResponse.json({ results });
}
