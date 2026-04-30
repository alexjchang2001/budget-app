import { createAdminClient } from "@/lib/supabase-server";

export async function getUncategorizedCount(userId: string): Promise<number> {
  const supabase = createAdminClient();

  const { data: week } = await supabase
    .from("week")
    .select("id")
    .eq("user_id", userId)
    .order("week_start", { ascending: false })
    .limit(1)
    .single();

  if (!week) return 0;

  const { count } = await supabase
    .from("transaction")
    .select("*", { count: "exact", head: true })
    .eq("week_id", week.id)
    .eq("is_direct_deposit", false)
    .is("bucket_id", null);

  return count ?? 0;
}
