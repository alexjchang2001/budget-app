import { createAdminClient } from "@/lib/supabase-server";

export type BillItem = {
  billId: string;
  billStatusId: string;
  name: string;
  amount: number;
  dueDay: number;
  status: string;
  confirmedAt: string | null;
  confirmedBy: string | null;
};

export type TxItem = {
  id: string;
  amount: number;
  merchantName: string;
  description: string;
  postedAt: string;
  confidence: number | null;
  override: boolean;
  bucketId: string | null;
  bucketName: string | null;
};

export type BucketCard = {
  bucketId: string;
  name: string;
  type: string;
  allocatedAmount: number;
  spentAmount: number;
  transactions: TxItem[];
};

export type BucketRef = { id: string; name: string };

export type BucketsData = {
  weekId: string;
  bills: BillItem[];
  buckets: BucketCard[];
  uncategorized: TxItem[];
  roundingResidue: number;
  allBuckets: BucketRef[];
};

async function getCurrentWeek(userId: string) {
  const { data } = await createAdminClient()
    .from("week")
    .select("id, rounding_residue")
    .eq("user_id", userId)
    .order("week_start", { ascending: false })
    .limit(1)
    .single();
  return data;
}

async function getBills(weekId: string): Promise<BillItem[]> {
  const { data } = await createAdminClient()
    .from("bill_status")
    .select("id, status, confirmed_at, confirmed_by, bill!inner(id, name, amount, due_day_of_month)")
    .eq("week_id", weekId);
  return (data ?? []).map((row) => {
    const bill = row.bill as unknown as { id: string; name: string; amount: number; due_day_of_month: number };
    return {
      billId: bill.id,
      billStatusId: row.id as string,
      name: bill.name,
      amount: bill.amount,
      dueDay: bill.due_day_of_month,
      status: row.status as string,
      confirmedAt: row.confirmed_at as string | null,
      confirmedBy: row.confirmed_by as string | null,
    };
  });
}

async function getBucketCards(weekId: string): Promise<BucketCard[]> {
  const supabase = createAdminClient();
  const { data: allocs } = await supabase
    .from("bucket_allocation")
    .select("bucket_id, allocated_amount, spent_amount, bucket!inner(id, name, type)")
    .eq("week_id", weekId);

  const nonBillAllocs = (allocs ?? []).filter((row) => {
    const b = row.bucket as unknown as { type: string };
    return b.type !== "bills";
  });

  const { data: txRows } = await supabase
    .from("transaction")
    .select("id, amount, merchant_name, description, posted_at, classification_confidence, classification_override, bucket_id")
    .eq("week_id", weekId)
    .eq("is_direct_deposit", false)
    .not("bucket_id", "is", null);

  const txByBucket: Record<string, TxItem[]> = {};
  for (const tx of txRows ?? []) {
    const bId = tx.bucket_id as string;
    if (!txByBucket[bId]) txByBucket[bId] = [];
    txByBucket[bId].push({
      id: tx.id as string,
      amount: tx.amount as number,
      merchantName: tx.merchant_name as string,
      description: tx.description as string,
      postedAt: tx.posted_at as string,
      confidence: tx.classification_confidence as number | null,
      override: tx.classification_override as boolean,
      bucketId: tx.bucket_id as string,
      bucketName: null,
    });
  }

  return nonBillAllocs.map((row) => {
    const bucket = row.bucket as unknown as { id: string; name: string; type: string };
    const txs = (txByBucket[bucket.id] ?? []).map((t) => ({ ...t, bucketName: bucket.name }));
    return {
      bucketId: bucket.id,
      name: bucket.name,
      type: bucket.type,
      allocatedAmount: row.allocated_amount as number,
      spentAmount: row.spent_amount as number,
      transactions: txs,
    };
  });
}

async function getUncategorized(weekId: string): Promise<TxItem[]> {
  const { data } = await createAdminClient()
    .from("transaction")
    .select("id, amount, merchant_name, description, posted_at, classification_confidence, classification_override")
    .eq("week_id", weekId)
    .eq("is_direct_deposit", false)
    .is("bucket_id", null);
  return (data ?? []).map((tx) => ({
    id: tx.id as string,
    amount: tx.amount as number,
    merchantName: tx.merchant_name as string,
    description: tx.description as string,
    postedAt: tx.posted_at as string,
    confidence: tx.classification_confidence as number | null,
    override: tx.classification_override as boolean,
    bucketId: null,
    bucketName: null,
  }));
}

async function getAllBuckets(userId: string): Promise<BucketRef[]> {
  const { data } = await createAdminClient()
    .from("bucket")
    .select("id, name")
    .eq("user_id", userId)
    .neq("type", "bills")
    .order("priority_order");
  return (data ?? []).map((b) => ({ id: b.id as string, name: b.name as string }));
}

export async function getBucketsData(userId: string): Promise<BucketsData | null> {
  const week = await getCurrentWeek(userId);
  if (!week) return null;

  const weekId = week.id as string;
  const [bills, buckets, uncategorized, allBuckets] = await Promise.all([
    getBills(weekId),
    getBucketCards(weekId),
    getUncategorized(weekId),
    getAllBuckets(userId),
  ]);

  return {
    weekId,
    bills,
    buckets,
    uncategorized,
    roundingResidue: week.rounding_residue as number,
    allBuckets,
  };
}
