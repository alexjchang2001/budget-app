import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { getChallengeCookieData, clearChallengeCookie, verifyPasskeyRegistration } from "@/lib/webauthn";
import { generateRecoveryBundle } from "@/lib/recovery";
import { signJwt } from "@/lib/jwt";
import { setAuthCookie } from "@/lib/auth";

/**
 * POST /api/auth/recover/complete
 * Body: new WebAuthn credential (from startRegistration during recovery flow).
 * Replaces old passkey on the existing user, regenerates single-use recovery code.
 * Issues an auth cookie so the user is immediately authenticated.
 * Returns new recovery code (shown once — must be displayed immediately).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { challenge, userId, isRecovery } = await getChallengeCookieData() as {
      challenge: string;
      userId: string;
      isRecovery: boolean;
    };

    if (!isRecovery) {
      return NextResponse.json({ error: "Invalid recovery session" }, { status: 400 });
    }

    const cred = await verifyPasskeyRegistration(body, challenge);
    if (!cred) {
      return NextResponse.json({ error: "Credential verification failed" }, { status: 400 });
    }

    const { code: newCode, salt: newSalt, hash: newHash } = generateRecoveryBundle();

    const supabase = createAdminClient();
    const [{ error }, token] = await Promise.all([
      supabase
        .from("user")
        .update({
          passkey_credential_id: cred.credentialId,
          passkey_public_key: cred.publicKey,
          passkey_counter: cred.counter,
          passkey_transports: cred.transports,
          recovery_code_hash: newHash,
          recovery_code_salt: newSalt,
        })
        .eq("id", userId),
      signJwt(userId),
    ]);

    if (error) {
      console.error("Recovery complete error:", error);
      return NextResponse.json({ error: "Failed to update credential" }, { status: 500 });
    }

    const response = NextResponse.json({ recoveryCode: newCode });
    setAuthCookie(response, token);
    clearChallengeCookie(response);
    return response;
  } catch (err) {
    console.error("Recovery complete error:", err);
    return NextResponse.json({ error: "Recovery failed" }, { status: 500 });
  }
}
