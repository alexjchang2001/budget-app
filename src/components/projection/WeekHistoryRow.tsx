"use client";

import { useState } from "react";
import { formatCents } from "@/lib/money";
import type { ClosedWeek } from "@/app/api/projection/_helpers";

function formatDateRange(start: string, end: string): string {
  const fmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const s = new Date(start).toLocaleDateString("en-US", fmt);
  const e = new Date(end).toLocaleDateString("en-US", fmt);
  return `${s} – ${e}`;
}

function DeficitBadge({ plan }: { plan: string | null }): JSX.Element | null {
  if (!plan) return null;
  const labels: Record<string, string> = {
    optimal: "Optimal",
    emergency: "Emergency",
    long_term_responsible: "Long-term",
  };
  return (
    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
      {labels[plan] ?? plan}
    </span>
  );
}

export default function WeekHistoryRow({ week }: { week: ClosedWeek }): JSX.Element {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="flex w-full flex-col gap-1 px-4 py-3 text-left"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{formatDateRange(week.weekStart, week.weekEnd)}</span>
          <DeficitBadge plan={week.deficitPlan} />
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{week.incomeActual !== null ? formatCents(week.incomeActual) : "No income recorded"}</span>
          <span>·</span>
          <span>{formatCents(week.totalSpent)} spent · {formatCents(week.totalAllocated)} allocated</span>
        </div>
      </button>

      {expanded && (
        <ul className="border-t bg-gray-50 px-4 py-2">
          {week.buckets.map((b) => (
            <li key={`${b.name}-${b.type}`} className="flex items-center justify-between py-1.5">
              <span className="text-sm capitalize">{b.name}</span>
              <span className="text-xs text-gray-500">
                {formatCents(b.spentAmount)} / {formatCents(b.allocatedAmount)}
              </span>
            </li>
          ))}
          {week.buckets.length === 0 && (
            <li className="py-2 text-sm text-gray-400">No bucket data.</li>
          )}
        </ul>
      )}
    </div>
  );
}
