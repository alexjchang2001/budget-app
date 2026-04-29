"use client";

import { useState } from "react";
import { formatCents } from "@/lib/money";
import type { BillItem } from "@/app/api/buckets/_helpers";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type RowProps = { bill: BillItem; onConfirmed: () => void };

function BillRow({ bill, onConfirmed }: RowProps): JSX.Element {
  const [pending, setPending] = useState(false);

  async function markPaid() {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch(`/api/bills/${bill.billId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed_by: "user" }),
      });
      if (res.ok) onConfirmed();
    } finally {
      setPending(false);
    }
  }

  const isPaid = bill.status !== "unpaid";

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${isPaid ? "bg-green-500" : "bg-gray-400"}`} />
        <div>
          <p className="text-sm font-medium">{bill.name}</p>
          <p className="text-xs text-gray-400">Due day {bill.dueDay}</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-sm tabular-nums">{formatCents(bill.amount)}</span>
        {bill.status === "teller_confirmed" && (
          <span className="text-xs text-green-600">Teller confirmed {formatDate(bill.confirmedAt)}</span>
        )}
        {bill.status === "manually_confirmed" && (
          <span className="text-xs text-green-600">Marked paid {formatDate(bill.confirmedAt)}</span>
        )}
        {bill.status === "unpaid" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => void markPaid()}
            className="rounded bg-black px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
          >
            Mark as paid
          </button>
        )}
      </div>
    </div>
  );
}

type Props = { bills: BillItem[]; onRefresh: () => void };

export default function BillsBucket({ bills, onRefresh }: Props): JSX.Element {
  return (
    <section className="mx-4 rounded-2xl border border-gray-200 bg-white">
      <h2 className="px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Bills</h2>
      {bills.length === 0 && (
        <p className="px-4 py-3 text-sm text-gray-400">No bills this week.</p>
      )}
      <ul className="divide-y">
        {bills.map((bill) => (
          <li key={bill.billId}>
            <BillRow bill={bill} onConfirmed={onRefresh} />
          </li>
        ))}
      </ul>
    </section>
  );
}
