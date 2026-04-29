"use client";

import { useState } from "react";
import Step4BucketRow from "./Step4BucketRow";

export type BucketDraft = {
  name: string;
  allocation_pct: number;
  type: string;
  deficit_floor_pct: number | null;
  priority_order: number;
};

function customBucket(order: number): BucketDraft {
  return {
    name: "",
    allocation_pct: 0,
    type: "custom",
    deficit_floor_pct: null,
    priority_order: order,
  };
}

function totalPct(buckets: BucketDraft[]): number {
  return buckets.reduce((s, b) => s + (Number(b.allocation_pct) || 0), 0);
}

function pctStatus(total: number): { label: string; ok: boolean } {
  if (total === 100) return { label: "100% allocated", ok: true };
  if (total < 100) return { label: `${100 - total}% unallocated`, ok: false };
  return { label: `${total - 100}% over`, ok: false };
}

type BucketsViewProps = {
  buckets: BucketDraft[]; status: { label: string; ok: boolean }; error: string;
  onUpdate: (i: number, b: BucketDraft) => void;
  onRemove: (i: number) => void; onAdd: () => void; onNext: () => void;
};

function BucketsView({ buckets, status, error, onUpdate, onRemove, onAdd, onNext }: BucketsViewProps): JSX.Element {
  return (
    <div className="w-full max-w-md">
      <h1 className="mb-2 text-2xl font-bold">Your buckets</h1>
      <p className="mb-6 text-sm text-gray-500">Split your weekly income across categories. Must total 100%.</p>
      {buckets.map((b, i) => (
        <Step4BucketRow key={i} bucket={b} onChange={(nb) => onUpdate(i, nb)} onRemove={b.type === "flex" ? () => onRemove(i) : undefined} />
      ))}
      <button onClick={onAdd} className="mb-4 w-full rounded-xl border py-3 text-sm text-gray-600">+ Add custom bucket</button>
      <p className={`mb-4 text-sm ${status.ok ? "text-gray-500" : "text-red-600"}`}>{status.label}</p>
      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button onClick={onNext} disabled={!status.ok} className="w-full rounded-xl bg-black py-4 text-base font-semibold text-white disabled:opacity-40">Next</button>
    </div>
  );
}

export default function Step4Buckets({ buckets, onChange, onNext }: { buckets: BucketDraft[]; onChange: (b: BucketDraft[]) => void; onNext: () => void }): JSX.Element {
  const [error, setError] = useState("");
  const update = (i: number, b: BucketDraft) => { const next = buckets.slice(); next[i] = b; onChange(next); };
  const remove = (i: number) => onChange(buckets.filter((_, idx) => idx !== i));
  const addCustom = () => onChange([...buckets, customBucket(buckets.length + 1)]);
  function handleNext(): void {
    if (totalPct(buckets) !== 100) { setError("Allocations must total exactly 100%."); return; }
    for (const b of buckets) { if (!b.name.trim()) { setError("Every bucket needs a name."); return; } }
    setError(""); onNext();
  }
  const status = pctStatus(totalPct(buckets));
  return <BucketsView buckets={buckets} status={status} error={error} onUpdate={update} onRemove={remove} onAdd={addCustom} onNext={handleNext} />;
}
