import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";

// AuthenticatorTransportFuture is not re-exported from @simplewebauthn/server v9
type AuthenticatorTransportFuture = "usb" | "ble" | "nfc" | "internal" | "hybrid" | "smart-card";
import { createAdminClient } from "@/lib/supabase-server";
import { getChallengeCookieData, clearChallengeCookie, getRpId, getOrigin } from "@/lib/webauthn";
import { signJwt } from "@/lib/jwt";
import { setAuthCookie } from "@/lib/auth";

/**
 * POST /api/auth/login/verify
 * Verifies the WebAuthn assertion.
 * On success: looks up the user by credential ID, issues a 7-day JWT cookie.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { challenge } = await getChallengeCookieData() as { challenge: string };

    const credentialId: string = body.id;
    const supabase = createAdminClient();

    const { data: user, error: userErr } = await supabase
      .from("user")
      .select("id, passkey_public_key, passkey_counter, passkey_transports")
      .eq("passkey_credential_id", credentialId)
      .single();

    if (userErr || !user) {
      return NextResponse.json({ error: "Unknown credential" }, { status: 401 });
    }

    const publicKeyBytes = Buffer.from(user.passkey_public_key, "base64url");

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challenge,
      expectedOrigin: getOrigin(),
      expectedRPID: getRpId(),
      requireUserVerification: true,
      authenticator: {
        credentialID: Buffer.from(credentialId, "base64url"),
        credentialPublicKey: publicKeyBytes,
        counter: user.passkey_counter,
        transports: user.passkey_transports as AuthenticatorTransportFuture[],
      },
    });

    if (!verification.verified) {
      return NextResponse.json({ error: "Assertion failed" }, { status: 401 });
    }

    const [updateResult, token] = await Promise.all([
      supabase
        .from("user")
        .update({ passkey_counter: verification.authenticationInfo.newCounter })
        .eq("id", user.id),
      signJwt(user.id),
    ]);

    if (updateResult.error) {
      console.error("Counter update error:", updateResult.error);
    }

    const response = NextResponse.json({ userId: user.id });
    setAuthCookie(response, token);
    clearChallengeCookie(response);
    return response;
  } catch (err) {
    console.error("Login verify error:", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
