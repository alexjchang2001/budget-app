import { createAdminClient } from "@/lib/supabase-server";
import { TransactionRow } from "@/lib/supabase";
import { centsToDollars } from "@/lib/money";

type SeedExample = {
  merchant_name?: string;
  keyword?: string;
  bucket_type: string;
  condition?: string;
};

type FormattedExample = {
  input: string;
  bucket_type: string;
  rationale: string;
};

export type BucketInfo = { id: string; type: string; name: string };

export async function buildBucketTypeMap(
  userId: string
): Promise<Map<string, string>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bucket")
    .select("id, type")
    .eq("user_id", userId);
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(row.type as string, row.id as string);
  }
  return map;
}

export async function assembleExamples(
  userId: string
): Promise<FormattedExample[]> {
  const supabase = createAdminClient();

  // User-confirmed examples first
  const { data: userTxs } = await supabase
    .from("transaction")
    .select("merchant_name, description, amount, bucket_id, bucket!inner(type, name)")
    .eq("user_id", userId)
    .eq("classification_override", true)
    .order("posted_at", { ascending: false })
    .limit(10);

  const examples: FormattedExample[] = (userTxs ?? []).map((tx) => ({
    input: `${tx.merchant_name || tx.description} | $${centsToDollars(tx.amount).toFixed(2)}`,
    bucket_type: (tx.bucket as { type: string }).type,
    rationale: `User confirmed as ${(tx.bucket as { name: string }).name}`,
  }));

  // Pad with seed examples if needed
  if (examples.length < 10) {
    const { data: config } = await supabase
      .from("classification_config")
      .select("seed_examples")
      .single();

    const seeds: SeedExample[] = config?.seed_examples ?? [];
    for (const seed of seeds) {
      if (examples.length >= 10) break;
      const input = seed.merchant_name
        ? `${seed.merchant_name}${seed.condition ? ` (${seed.condition.replace("amount_cents", "$").replace(">", "> ").replace("<=", "<= ")})` : ""}`
        : seed.keyword ?? "Unknown";
      examples.push({
        input,
        bucket_type: seed.bucket_type,
        rationale: seed.merchant_name
          ? `${seed.merchant_name} → ${seed.bucket_type}`
          : `Contains "${seed.keyword}" → ${seed.bucket_type}`,
      });
    }
  }

  return examples.slice(0, 10);
}

export function buildSystemPrompt(
  buckets: BucketInfo[],
  examples: FormattedExample[]
): string {
  const bucketList = buckets
    .map((b) => `- ${b.type} (${b.name})`)
    .join("\n");

  const exampleLines = examples
    .map(
      (e, i) =>
        `${i + 1}. Input: "${e.input}"\n   Output: {"bucket_type":"${e.bucket_type}","confidence":0.95,"rationale":"${e.rationale}"}`
    )
    .join("\n");

  return `You are a transaction classifier for a personal budget app.

Classify each transaction into one of these budget buckets:
${bucketList}

Return ONLY valid JSON — no markdown, no explanation outside the JSON object:
{"bucket_type": "<type>", "confidence": <0.00-1.00>, "rationale": "<brief reason>"}

Examples:
${exampleLines}`;
}

export function buildUserContent(
  tx: Pick<TransactionRow, "merchant_name" | "description" | "amount" | "posted_at">
): string {
  const date = tx.posted_at.split("T")[0];
  const merchant = tx.merchant_name || tx.description || "Unknown";
  const dollars = centsToDollars(tx.amount).toFixed(2);
  return `Classify this transaction:\nMerchant: ${merchant}\nAmount: $${dollars}\nDescription: ${tx.description}\nDate: ${date}`;
}
