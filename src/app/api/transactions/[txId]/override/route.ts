import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-server";
import { jsonError, jsonOk } from "@/lib/http";

type Params = { params: { txId: string } };

async function parseBucketId(request: NextRequest): Promise<string | null> {
  try {
    const body = (await request.json()) as { bucket_id: string };
    if (!body.bucket_id) return null;
    return body.bucket_id;
  } catch {
    return null;
  }
}

async function verifyBucketOwnership(userId: string, bucketId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("bucket").select("id").eq("id", bucketId).eq("user_id", userId).single();
  return !!data;
}

export async function POST(request: NextRequest, { params }: Params): Promise<Response> {
  let userId: string;
  try {
    ({ userId } = await requireAuth());
  } catch {
    return jsonError(401, "Unauthorized");
  }

  const bucketId = await parseBucketId(request);
  if (!bucketId) return jsonError(400, "bucket_id required");

  const owned = await verifyBucketOwnership(userId, bucketId);
  if (!owned) return jsonError(404, "Bucket not found");

  const supabase = createAdminClient();
  const { error } = await supabase.rpc("override_transaction_bucket", {
    p_tx_id: params.txId,
    p_new_bucket_id: bucketId,
    p_user_id: userId,
  });

  if (error) {
    if (error.message?.includes("transaction not found")) return jsonError(404, "Transaction not found");
    return jsonError(500, "Update failed");
  }
  return jsonOk({ ok: true });
}
