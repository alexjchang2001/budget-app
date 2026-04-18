import { createBrowserClient } from "@supabase/ssr";

export type UserRow = {
  id: string;
  passkey_credential_id: string;
  passkey_public_key: string;
  passkey_counter: number;
  passkey_transports: string[];
  recovery_email: string | null;
  recovery_code_hash: string;
  recovery_code_salt: string;
  setup_complete: boolean;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      user: {
        Row: UserRow;
        Insert: Omit<UserRow, "created_at"> & { created_at?: string };
        Update: Partial<Omit<UserRow, "id" | "created_at">>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
