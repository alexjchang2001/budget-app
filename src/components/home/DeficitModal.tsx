"use client";

import { useState } from "react";
import { formatCents } from "@/lib/money";

type Plan = "optimal" | "emergency" | "long_term_responsible";

type PlanOption = { id: Plan; label: string; description: string };

const PLANS: PlanOption[] = [
  { id: "optimal", label: "Optimal", description: "Cut flex first, preserve debt & savings contributions." },
  { id: "emergency", label: "Emergency", description: "Minimum floors only — 5% debt, 3% savings, food priority." },
  { id: "long_term_responsible", label: "Long-term responsible", description: "Uniform cuts across all buckets, floor-protected." },
];

type Props = { weekId: string; dailyLimit: number; onPlanChosen: () => void };

async function submitPlan(weekId: string, plan: Plan): Promise<void> {
  const res = await fetch(`/api/weeks/${weekId}/deficit-plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  if (!res.ok) throw new Error("Failed to set plan");
}

function PlanCard({ option, selected, onSelect }: { option: PlanOption; selected: boolean; onSelect: () => void }): JSX.Element {
  return (
    <button
      onClick={onSelect}
      className={`mb-3 w-full rounded-xl border p-4 text-left transition-colors ${selected ? "border-black bg-gray-50" : "border-gray-200"}`}
    >
      <p className="font-semibold text-sm">{option.label}</p>
      <p className="mt-1 text-xs text-gray-500">{option.description}</p>
    </button>
  );
}

export default function DeficitModal({ weekId, dailyLimit, onPlanChosen }: Props): JSX.Element {
  const [selected, setSelected] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm(): Promise<void> {
    if (!selected) return;
    setLoading(true);
    try {
      await submitPlan(weekId, selected);
      onPlanChosen();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" style={{ pointerEvents: "all" }}>
      <div className="w-full rounded-t-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 text-xl font-bold">Budget deficit</h2>
        <p className="mb-2 text-sm text-gray-500">
          Your daily limit is <span className="font-semibold text-red-600">{formatCents(dailyLimit)}</span>. Choose a plan to continue.
        </p>
        {PLANS.map((p) => <PlanCard key={p.id} option={p} selected={selected === p.id} onSelect={() => setSelected(p.id)} />)}
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <button
          onClick={handleConfirm}
          disabled={!selected || loading}
          className="w-full rounded-xl bg-black py-4 text-base font-semibold text-white disabled:opacity-40"
        >
          {loading ? "Saving…" : "Confirm plan"}
        </button>
      </div>
    </div>
  );
}
