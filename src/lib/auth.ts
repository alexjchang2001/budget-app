import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { verifyJwt, SESSION_DURATION_SECONDS } from "./jwt";

import { AUTH_COOKIE } from "./auth-cookie";
export { AUTH_COOKIE };

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  sameSite: "strict" as const,
};

/**
 * Server-side auth guard for API routes.
 * Reads the HttpOnly auth_token cookie and verifies the JWT.
 * Throws if missing or expired — callers should return 401.
 *
 * NOTE: cookies() is synchronous in Next.js 14 but becomes async in Next.js 15.
 * All callsites using cookies() directly will need to be updated on upgrade.
 */
export async function requireAuth(): Promise<{ userId: string }> {
  const token = cookies().get(AUTH_COOKIE)?.value;
  if (!token) throw new Error("Unauthorized: no auth cookie");
  return verifyJwt(token);
}

/** Attach a signed auth cookie to a NextResponse. */
export function setAuthCookie(res: NextResponse, token: string): void {
  res.cookies.set(AUTH_COOKIE, token, {
    ...COOKIE_OPTIONS,
    maxAge: SESSION_DURATION_SECONDS,
  });
}

/** Verify the CRON_SECRET Bearer token on internal cron/pipeline routes. */
export function verifyCronSecret(request: NextRequest): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET ?? "";
  return auth === `Bearer ${secret}` && secret.length > 0;
}

/** Clear the auth cookie (logout). Must mirror all attributes of setAuthCookie. */
export function clearAuthCookie(res: NextResponse): void {
  res.cookies.set(AUTH_COOKIE, "", {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  });
}
