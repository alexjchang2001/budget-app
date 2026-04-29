"use client";

import { useState } from "react";
import type { TxItem, BucketRef } from "@/app/api/buckets/_helpers";

type Props = {
  tx: TxItem | null;
  allBuckets: BucketRef[];
  onClose: () => void;
  onOverrideSuccess: () => void;
};

export default function ClassifyBottomSheet({ tx, allBuckets, onClose, onOverrideSuccess }: Props): JSX.Element | null {
  const [pending, setPending] = useState(false);

  if (!tx) return null;

  async function handleSelect(bucketId: string) {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch(`/api/transactions/${tx!.id}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket_id: bucketId }),
      });
      if (res.ok) {
        onOverrideSuccess();
        onClose();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div
        className="w-full rounded-t-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4">
          <p className="text-xs text-gray-400">Currently: {tx.bucketName ?? "Uncategorized"}</p>
          <p className="font-semibold">{tx.merchantName || tx.description}</p>
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Assign to</p>
        <ul className="divide-y">
          {allBuckets.map((bucket) => (
            <li key={bucket.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => void handleSelect(bucket.id)}
                className="flex w-full items-center py-3 text-sm font-medium disabled:opacity-50"
              >
                {bucket.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
