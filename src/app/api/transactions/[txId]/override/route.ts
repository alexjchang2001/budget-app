import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-server";

type Params = { params: { txId: string } };

export async function POST(
  request: NextRequest,
  { params }: Params
): Promise<Response> {
  let userId: string;
  try {
    ({ userId } = await requireAuth(request));
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let bucketId: string;
  try {
    const body = (await request.json()) as { bucket_id: string };
    bucketId = body.bucket_id;
    if (!bucketId) throw new Error("missing bucket_id");
  } catch {
    return new Response(JSON.stringify({ error: "bucket_id required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createAdminClient();
  const { txId } = params;

  // Verify the transaction belongs to this user
  const { data: tx } = await supabase
    .from("transaction")
    .select("id, user_id")
    .eq("id", txId)
    .eq("user_id", userId)
    .single();

  if (!tx) {
    return new Response(JSON.stringify({ error: "Transaction not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Verify bucket belongs to this user
  const { data: bucket } = await supabase
    .from("bucket")
    .select("id")
    .eq("id", bucketId)
    .eq("user_id", userId)
    .single();

  if (!bucket) {
    return new Response(JSON.stringify({ error: "Bucket not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { error } = await supabase
    .from("transaction")
    .update({
      bucket_id: bucketId,
      classification_override: true,
    })
    .eq("id", txId);

  if (error) {
    return new Response(JSON.stringify({ error: "Update failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
