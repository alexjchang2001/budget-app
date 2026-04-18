"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startRegistration } from "@simplewebauthn/browser";

type Step = "form" | "biometric" | "new-code";
type Status = "idle" | "loading" | "error";

async function verifyAndEnroll(
  email: string,
  code: string,
  onBiometric: () => void
): Promise<string> {
  const res = await fetch("/api/auth/recover/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? "Verification failed");
  }
  const options = await res.json();
  onBiometric();
  const credential = await startRegistration(options);
  const completeRes = await fetch("/api/auth/recover/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credential),
  });
  if (!completeRes.ok) {
    const data = await completeRes.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? "Failed to register new passkey");
  }
  const { recoveryCode } = await completeRes.json();
  return recoveryCode;
}

function NewCodeStep({ code, saved, onToggle, onDone }: {
  code: string; saved: boolean; onToggle: (v: boolean) => void; onDone: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-2xl font-bold">New recovery code</h1>
        <p className="mb-4 text-sm text-gray-500">
          Your passkey has been replaced. Save this new code — you will not see it again.
        </p>
        <div className="mb-6 rounded-xl bg-gray-100 p-4 text-center font-mono text-xl tracking-widest">
          {code}
        </div>
        <label className="mb-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={saved} onChange={(e) => onToggle(e.target.checked)} />
          I&apos;ve saved my new recovery code
        </label>
        <button onClick={onDone} disabled={!saved}
          className="w-full rounded-xl bg-black py-4 text-base font-semibold text-white disabled:opacity-40">
          Done
        </button>
      </div>
    </main>
  );
}

function RecoverFormView({ email, code, status, errorMsg, onEmail, onCode, onSubmit }: {
  email: string; code: string; status: Status; errorMsg: string;
  onEmail: (v: string) => void; onCode: (v: string) => void; onSubmit: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-2xl font-bold">Recover account</h1>
        <p className="mb-6 text-sm text-gray-500">
          Enter your recovery email and the 16-character code you saved at setup.
        </p>
        <input type="email" placeholder="Recovery email" value={email}
          onChange={(e) => onEmail(e.target.value)} className="mb-3 w-full rounded-xl border p-3 text-sm" />
        <input type="text" placeholder="Recovery code (16 characters)" value={code}
          onChange={(e) => onCode(e.target.value)} maxLength={16}
          className="mb-4 w-full rounded-xl border p-3 font-mono text-sm tracking-widest" />
        {errorMsg && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorMsg}</p>}
        <button onClick={onSubmit} disabled={status === "loading"}
          className="w-full rounded-xl bg-black py-4 text-base font-semibold text-white disabled:opacity-50">
          {status === "loading" ? "Verifying…" : "Recover account"}
        </button>
        <a href="/login" className="mt-4 block w-full text-center text-sm text-gray-400">
          Back to sign in
        </a>
      </div>
    </main>
  );
}

export default function RecoverPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [codeSaved, setCodeSaved] = useState(false);

  async function handleVerify() {
    if (!email.trim() || !code.trim()) { setErrorMsg("Both email and recovery code are required."); return; }
    setStatus("loading"); setErrorMsg("");
    try {
      const result = await verifyAndEnroll(email.trim(), code.trim(), () => { setStep("biometric"); setStatus("idle"); });
      setNewCode(result); setStep("new-code");
    } catch (err) {
      setStatus("error"); setErrorMsg(err instanceof Error ? err.message : "Recovery failed"); setStep("form");
    }
  }

  if (step === "new-code") {
    return <NewCodeStep code={newCode} saved={codeSaved} onToggle={setCodeSaved} onDone={() => router.push("/")} />;
  }
  if (step === "biometric") {
    return <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <p className="text-sm text-gray-500">Follow the biometric prompt to enroll your new passkey…</p>
    </main>;
  }
  return (
    <RecoverFormView email={email} code={code} status={status} errorMsg={errorMsg}
      onEmail={setEmail} onCode={setCode} onSubmit={handleVerify} />
  );
}
