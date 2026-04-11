import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { getChallengeCookieData, clearChallengeCookie, verifyPasskeyRegistration } from "@/lib/webauthn";
import { generateRecoveryBundle } from "@/lib/recovery";
import { signJwt } from "@/lib/jwt";
import { setAuthCookie } from "@/lib/auth";

/**
 * POST /api/auth/register/verify
 * Body: { credential: PublicKeyCredential, recoveryEmail: string }
 * Verifies WebAuthn credential, creates user row, stores recovery code hash.
 * Issues an auth cookie so the user can proceed to /setup authenticated.
 * Returns recoveryCode once — must be shown to user immediately.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const rawCredential = body.credential ?? body;
    const recoveryEmail: string = body.recoveryEmail ?? "";

    const { challenge, userId } = await getChallengeCookieData() as {
      challenge: string;
      userId: string;
    };

    const cred = await verifyPasskeyRegistration(rawCredential, challenge);
    if (!cred) {
      return NextResponse.json({ error: "Verification failed" }, { status: 400 });
    }

    const { code: recoveryCode, salt, hash: codeHash } = generateRecoveryBundle();

    const supabase = createAdminClient();
    const { error } = await supabase.from("user").insert({
      id: userId,
      passkey_credential_id: cred.credentialId,
      passkey_public_key: cred.publicKey,
      passkey_counter: cred.counter,
      passkey_transports: cred.transports,
      recovery_email: recoveryEmail,
      recovery_code_hash: codeHash,
      recovery_code_salt: salt,
      setup_complete: false,
    });

    if (error) {
      console.error("Failed to create user:", error);
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    const token = await signJwt(userId);
    const response = NextResponse.json({ userId, setupRequired: true, recoveryCode });
    setAuthCookie(response, token);
    clearChallengeCookie(response);
    return response;
  } catch (err) {
    console.error("Registration verify error:", err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
