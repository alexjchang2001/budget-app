"use client";

import { useState } from "react";
import Script from "next/script";

type Status = "idle" | "loading" | "success" | "error";

type TellerEnrollment = { accessToken: string; enrollment: { id: string } };
type TellerConnectOptions = {
  applicationId: string;
  onSuccess: (e: TellerEnrollment) => void;
  onExit: () => void;
};
type TellerConnectSdk = { setup: (opts: TellerConnectOptions) => { open: () => void } };

async function saveCredentials(enrollmentId: string, accessToken: string): Promise<void> {
  const res = await fetch("/api/setup/teller-connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enrollment_id: enrollmentId, access_token: accessToken }),
  });
  if (!res.ok) throw new Error("Failed to save credentials");
}

function handleConnect(setStatus: (s: Status) => void, onConnected: () => void): void {
  const sdk = (window as unknown as { TellerConnect?: TellerConnectSdk }).TellerConnect;
  if (!sdk) { setStatus("error"); return; }
  setStatus("loading");
  sdk.setup({
    applicationId: process.env.NEXT_PUBLIC_TELLER_APP_ID ?? "",
    onSuccess: async (enrollment) => {
      try {
        await saveCredentials(enrollment.enrollment.id, enrollment.accessToken);
        setStatus("success");
        setTimeout(() => onConnected(), 600);
      } catch { setStatus("error"); }
    },
    onExit: () => setStatus("idle"),
  }).open();
}

export default function ConnectBankBanner({ onConnected }: { onConnected: () => void }): JSX.Element {
  const [status, setStatus] = useState<Status>("idle");

  return (
    <div className="mx-4 rounded-2xl bg-amber-50 border border-amber-200 p-4">
      <Script src="https://cdn.teller.io/connect/connect.js" strategy="afterInteractive" />
      <p className="text-sm font-semibold text-amber-900 mb-1">Bank not connected</p>
      <p className="text-xs text-amber-700 mb-3">
        Connect your bank account to start tracking deposits and transactions automatically.
      </p>
      {status === "error" && (
        <p className="text-xs text-red-600 mb-2">Something went wrong. Try again.</p>
      )}
      {status === "success" && (
        <p className="text-xs text-green-600 mb-2">Connected!</p>
      )}
      <button
        onClick={() => handleConnect(setStatus, onConnected)}
        disabled={status === "loading" || status === "success"}
        className="w-full rounded-xl bg-amber-900 py-3 text-sm font-semibold text-white disabled:opacity-40"
      >
        {status === "loading" ? "Waiting…" : "Connect your bank"}
      </button>
    </div>
  );
}
