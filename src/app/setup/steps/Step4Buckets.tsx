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

export default function Step4Buckets({
  buckets,
  onChange,
  onNext,
}: {
  buckets: BucketDraft[];
  onChange: (b: BucketDraft[]) => void;
  onNext: () => void;
}): JSX.Element {
  const [error, setError] = useState("");

  function update(i: number, b: BucketDraft): void {
    const next = buckets.slice();
    next[i] = b;
    onChange(next);
  }

  function addCustom(): void {
    onChange([...buckets, customBucket(buckets.length + 1)]);
  }

  function remove(i: number): void {
    onChange(buckets.filter((_, idx) => idx !== i));
  }

  function handleNext(): void {
    if (totalPct(buckets) !== 100) {
      setError("Allocations must total exactly 100%.");
      return;
    }
    for (const b of buckets) {
      if (!b.name.trim()) {
        setError("Every bucket needs a name.");
        return;
      }
    }
    setError("");
    onNext();
  }

  const status = pctStatus(totalPct(buckets));

  return (
    <div className="w-full max-w-md">
      <h1 className="mb-2 text-2xl font-bold">Your buckets</h1>
      <p className="mb-6 text-sm text-gray-500">
        Split your weekly income across categories. Must total 100%.
      </p>
      {buckets.map((b, i) => (
        <Step4BucketRow
          key={i}
          bucket={b}
          onChange={(nb) => update(i, nb)}
          onRemove={b.type === "flex" ? () => remove(i) : undefined}
        />
      ))}
      <button
        onClick={addCustom}
        className="mb-4 w-full rounded-xl border py-3 text-sm text-gray-600"
      >
        + Add custom bucket
      </button>
      <p
        className={`mb-4 text-sm ${status.ok ? "text-gray-500" : "text-red-600"}`}
      >
        {status.label}
      </p>
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <button
        onClick={handleNext}
        disabled={!status.ok}
        className="w-full rounded-xl bg-black py-4 text-base font-semibold text-white disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}
