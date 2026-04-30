import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-server";

export async function GET(): Promise<NextResponse> {
  let userId: string;
  try {
    ({ userId } = await requireAuth());
  } catch {
    return NextResponse.json({ count: 0 }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: week } = await supabase
    .from("week")
    .select("id")
    .eq("user_id", userId)
    .order("week_start", { ascending: false })
    .limit(1)
    .single();

  if (!week) return NextResponse.json({ count: 0 });

  const { count } = await supabase
    .from("transaction")
    .select("*", { count: "exact", head: true })
    .eq("week_id", week.id)
    .eq("is_direct_deposit", false)
    .is("bucket_id", null);

  return NextResponse.json({ count: count ?? 0 });
}
