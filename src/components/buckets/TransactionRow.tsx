"use client";

import { formatCents } from "@/lib/money";
import type { TxItem } from "@/app/api/buckets/_helpers";

function ConfidenceBadge({ confidence }: { confidence: number | null }): JSX.Element | null {
  if (confidence === null || confidence >= 0.85) return null;
  if (confidence >= 0.6) {
    return (
      <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
        Confirm?
      </span>
    );
  }
  return (
    <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
      {Math.round(confidence * 100)}% sure
    </span>
  );
}

type Props = {
  tx: TxItem;
  onTap?: (tx: TxItem) => void;
};

export default function TransactionRow({ tx, onTap }: Props): JSX.Element {
  const needsReview = tx.confidence !== null && tx.confidence < 0.85 && !tx.override;
  const tappable = needsReview || tx.bucketId === null;
  const date = new Date(tx.postedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <button
      type="button"
      onClick={() => tappable && onTap?.(tx)}
      className="flex w-full items-center justify-between px-4 py-2 text-left"
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium">{tx.merchantName || tx.description}</span>
        <span className="text-xs text-gray-400">{date}</span>
      </div>
      <div className="flex items-center">
        <span className="text-sm tabular-nums">{formatCents(tx.amount)}</span>
        <ConfidenceBadge confidence={needsReview ? tx.confidence : null} />
      </div>
    </button>
  );
}
