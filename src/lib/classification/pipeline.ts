import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase-server";
import { TransactionRow } from "@/lib/supabase";
import { detectAndHandleDeposit } from "@/lib/classification/deposit-detection";
import {
  assembleExamples,
  buildBucketTypeMap,
  buildSystemPrompt,
  buildUserContent,
  BucketInfo,
} from "@/lib/classification/prompt";

type ClassifyResult = {
  bucketId: string | null;
  confidence: number | null;
  isDeposit: boolean;
};

type ClaudeOutput = {
  bucket_type: string;
  confidence: number;
  rationale: string;
};

async function fetchTxAndUser(txId: string): Promise<{
  tx: TransactionRow;
  user: { id: string; baseline_weekly_income: number };
  buckets: BucketInfo[];
} | null> {
  const supabase = createAdminClient();
  const { data: tx } = await supabase
    .from("transaction")
    .select("*")
    .eq("id", txId)
    .single();
  if (!tx) return null;

  const { data: user } = await supabase
    .from("user")
    .select("id, baseline_weekly_income")
    .eq("id", tx.user_id)
    .single();
  if (!user) return null;

  const { data: buckets } = await supabase
    .from("bucket")
    .select("id, type, name")
    .eq("user_id", user.id);

  return { tx: tx as TransactionRow, user, buckets: (buckets ?? []) as BucketInfo[] };
}

async function callClaude(
  tx: TransactionRow,
  systemPrompt: string
): Promise<ClaudeOutput | null> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    system: [
      {
        type: "text",
        text: systemPrompt,
        // Cache the stable system prompt (bucket defs + 10 examples)
        cache_control: { type: "ephemeral" },
      },
    ] as Parameters<typeof anthropic.messages.create>[0]["system"],
    messages: [{ role: "user", content: buildUserContent(tx) }],
  });

  const text =
    response.content[0]?.type === "text" ? response.content[0].text : null;
  if (!text) return null;

  try {
    return JSON.parse(text) as ClaudeOutput;
  } catch {
    return null;
  }
}

function applyConfidenceRouting(
  output: ClaudeOutput,
  bucketTypeMap: Map<string, string>
): { bucketId: string | null; confidence: number } {
  const bucketId = bucketTypeMap.get(output.bucket_type) ?? null;
  if (output.confidence >= 0.85) {
    return { bucketId, confidence: output.confidence };
  }
  if (output.confidence >= 0.6) {
    return { bucketId, confidence: output.confidence };
  }
  return { bucketId: null, confidence: output.confidence };
}

export async function classifyTransaction(txId: string): Promise<ClassifyResult> {
  const context = await fetchTxAndUser(txId);
  if (!context) return { bucketId: null, confidence: null, isDeposit: false };

  const { tx, user, buckets } = context;
  const supabase = createAdminClient();

  // Deposit detection runs first — if matched, skip classification
  const isDeposit = await detectAndHandleDeposit(tx, user);
  if (isDeposit) return { bucketId: null, confidence: null, isDeposit: true };

  const [examples, bucketTypeMap] = await Promise.all([
    assembleExamples(user.id),
    buildBucketTypeMap(user.id),
  ]);

  const systemPrompt = buildSystemPrompt(buckets, examples);
  const output = await callClaude(tx, systemPrompt);

  if (!output) return { bucketId: null, confidence: null, isDeposit: false };

  const { bucketId, confidence } = applyConfidenceRouting(output, bucketTypeMap);

  await supabase
    .from("transaction")
    .update({
      bucket_id: bucketId,
      classification_confidence: confidence,
    })
    .eq("id", txId);

  return { bucketId, confidence, isDeposit: false };
}
