import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./supabase";

export function createServerSupabaseClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
}

/**
 * Admin client that bypasses RLS. Use only in trusted server contexts (API
 * routes, server actions). Never import in client components.
 *
 * NOTE: JWT_SECRET must match the Supabase dashboard JWT Secret setting so that
 * auth.uid() resolves correctly when using RLS-scoped clients in future sprints.
 *
 * Typed as any to avoid fighting Supabase's complex generic machinery — proper
 * generated types (supabase gen types) will replace this in a future sprint.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAdminClient(): ReturnType<typeof createClient<any>> {
  return createClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
