"use client";

import { useState } from "react";

export type BillDraft = { name: string; amount: string; due_day: string };

export function emptyBill(): BillDraft {
  return { name: "", amount: "", due_day: "" };
}

function validateBills(bills: BillDraft[]): string | null {
  if (bills.length === 0) return "Add at least one bill.";
  for (const b of bills) {
    if (!b.name.trim()) return "Every bill needs a name.";
    const amt = Number(b.amount);
    if (!Number.isFinite(amt) || amt <= 0) return "Every bill needs an amount > 0.";
    const day = Number(b.due_day);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      return "Due day must be between 1 and 31.";
    }
  }
  return null;
}

function BillRow({
  bill,
  onChange,
  onRemove,
  canRemove,
}: {
  bill: BillDraft;
  onChange: (b: BillDraft) => void;
  onRemove: () => void;
  canRemove: boolean;
}): JSX.Element {
  return (
    <div className="mb-3 flex items-center gap-2">
      <input
        type="text"
        placeholder="Name"
        value={bill.name}
        onChange={(e) => onChange({ ...bill, name: e.target.value })}
        className="flex-1 rounded-xl border p-3 text-sm"
      />
      <input
        type="number"
        placeholder="$"
        value={bill.amount}
        onChange={(e) => onChange({ ...bill, amount: e.target.value })}
        className="w-20 rounded-xl border p-3 text-sm"
      />
      <input
        type="number"
        placeholder="Day"
        value={bill.due_day}
        onChange={(e) => onChange({ ...bill, due_day: e.target.value })}
        className="w-16 rounded-xl border p-3 text-sm"
      />
      <button
        onClick={onRemove}
        disabled={!canRemove}
        className="px-2 text-lg text-gray-400 disabled:opacity-30"
        aria-label="Remove bill"
      >
        ✕
      </button>
    </div>
  );
}

export default function Step3Bills({
  bills,
  onChange,
  onNext,
}: {
  bills: BillDraft[];
  onChange: (bills: BillDraft[]) => void;
  onNext: () => void;
}): JSX.Element {
  const [error, setError] = useState("");
  const rows = bills.length === 0 ? [emptyBill()] : bills;

  function update(i: number, b: BillDraft): void {
    const next = rows.slice();
    next[i] = b;
    onChange(next);
  }

  function add(): void {
    onChange([...rows, emptyBill()]);
  }

  function remove(i: number): void {
    if (rows.length <= 1) return;
    onChange(rows.filter((_, idx) => idx !== i));
  }

  function handleNext(): void {
    const err = validateBills(rows);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    onChange(rows);
    onNext();
  }

  return (
    <div className="w-full max-w-md">
      <h1 className="mb-2 text-2xl font-bold">Your monthly bills</h1>
      <p className="mb-6 text-sm text-gray-500">
        Rent, utilities, subscriptions — anything fixed each month.
      </p>
      {rows.map((b, i) => (
        <BillRow
          key={i}
          bill={b}
          onChange={(nb) => update(i, nb)}
          onRemove={() => remove(i)}
          canRemove={rows.length > 1}
        />
      ))}
      <button
        onClick={add}
        className="mb-4 w-full rounded-xl border py-3 text-sm text-gray-600"
      >
        + Add bill
      </button>
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <button
        onClick={handleNext}
        className="w-full rounded-xl bg-black py-4 text-base font-semibold text-white disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}
