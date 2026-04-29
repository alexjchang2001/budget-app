"use client";

import { useState } from "react";
import { formatCents } from "@/lib/money";
import { getBucketColor } from "@/lib/ui/bucketColors";
import TransactionRow from "./TransactionRow";
import type { BucketCard as BucketCardData, TxItem } from "@/app/api/buckets/_helpers";

const BAR_COLORS = {
  green: "bg-green-500",
  amber: "bg-amber-400",
  red: "bg-red-500",
};

const LABEL_COLORS = {
  green: "text-green-600",
  amber: "text-amber-600",
  red: "text-red-600",
};

type Props = {
  bucket: BucketCardData;
  onTxTap: (tx: TxItem) => void;
};

export default function BucketCard({ bucket, onTxTap }: Props): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const color = getBucketColor(bucket.spentAmount, bucket.allocatedAmount);
  const pct = bucket.allocatedAmount > 0
    ? Math.min(100, Math.round((bucket.spentAmount / bucket.allocatedAmount) * 100))
    : 0;
  const remaining = bucket.allocatedAmount - bucket.spentAmount;

  return (
    <section className="mx-4 rounded-2xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="flex w-full flex-col gap-2 px-4 py-4 text-left"
      >
        <div className="flex items-center justify-between">
          <span className="font-semibold">{bucket.name}</span>
          <span className={`text-sm font-semibold tabular-nums ${LABEL_COLORS[color]}`}>{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div className={`h-full rounded-full ${BAR_COLORS[color]}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-gray-500">
          {formatCents(bucket.spentAmount)} spent · {formatCents(remaining)} remaining
        </p>
      </button>

      {expanded && bucket.transactions.length > 0 && (
        <ul className="divide-y border-t">
          {bucket.transactions.map((tx) => (
            <li key={tx.id}>
              <TransactionRow tx={tx} onTap={onTxTap} />
            </li>
          ))}
        </ul>
      )}
      {expanded && bucket.transactions.length === 0 && (
        <p className="border-t px-4 py-3 text-sm text-gray-400">No transactions yet.</p>
      )}
    </section>
  );
}
