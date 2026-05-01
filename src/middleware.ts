import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { AUTH_COOKIE } from "@/lib/auth-cookie";

let _secret: Uint8Array | null = null;

function getSecret(): Uint8Array {
  if (_secret) return _secret;
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET not set");
  _secret = new TextEncoder().encode(s);
  return _secret;
}

function loginUrl(request: NextRequest): URL {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  return new URL("/login", base);
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) return NextResponse.redirect(loginUrl(request));

  try {
    await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
  } catch {
    return NextResponse.redirect(loginUrl(request));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/buckets/:path*", "/projection/:path*"],
};
