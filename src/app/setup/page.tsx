"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Step1Passkey from "./steps/Step1Passkey";
import Step2TellerConnect from "./steps/Step2TellerConnect";
import Step3Bills, { BillDraft } from "./steps/Step3Bills";
import Step4Buckets, { BucketDraft } from "./steps/Step4Buckets";
import Step5Income from "./steps/Step5Income";

type Step = 1 | 2 | 3 | 4 | 5;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DEFAULT_BUCKETS: BucketDraft[] = [
  { name: "Food", allocation_pct: 40, type: "food", deficit_floor_pct: 25, priority_order: 1 },
  { name: "Flex", allocation_pct: 40, type: "flex", deficit_floor_pct: null, priority_order: 2 },
  { name: "Savings", allocation_pct: 20, type: "savings", deficit_floor_pct: null, priority_order: 3 },
];

function validateIncome(baseline: string, min: string, max: string): string {
  const b = Number(baseline);
  const mn = Number(min);
  const mx = Number(max);
  if (!Number.isFinite(b) || b <= 0) return "Baseline weekly income must be > 0.";
  if (!Number.isFinite(mn) || mn <= 0) return "Per-shift minimum must be > 0.";
  if (!Number.isFinite(mx) || mx <= 0) return "Per-shift maximum must be > 0.";
  if (mn >= mx) return "Per-shift minimum must be less than maximum.";
  return "";
}

function toBillInput(b: BillDraft): { name: string; amount: number; due_day: number } {
  return {
    name: b.name.trim(),
    amount: Number(b.amount),
    due_day: Number(b.due_day),
  };
}

export default function SetupPage(): JSX.Element {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [bills, setBills] = useState<BillDraft[]>([]);
  const [buckets, setBuckets] = useState<BucketDraft[]>(DEFAULT_BUCKETS);
  const [baselineIncome, setBaselineIncome] = useState("");
  const [shiftMin, setShiftMin] = useState("");
  const [shiftMax, setShiftMax] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [installPromptReady, setInstallPromptReady] = useState(false);
  const installEventRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function handler(e: Event): void {
      e.preventDefault();
      installEventRef.current = e as BeforeInstallPromptEvent;
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleComplete(): Promise<void> {
    const validationError = validateIncome(baselineIncome, shiftMin, shiftMax);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/setup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bills: bills.map(toBillInput),
          buckets,
          baseline_income: Number(baselineIncome),
        }),
      });
      if (!res.ok) throw new Error("Setup failed");
      if (installEventRef.current) {
        setInstallPromptReady(true);
        try {
          await installEventRef.current.prompt();
          await installEventRef.current.userChoice;
        } catch {
          /* ignore */
        }
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-6 pt-12">
      <p className="mb-6 text-xs text-gray-400">Step {step} of 5</p>
      {step === 1 && <Step1Passkey onNext={() => setStep(2)} />}
      {step === 2 && <Step2TellerConnect onNext={() => setStep(3)} />}
      {step === 3 && (
        <Step3Bills bills={bills} onChange={setBills} onNext={() => setStep(4)} />
      )}
      {step === 4 && (
        <Step4Buckets
          buckets={buckets}
          onChange={setBuckets}
          onNext={() => setStep(5)}
        />
      )}
      {step === 5 && (
        <Step5Income
          baselineIncome={baselineIncome}
          onBaselineChange={setBaselineIncome}
          shiftMin={shiftMin}
          onShiftMinChange={setShiftMin}
          shiftMax={shiftMax}
          onShiftMaxChange={setShiftMax}
          error={error}
          loading={loading}
          onSubmit={handleComplete}
        />
      )}
      {installPromptReady && (
        <p className="mt-4 text-xs text-gray-400">Install Budget App for quick access…</p>
      )}
    </main>
  );
}
