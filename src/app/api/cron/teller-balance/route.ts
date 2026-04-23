import { NextRequest } from "next/server";
import { pollBalances, getAllTellerUserIds } from "@/lib/teller/polling";

function verifyCronSecret(request: NextRequest): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET ?? "";
  return auth === `Bearer ${secret}` && secret.length > 0;
}

export async function GET(request: NextRequest): Promise<Response> {
  return POST(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!verifyCronSecret(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
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

  return new Response(JSON.stringify({ ok: true, results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
