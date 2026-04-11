import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import {
  verifyRegistrationResponse,
} from "@simplewebauthn/server";

export const RP_NAME = "Budget App";

// CHALLENGE_COOKIE is intentionally not exported — use clearChallengeCookie().
const CHALLENGE_COOKIE = "webauthn_challenge";

// Lazy singleton — avoids re-encoding JWT_SECRET on every request.
let _secret: Uint8Array | null = null;

function getChallengeSecret(): Uint8Array {
  if (_secret) return _secret;
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET not set");
  _secret = new TextEncoder().encode(s);
  return _secret;
}

export function getRpId(): string {
  return process.env.WEBAUTHN_RP_ID ?? "localhost";
}

export function getOrigin(): string {
  return process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";
}

/** Store a HMAC-signed (HS256, 5-min TTL) challenge payload in an HttpOnly cookie. */
export async function setChallengeCookie(
  res: NextResponse,
  data: Record<string, unknown>
): Promise<void> {
  const signed = await new SignJWT(data)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("5m")
    .sign(getChallengeSecret());

  res.cookies.set(CHALLENGE_COOKIE, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 300,
    path: "/",
    sameSite: "strict",
  });
}

/** Read, verify signature, and parse the challenge cookie. Throws if missing/expired/tampered. */
export async function getChallengeCookieData(): Promise<Record<string, unknown>> {
  const raw = cookies().get(CHALLENGE_COOKIE)?.value;
  if (!raw) throw new Error("Missing WebAuthn challenge cookie");
  const { payload } = await jwtVerify(raw, getChallengeSecret());
  return payload as Record<string, unknown>;
}

/** Delete the challenge cookie after it has been consumed. */
export function clearChallengeCookie(res: NextResponse): void {
  res.cookies.delete(CHALLENGE_COOKIE);
}

// Extract the response type from verifyRegistrationResponse rather than
// importing RegistrationResponseJSON which is not re-exported in v9.
type RegistrationResponse = Parameters<typeof verifyRegistrationResponse>[0]["response"];

/**
 * Verify a WebAuthn registration response and return normalized credential fields.
 * Returns null if the credential fails verification (caller should return 400).
 * Shared by the initial registration and recovery re-enrollment flows.
 */
export async function verifyPasskeyRegistration(
  body: unknown,
  challenge: string
): Promise<{ credentialId: string; publicKey: string; transports: string[]; counter: number } | null> {
  const verification = await verifyRegistrationResponse({
    response: body as RegistrationResponse,
    expectedChallenge: challenge,
    expectedOrigin: getOrigin(),
    expectedRPID: getRpId(),
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) return null;

  const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
  // transports is present at runtime in v9 but not reflected in older type definitions
  const transports: string[] = (verification.registrationInfo as Record<string, unknown>).transports as string[] ?? [];

  return {
    credentialId: Buffer.from(credentialID).toString("base64url"),
    publicKey: Buffer.from(credentialPublicKey).toString("base64url"),
    transports,
    counter,
  };
}
