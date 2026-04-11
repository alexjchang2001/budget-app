import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { createAdminClient } from "@/lib/supabase-server";
import { verifyRecoveryCode } from "@/lib/recovery";
import { RP_NAME, getRpId, setChallengeCookie } from "@/lib/webauthn";

/**
 * POST /api/auth/recover/verify
 * Body: { email: string, code: string }
 * Verifies recovery email + code (SHA-256 constant-time).
 * On success: returns a new WebAuthn registration challenge and stores
 * { challenge, userId, isRecovery: true } in the challenge cookie.
 * Returns 401 on any mismatch (no detail leaked).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { email, code } = await req.json() as { email: string; code: string };

    if (!email || !code) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: user } = await supabase
      .from("user")
      .select("id, recovery_code_hash, recovery_code_salt")
      .eq("recovery_email", email)
      .single();

    // Constant-time path: always run hash comparison even on miss
    const salt = user?.recovery_code_salt ?? "0".repeat(32);
    const storedHash = user?.recovery_code_hash ?? "0".repeat(64);
    const valid = user !== null && verifyRecoveryCode(code, salt, storedHash);

    if (!valid) {
      return NextResponse.json({ error: "Invalid email or recovery code" }, { status: 401 });
    }

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: getRpId(),
      userID: Buffer.from(user!.id),
      userName: "user",
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
        authenticatorAttachment: "platform",
      },
    });

    const response = NextResponse.json(options);
    await setChallengeCookie(response, {
      challenge: options.challenge,
      userId: user!.id,
      isRecovery: true,
    });
    return response;
  } catch (err) {
    console.error("Recovery verify error:", err);
    return NextResponse.json({ error: "Recovery failed" }, { status: 500 });
  }
}
