import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyJwt } from "@/lib/jwt";
import { AUTH_COOKIE } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-server";
import AppShell from "@/components/AppShell";
import { getUncategorizedCount } from "./_helpers";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<JSX.Element> {
  const token = cookies().get(AUTH_COOKIE)?.value;
  if (!token) redirect("/login");

  let userId: string;
  try {
    ({ userId } = await verifyJwt(token));
  } catch {
    redirect("/login");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user")
    .select("setup_complete")
    .eq("id", userId)
    .single();

  if (error || !data) redirect("/login");
  if (!data.setup_complete) redirect("/setup");

  const uncatCount = await getUncategorizedCount(userId);

  return (
    <AppShell badgeCounts={uncatCount > 0 ? { "/buckets": uncatCount } : {}}>
      {children}
    </AppShell>
  );
}
