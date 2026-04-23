import { createAdminClient } from "@/lib/supabase-server";

type BucketAlloc = {
  bucket_id: string;
  allocated_amount: number;
  spent_amount: number;
  bucket: { type: string; priority_order: number; name: string };
};

// Hard-coded priority: Debt(1) → Savings(2) → Food(3) → Flex(4) → custom(5+)
const TYPE_PRIORITY: Record<string, number> = {
  debt: 1,
  savings: 2,
  food: 3,
  flex: 4,
};

export function sortBucketsByPriority<
  T extends { type: string; priority_order: number }
>(buckets: T[]): T[] {
  return [...buckets].sort((a, b) => {
    const pa = TYPE_PRIORITY[a.type] ?? 5 + a.priority_order;
    const pb = TYPE_PRIORITY[b.type] ?? 5 + b.priority_order;
    return pa - pb;
  });
}

export async function getPriorityOrderedBuckets(
  weekId: string
): Promise<BucketAlloc[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bucket_allocation")
    .select(
      "bucket_id, allocated_amount, spent_amount, bucket!inner(type, priority_order, name)"
    )
    .eq("week_id", weekId)
    .neq("bucket.type", "bills");

  if (error) throw error;

  const rows = (data ?? []) as unknown as BucketAlloc[];
  return [...rows].sort((a, b) => {
    const pa = TYPE_PRIORITY[a.bucket.type] ?? 5 + a.bucket.priority_order;
    const pb = TYPE_PRIORITY[b.bucket.type] ?? 5 + b.bucket.priority_order;
    return pa - pb;
  });
}

export async function rerouteFreedBillAmount(
  weekId: string,
  billsBucketId: string,
  targetBucketId: string | null,
  freedAmount: number,
  billId: string,
  confirmedBy: "user" | "teller",
  transactionId?: string
): Promise<void> {
  const supabase = createAdminClient();
  await supabase.rpc("confirm_bill_reroute", {
    p_week_id: weekId,
    p_bill_id: billId,
    p_bills_bucket_id: billsBucketId,
    p_target_bucket_id: targetBucketId ?? null,
    p_freed_amount: freedAmount,
    p_confirmed_by: confirmedBy,
    p_transaction_id: transactionId ?? null,
  });
}

export async function getBillsBucketId(weekId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("bucket_allocation")
    .select("bucket_id, bucket!inner(type)")
    .eq("week_id", weekId)
    .eq("bucket.type", "bills")
    .single();
  return (data?.bucket_id as string) ?? null;
}
