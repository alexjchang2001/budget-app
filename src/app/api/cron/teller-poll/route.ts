import { NextRequest } from "next/server";
import { pollTransactions, getAllTellerUserIds } from "@/lib/teller/polling";
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
  const results: Array<{ userId: string; inserted: number; skipped: number; error?: string }> = [];

  for (const userId of userIds) {
    try {
      const result = await pollTransactions(userId);
      results.push({ userId, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      results.push({ userId, inserted: 0, skipped: 0, error: message });
    }
  }

  return jsonOk({ ok: true, results });
}
