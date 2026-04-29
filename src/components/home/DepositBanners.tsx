"use client";

import { useState } from "react";
import { formatCents } from "@/lib/money";

type RecentTx = { id: string; amount: number; merchant_name: string; description: string; posted_at: string; is_direct_deposit: boolean };

type Props = {
  weekStatus: string;
  syncError: boolean;
  recentTransactions: RecentTx[];
  falsePosDepositId: string | null;
  onDepositConfirmed: () => void;
};

async function correctDeposit(txId: string): Promise<void> {
  await fetch(`/api/transactions/${txId}/correct-deposit`, { method: "POST" });
}

async function confirmDeposit(txId: string): Promise<void> {
  await fetch("/api/deposits/manual-confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txId }),
  });
}

function FalsePosBanner({ txId, onDone }: { txId: string; onDone: () => void }): JSX.Element {
  const [err, setErr] = useState("");
  return (
    <div className="mx-4 rounded-lg bg-orange-50 p-3 text-sm">
      <p className="font-medium text-orange-800">Wrong deposit detected</p>
      <button
        onClick={() => correctDeposit(txId).then(onDone).catch(() => setErr("Failed — try again."))}
        className="mt-1 text-xs text-orange-600 underline"
      >
        Mark as not a deposit
      </button>
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}

function ManualConfirmSheet({ txs, onConfirm, onClose }: { txs: RecentTx[]; onConfirm: (id: string) => void; onClose: () => void }): JSX.Element {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40">
      <div className="w-full rounded-t-2xl bg-white p-6">
        <h3 className="mb-3 font-bold">Select your deposit</h3>
        {txs.map((tx) => (
          <button key={tx.id} onClick={() => onConfirm(tx.id)} className="mb-2 w-full rounded-xl border p-3 text-left text-sm">
            <span className="font-medium">{tx.merchant_name || tx.description}</span>
            <span className="ml-2 text-gray-500">{formatCents(tx.amount)}</span>
          </button>
        ))}
        <button onClick={onClose} className="mt-2 w-full text-sm text-gray-400">Cancel</button>
      </div>
    </div>
  );
}

export default function DepositBanners({ weekStatus, syncError, recentTransactions, falsePosDepositId, onDepositConfirmed }: Props): JSX.Element {
  const [showSheet, setShowSheet] = useState(false);
  const [confirmErr, setConfirmErr] = useState("");

  if (syncError) {
    return (
      <div className="mx-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
        Bank sync issue — tap to reconnect
      </div>
    );
  }

  if (falsePosDepositId) {
    return <FalsePosBanner txId={falsePosDepositId} onDone={onDepositConfirmed} />;
  }

  if (weekStatus === "projected") {
    const credits = recentTransactions.filter((t) => t.amount > 0);
    return (
      <>
        <div className="mx-4 rounded-lg bg-blue-50 p-3 text-sm">
          <p className="font-medium text-blue-800">Waiting for first deposit — showing estimate</p>
          {credits.length > 0 && (
            <button onClick={() => { setShowSheet(true); setConfirmErr(""); }} className="mt-1 text-xs text-blue-600 underline">
              Confirm deposit manually
            </button>
          )}
        </div>
        {confirmErr && <p className="mx-4 text-xs text-red-600">{confirmErr}</p>}
        {showSheet && (
          <ManualConfirmSheet
            txs={credits}
            onConfirm={(id) => {
              setShowSheet(false);
              confirmDeposit(id).then(onDepositConfirmed).catch(() => setConfirmErr("Confirm failed — try again."));
            }}
            onClose={() => setShowSheet(false)}
          />
        )}
      </>
    );
  }

  return <></>;
}
