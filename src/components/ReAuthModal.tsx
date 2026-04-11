"use client";

import { useState } from "react";
import { performLogin } from "@/lib/auth-client";

interface ReAuthModalProps {
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Bottom sheet that performs silent WebAuthn re-authentication when the JWT
 * expires. Screen state is preserved — no navigation occurs.
 */
export function ReAuthModal({ onSuccess, onCancel }: ReAuthModalProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleReAuth() {
    setStatus("loading");
    setErrorMsg("");
    try {
      await performLogin();
      onSuccess();
    } catch {
      setStatus("error");
      setErrorMsg("Authentication failed. Please try again.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-lg font-semibold">Session expired</h2>
        <p className="mb-6 text-sm text-gray-500">
          Re-authenticate to continue where you left off.
        </p>
        {errorMsg && (
          <p className="mb-4 text-sm text-red-600">{errorMsg}</p>
        )}
        <div className="flex gap-3">
          <button
            onClick={handleReAuth}
            disabled={status === "loading"}
            className="flex-1 rounded-lg bg-black py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {status === "loading" ? "Authenticating…" : "Use passkey"}
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border px-4 py-3 text-sm font-medium text-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
