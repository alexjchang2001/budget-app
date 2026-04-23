import { NextResponse } from "next/server";

export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function jsonOk(body: Record<string, unknown>): NextResponse {
  return NextResponse.json(body);
}
