"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";
import { performLogin } from "@/lib/auth-client";

type Mode = "login" | "register";
type Status = "idle" | "loading" | "error";

function LoginFormStep({ mode, status, errorMsg, recoveryEmail, onEmailChange, onSubmit, onToggleMode }: {
  mode: Mode; status: Status; errorMsg: string; recoveryEmail: string;
  onEmailChange: (v: string) => void; onSubmit: () => void; onToggleMode: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-2xl font-bold">Budget App</h1>
        <p className="mb-6 text-sm text-gray-500">
          {mode === "login" ? "Sign in with your passkey." : "Create your passkey."}
        </p>
        {mode === "register" && (
          <input type="email" placeholder="Recovery email" value={recoveryEmail}
            onChange={(e) => onEmailChange(e.target.value)}
            className="mb-4 w-full rounded-xl border p-3 text-sm" />
        )}
        {errorMsg && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorMsg}</p>}
        <button onClick={onSubmit} disabled={status === "loading"}
          className="w-full rounded-xl bg-black py-4 text-base font-semibold text-white disabled:opacity-50">
          {status === "loading" ? "Waiting for biometric…" : mode === "login" ? "Sign in with passkey" : "Create passkey"}
        </button>
        <button onClick={onToggleMode} className="mt-4 w-full text-sm text-gray-500 underline">
          {mode === "login" ? "First time? Create an account" : "Already have an account? Sign in"}
        </button>
        {mode === "login" && (
          <a href="/recover" className="mt-3 block w-full text-center text-sm text-gray-400">
            Lost access? Recover account
          </a>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");

  async function handleLogin() {
    setStatus("loading"); setErrorMsg("");
    try { await performLogin(); router.push("/"); }
    catch (err) { setStatus("error"); setErrorMsg(err instanceof Error ? err.message : "Sign-in failed"); }
  }

  async function handleRegister() {
    if (!recoveryEmail.trim()) { setErrorMsg("Recovery email is required."); return; }
    setStatus("loading"); setErrorMsg("");
    try {
      const opts = await fetch("/api/auth/register/challenge", { method: "POST" }).then(r => r.json());
      const credential = await startRegistration(opts);
      const res = await fetch("/api/auth/register/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential, recoveryEmail: recoveryEmail.trim() }),
      });
      if (!res.ok) throw new Error("Registration failed");
      const { recoveryCode } = await res.json();
      sessionStorage.setItem("pendingRecoveryCode", recoveryCode);
      router.push("/setup");
    } catch (err) {
      setStatus("error"); setErrorMsg(err instanceof Error ? err.message : "Registration failed");
    }
  }

  return (
    <LoginFormStep mode={mode} status={status} errorMsg={errorMsg} recoveryEmail={recoveryEmail}
      onEmailChange={setRecoveryEmail} onSubmit={mode === "login" ? handleLogin : handleRegister}
      onToggleMode={() => { setMode(mode === "login" ? "register" : "login"); setErrorMsg(""); }} />
  );
}
