"use client";

import { useCallback, useEffect, useState } from "react";
import BillsBucket from "@/components/buckets/BillsBucket";
import BucketCard from "@/components/buckets/BucketCard";
import TransactionRow from "@/components/buckets/TransactionRow";
import ClassifyBottomSheet from "@/components/buckets/ClassifyBottomSheet";
import { formatCents } from "@/lib/money";
import type { BucketsData, TxItem } from "@/app/api/buckets/_helpers";

function UncategorizedSection({ txs, onTap }: { txs: TxItem[]; onTap: (tx: TxItem) => void }): JSX.Element {
  return (
    <section className="mx-4 rounded-2xl border border-gray-200 bg-white">
      <h2 className="px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Uncategorized
        <span className="ml-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white">{txs.length}</span>
      </h2>
      <ul className="divide-y">
        {txs.map((tx) => (
          <li key={tx.id}><TransactionRow tx={tx} onTap={onTap} /></li>
        ))}
      </ul>
    </section>
  );
}

export default function BucketsPage(): JSX.Element {
  const [data, setData] = useState<BucketsData | null>(null);
  const [error, setError] = useState("");
  const [activeTx, setActiveTx] = useState<TxItem | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/buckets");
      if (!res.ok) throw new Error("load failed");
      setData(await res.json());
    } catch {
      setError("Could not load buckets.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (error) return <p className="p-6 text-center text-sm text-red-600">{error}</p>;
  if (!data) return <p className="p-6 text-center text-sm text-gray-400">Loading…</p>;

  const uncatCount = data.uncategorized.length;

  return (
    <>
      <main className="flex flex-col gap-4 pb-4 pt-4">
        <BillsBucket bills={data.bills} onRefresh={load} />
        {data.buckets.map((bucket) => (
          <BucketCard key={bucket.bucketId} bucket={bucket} onTxTap={setActiveTx} />
        ))}
        {uncatCount > 0 && <UncategorizedSection txs={data.uncategorized} onTap={setActiveTx} />}
        {data.roundingResidue !== 0 && (
          <p className="px-6 text-center text-xs text-gray-400">Rounding buffer: {formatCents(data.roundingResidue)}</p>
        )}
      </main>
      <ClassifyBottomSheet tx={activeTx} allBuckets={data.allBuckets} onClose={() => setActiveTx(null)} onOverrideSuccess={load} />
    </>
  );
}
