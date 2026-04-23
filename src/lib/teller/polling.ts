import { createAdminClient } from "@/lib/supabase-server";
import {
  getAccounts,
  getTransactions,
  getBalances,
} from "@/lib/teller/client";
import { classifyTransaction } from "@/lib/classification/pipeline";
import { dollarsToCents } from "@/lib/money";

export type PollResult = { inserted: number; skipped: number };

export async function upsertTransaction(
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
): Promise<string | null> {
  const supabase = createAdminClient();
  const amountCents = dollarsToCents(Math.abs(parseFloat(tx.amount)));
  const { data, error } = await supabase.from("transaction").insert({
    user_id: userId,
    teller_transaction_id: tx.id,
    amount: amountCents,
    description: tx.description,
    merchant_name: tx.details?.counterparty?.name ?? "",
    posted_at: new Date(tx.date).toISOString(),
  }).select("id").single();

  if (error) {
    if (error.code === "23505") return null;
    throw error;
  }
  return data?.id ?? null;
}

export async function pollTransactions(userId: string): Promise<PollResult> {
  const accounts = await getAccounts(userId);

  const perAccount = await Promise.all(
    accounts.map(async (account) => {
      const transactions = await getTransactions(account.id, userId);
      const ids = await Promise.all(transactions.map((tx) => upsertTransaction(tx, userId)));
      return ids;
    })
  );

  const insertedIds: string[] = [];
  let skipped = 0;
  for (const ids of perAccount) {
    for (const id of ids) {
      if (id) insertedIds.push(id);
      else skipped++;
    }
  }

  // Classify all newly inserted transactions in parallel
  await Promise.all(
    insertedIds.map((id) =>
      classifyTransaction(id).catch((err) => {
        console.error("classify error for tx", id, err);
      })
    )
  );

  return { inserted: insertedIds.length, skipped };
}

export async function pollBalances(userId: string): Promise<void> {
  const accounts = await getAccounts(userId);
  await Promise.all(
    accounts.map(async (account) => {
      const balance = await getBalances(account.id, userId);
      console.log(
        `[teller] balance user=${userId} account=${account.name} ` +
        `available=${balance.available} ledger=${balance.ledger}`
      );
    })
  );
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
