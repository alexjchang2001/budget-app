import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-server";

type Params = { params: { txId: string } };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function parseBucketId(
  request: NextRequest
): Promise<string | Response> {
  try {
    const body = (await request.json()) as { bucket_id: string };
    if (!body.bucket_id) throw new Error("missing bucket_id");
    return body.bucket_id;
  } catch {
    return jsonResponse(400, { error: "bucket_id required" });
  }
}

async function verifyOwnership(
  userId: string,
  txId: string,
  bucketId: string
): Promise<Response | null> {
  const supabase = createAdminClient();
  const { data: tx } = await supabase
    .from("transaction")
    .select("id, user_id")
    .eq("id", txId)
    .eq("user_id", userId)
    .single();
  if (!tx) return jsonResponse(404, { error: "Transaction not found" });

  const { data: bucket } = await supabase
    .from("bucket")
    .select("id")
    .eq("id", bucketId)
    .eq("user_id", userId)
    .single();
  if (!bucket) return jsonResponse(404, { error: "Bucket not found" });
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: Params
): Promise<Response> {
  let userId: string;
  try {
    ({ userId } = await requireAuth());
  } catch {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  const bucketIdOrRes = await parseBucketId(request);
  if (bucketIdOrRes instanceof Response) return bucketIdOrRes;

  const ownership = await verifyOwnership(userId, params.txId, bucketIdOrRes);
  if (ownership) return ownership;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("transaction")
    .update({ bucket_id: bucketIdOrRes, classification_override: true })
    .eq("id", params.txId);

  if (error) return jsonResponse(500, { error: "Update failed" });
  return jsonResponse(200, { ok: true });
}
