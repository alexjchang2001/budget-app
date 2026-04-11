import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getRpId, setChallengeCookie } from "@/lib/webauthn";

/**
 * POST /api/auth/login/challenge
 * Generates WebAuthn authentication options (discoverable credential flow).
 * Empty allowCredentials lets the OS prompt for any registered passkey.
 * Challenge is stored in a HMAC-signed cookie.
 */
export async function POST(): Promise<NextResponse> {
  const options = await generateAuthenticationOptions({
    rpID: getRpId(),
    userVerification: "required",
    allowCredentials: [],
  });

  const response = NextResponse.json(options);
  await setChallengeCookie(response, { challenge: options.challenge });
  return response;
}
