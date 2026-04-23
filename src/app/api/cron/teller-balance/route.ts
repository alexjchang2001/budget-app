import { NextRequest } from "next/server";
import { pollBalances, getAllTellerUserIds } from "@/lib/teller/polling";
import { verifyCronSecret } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(request: NextRequest): Promise<Response> {
  return POST(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!verifyCronSecret(request)) {
    return jsonError(401, "Unauthorized");
  }

  const userIds = await getAllTellerUserIds();
  const results: Array<{ userId: string; error?: string }> = [];

  for (const userId of userIds) {
    try {
      await pollBalances(userId);
      results.push({ userId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      results.push({ userId, error: message });
    }
  }

  return jsonOk({ ok: true, results });
}
