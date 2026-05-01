import { SignJWT, jwtVerify } from "jose";

export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days
const JWT_EXPIRY = "7d";

// Lazy singleton — avoids re-encoding on every call while remaining test-friendly
// (tests set JWT_SECRET in beforeAll before any signJwt/verifyJwt call).
let _secret: Uint8Array | null = null;

function getSecret(): Uint8Array {
  if (_secret) return _secret;
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET environment variable is not set");
  _secret = new TextEncoder().encode(s);
  return _secret;
}

/** Issue a 7-day HS256 JWT. role: "authenticated" enables Supabase RLS via auth.uid(). */
export async function signJwt(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, role: "authenticated" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(getSecret());
}

/** Verify a JWT and return the userId (sub claim). Throws on invalid/expired. */
export async function verifyJwt(token: string): Promise<{ userId: string }> {
  const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
  const userId = payload.sub;
  if (typeof userId !== "string" || !userId) {
    throw new Error("Invalid JWT: missing sub claim");
  }
  return { userId };
}
