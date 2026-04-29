import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { dollarsToCents } from "@/lib/money";
import {
  insertBills,
  insertBuckets,
  createAndAllocateWeek,
  bootstrapScheduleParse,
  finalizeUser,
  BillInput,
  BucketInput,
} from "./_helpers";

type CompleteBody = {
  bills: BillInput[];
  buckets: BucketInput[];
  baseline_income: number;
  per_shift_min: number;
  per_shift_max: number;
};

function parseBody(raw: unknown): CompleteBody | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Partial<CompleteBody>;
  if (!Array.isArray(b.bills) || !Array.isArray(b.buckets)) return null;
  if (typeof b.baseline_income !== "number" || b.baseline_income <= 0) return null;
  if (typeof b.per_shift_min !== "number" || b.per_shift_min <= 0) return null;
  if (typeof b.per_shift_max !== "number" || b.per_shift_max <= 0) return null;
  if (b.per_shift_min > b.per_shift_max) return null;
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
  if (!body) return jsonError(400, "bills, buckets, baseline_income, per_shift_min/max required");

  const incomeCents = dollarsToCents(body.baseline_income);
  const perShiftMinCents = dollarsToCents(body.per_shift_min);
  const perShiftMaxCents = dollarsToCents(body.per_shift_max);

  try {
    await Promise.all([insertBills(userId, body.bills), insertBuckets(userId, body.buckets)]);
    const weekId = await createAndAllocateWeek(userId, incomeCents);
    await Promise.all([
      bootstrapScheduleParse(userId, weekId, perShiftMinCents, perShiftMaxCents),
      finalizeUser(userId, incomeCents),
    ]);
    return jsonOk({ weekId });
  } catch {
    return jsonError(500, "Setup failed");
  }
}
