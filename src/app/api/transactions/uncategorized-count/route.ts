import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUncategorizedCount } from "@/app/(app)/_helpers";

export async function GET(): Promise<NextResponse> {
  let userId: string;
  try {
    ({ userId } = await requireAuth());
  } catch {
    return new NextResponse(null, { status: 401 });
  }

  const count = await getUncategorizedCount(userId);
  return NextResponse.json({ count });
}
