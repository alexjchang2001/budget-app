"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import DailyLimit from "@/components/home/DailyLimit";
import PaydayCountdown from "@/components/home/PaydayCountdown";
import SummaryPills from "@/components/home/SummaryPills";
import DeficitModal from "@/components/home/DeficitModal";
import DepositBanners from "@/components/home/DepositBanners";
import OfflineBanner from "@/components/home/OfflineBanner";

type HomeData = {
  weekId: string; weekStatus: string; dailyLimit: number; openingDailyLimit: number;
  deficitPlan: string | null; incomeActual: number | null;
  incomeProjectedLow: number; incomeProjectedHigh: number;
  billsPaid: number; billsTotal: number; debtPct: number; savingsPct: number;
  syncError: boolean;
  recentTransactions: { id: string; amount: number; merchant_name: string; description: string; posted_at: string; is_direct_deposit: boolean }[];
};

function findFalsePosDepositId(data: HomeData): string | null {
  const deposits = data.recentTransactions.filter((t) => t.is_direct_deposit);
  if (deposits.length <= 1) return null;
  const sorted = [...deposits].sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime());
  return sorted[1]?.id ?? null;
}

export default function HomePage(): JSX.Element {
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState("");
  const fetchedAt = useRef(Date.now());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/home");
      if (!res.ok) throw new Error("load failed");
      setData(await res.json());
      fetchedAt.current = Date.now();
    } catch {
      setError("Could not load home data.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (error) return <AppShell><p className="p-6 text-center text-sm text-red-600">{error}</p></AppShell>;
  if (!data) return <AppShell><p className="p-6 text-center text-sm text-gray-400">Loading…</p></AppShell>;

  const showDeficit = data.deficitPlan === null && data.dailyLimit < 0;
  const falsePosId = findFalsePosDepositId(data);

  return (
    <AppShell>
      <main className="flex flex-col gap-4 pb-4">
        <OfflineBanner lastUpdated={fetchedAt.current} />
        <DailyLimit dailyLimit={data.dailyLimit} openingDailyLimit={data.openingDailyLimit} />
        <PaydayCountdown weekStatus={data.weekStatus} incomeActual={data.incomeActual}
          incomeProjectedLow={data.incomeProjectedLow} incomeProjectedHigh={data.incomeProjectedHigh} />
        <SummaryPills billsPaid={data.billsPaid} billsTotal={data.billsTotal} debtPct={data.debtPct} savingsPct={data.savingsPct} />
        <DepositBanners weekStatus={data.weekStatus} syncError={data.syncError}
          recentTransactions={data.recentTransactions} falsePosDepositId={falsePosId} onDepositConfirmed={load} />
        {showDeficit && <DeficitModal weekId={data.weekId} dailyLimit={data.dailyLimit} onPlanChosen={load} />}
      </main>
    </AppShell>
  );
}
