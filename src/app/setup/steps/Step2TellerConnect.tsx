"use client";

import { useState } from "react";
import Script from "next/script";

type Status = "idle" | "loading" | "success" | "error";

type TellerEnrollment = {
  accessToken: string;
  enrollment: { id: string };
};

type TellerConnectOptions = {
  applicationId: string;
  onSuccess: (enrollment: TellerEnrollment) => void;
  onExit: () => void;
};

type TellerConnectSdk = {
  setup: (opts: TellerConnectOptions) => { open: () => void };
};

async function postTellerCredentials(
  enrollmentId: string,
  accessToken: string,
): Promise<void> {
  const res = await fetch("/api/setup/teller-connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      enrollment_id: enrollmentId,
      access_token: accessToken,
    }),
  });
  if (!res.ok) throw new Error("Failed to store credentials");
}

export default function Step2TellerConnect({
  onNext,
}: {
  onNext: () => void;
}): JSX.Element {
  const [status, setStatus] = useState<Status>("idle");

  function handleConnect(): void {
    const sdk = (window as unknown as { TellerConnect?: TellerConnectSdk })
      .TellerConnect;
    if (!sdk) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    sdk
      .setup({
        applicationId: process.env.NEXT_PUBLIC_TELLER_APP_ID ?? "",
        onSuccess: async (enrollment) => {
          try {
            await postTellerCredentials(
              enrollment.enrollment.id,
              enrollment.accessToken,
            );
            setStatus("success");
            setTimeout(() => onNext(), 600);
          } catch {
            setStatus("error");
          }
        },
        onExit: () => setStatus("idle"),
      })
      .open();
  }

  return (
    <div className="w-full max-w-sm">
      <Script
        src="https://cdn.teller.io/connect/connect.js"
        strategy="afterInteractive"
      />
      <h1 className="mb-2 text-2xl font-bold">Connect your bank</h1>
      <p className="mb-6 text-sm text-gray-500">
        We use Teller to securely link your account.
      </p>
      {status === "error" && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Something went wrong. Try again.
        </p>
      )}
      {status === "success" && (
        <p className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
          Connected! Continuing…
        </p>
      )}
      <button
        onClick={handleConnect}
        disabled={status === "loading" || status === "success"}
        className="w-full rounded-xl bg-black py-4 text-base font-semibold text-white disabled:opacity-40"
      >
        {status === "error" ? "Try again" : "Connect your bank"}
      </button>
    </div>
  );
}
