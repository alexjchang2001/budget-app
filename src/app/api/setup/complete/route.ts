import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { dollarsToCents } from "@/lib/money";
import {
  insertBills,
  insertBuckets,
  createAndAllocateWeek,
  finalizeUser,
  BillInput,
  BucketInput,
} from "./_helpers";

type CompleteBody = {
  bills: BillInput[];
  buckets: BucketInput[];
  baseline_income: number;
};

function parseBody(raw: unknown): CompleteBody | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Partial<CompleteBody>;
  if (!Array.isArray(b.bills) || !Array.isArray(b.buckets)) return null;
  if (typeof b.baseline_income !== "number" || b.baseline_income <= 0) return null;
  return b as CompleteBody;
}

export async function POST(request: NextRequest): Promise<Response> {
  let userId: string;
  try {
    ({ userId } = await requireAuth());
  } catch {
    return jsonError(401, "Unauthorized");
  }

  let body: CompleteBody | null;
  try {
    body = parseBody(await request.json());
  } catch {
    return jsonError(400, "Invalid JSON");
  }
  if (!body) return jsonError(400, "bills, buckets, and baseline_income required");

  const incomeCents = dollarsToCents(body.baseline_income);
  try {
    await insertBills(userId, body.bills);
    await insertBuckets(userId, body.buckets);
    const weekId = await createAndAllocateWeek(userId, incomeCents);
    await finalizeUser(userId, incomeCents);
    return jsonOk({ weekId });
  } catch {
    return jsonError(500, "Setup failed");
  }
}
