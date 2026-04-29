import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { getBucketsData } from "./_helpers";

export async function GET() {
  let userId: string;
  try { ({ userId } = await requireAuth()); } catch { return jsonError(401, "Unauthorized"); }

  const data = await getBucketsData(userId).catch(() => null);
  if (!data) return jsonError(404, "No active week");

  return jsonOk(data as unknown as Record<string, unknown>);
}
