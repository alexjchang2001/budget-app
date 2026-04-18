import { createAdminClient } from "@/lib/supabase-server";
import {
  getAccounts,
  getTransactions,
  getBalances,
} from "@/lib/teller/client";
import { dollarsToCents } from "@/lib/money";

export type PollResult = { inserted: number; skipped: number };

async function upsertTransaction(
  tx: {
    id: string;
    account_id: string;
    amount: string;
    description: string;
    details: { counterparty?: { name?: string } };
    date: string;
    status: string;
  },
  userId: string
): Promise<boolean> {
  const supabase = createAdminClient();
  const amountCents = dollarsToCents(Math.abs(parseFloat(tx.amount)));
  const { error } = await supabase.from("transaction").insert({
    user_id: userId,
    teller_transaction_id: tx.id,
    amount: amountCents,
    description: tx.description,
    merchant_name: tx.details?.counterparty?.name ?? null,
    posted_at: new Date(tx.date).toISOString(),
  });

  // Duplicate key → already exists; not an error
  if (error) {
    if (error.code === "23505") return false;
    throw error;
  }
  return true;
}

export async function pollTransactions(userId: string): Promise<PollResult> {
  const accounts = await getAccounts(userId);
  let inserted = 0;
  let skipped = 0;

  for (const account of accounts) {
    const transactions = await getTransactions(account.id, userId);
    for (const tx of transactions) {
      const wasInserted = await upsertTransaction(tx, userId);
      if (wasInserted) {
        inserted++;
        // Enqueue classification — best-effort, don't block polling
        const base = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000";
        fetch(`${base}/api/transactions/classify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teller_transaction_id: tx.id }),
        }).catch(() => {});
      } else {
        skipped++;
      }
    }
  }

  return { inserted, skipped };
}

export async function pollBalances(userId: string): Promise<void> {
  const accounts = await getAccounts(userId);

  for (const account of accounts) {
    const balance = await getBalances(account.id, userId);
    // Full multi-account balance table deferred to Sprint 3 (Screen 1 needs it)
    // Log for observability in the meantime
    console.log(
      `[teller] balance user=${userId} account=${account.name} ` +
      `available=${balance.available} ledger=${balance.ledger}`
    );
  }
}

export async function getAllTellerUserIds(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user")
    .select("id")
    .not("teller_enrollment_id", "is", null)
    .eq("teller_sync_failed", false);
  if (error) throw error;
  return (data ?? []).map((r) => r.id);
}
