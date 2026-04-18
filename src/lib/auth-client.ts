"use client";

import { startAuthentication } from "@simplewebauthn/browser";

/** Runs the full WebAuthn login challenge→assertion→verify flow. Throws on failure. */
export async function performLogin(): Promise<void> {
  const challengeRes = await fetch("/api/auth/login/challenge", { method: "POST" });
  const options = await challengeRes.json();
  const assertion = await startAuthentication(options);
  const verifyRes = await fetch("/api/auth/login/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(assertion),
  });
  if (!verifyRes.ok) {
    const data = await verifyRes.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? "Login failed");
  }
}
