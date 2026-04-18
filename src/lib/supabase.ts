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
  baseline_weekly_income: number;
  setup_complete: boolean;
  teller_enrollment_id: string | null;
  teller_access_token: string | null;
  teller_access_token_iv: string | null;
  teller_access_token_tag: string | null;
  teller_sync_failed: boolean;
  teller_degraded_since: string | null;
  created_at: string;
};

export type TransactionRow = {
  id: string;
  user_id: string;
  teller_transaction_id: string;
  amount: number;
  description: string;
  merchant_name: string;
  posted_at: string;
  week_id: string | null;
  bucket_id: string | null;
  classification_confidence: number | null;
  classification_override: boolean;
  is_direct_deposit: boolean;
  bill_id: string | null;
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
