import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { RP_NAME, getRpId, setChallengeCookie } from "@/lib/webauthn";

/**
 * POST /api/auth/register/challenge
 * Generates WebAuthn registration options.
 * The challenge and a temporary userId are stored in a HMAC-signed cookie
 * so /verify can complete the handshake without tampering risk.
 */
export async function POST(): Promise<NextResponse> {
  const userId = crypto.randomUUID();
  const rpID = getRpId();

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: Buffer.from(userId),
    userName: "user",
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
      authenticatorAttachment: "platform",
    },
  });

  const response = NextResponse.json(options);
  await setChallengeCookie(response, { challenge: options.challenge, userId });
  return response;
}
