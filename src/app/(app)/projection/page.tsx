"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import ScheduleUpload from "@/components/projection/ScheduleUpload";
import ParseConfirmCard from "@/components/projection/ParseConfirmCard";
import WeekHistoryRow from "@/components/projection/WeekHistoryRow";
import { formatCents } from "@/lib/money";
import type { ProjectionData } from "@/app/api/projection/_helpers";
import type { ParseResult } from "@/components/projection/ScheduleUpload";

type ProjectionSectionProps = {
  data: ProjectionData;
  parseResult: ParseResult | null;
  onResult: (r: ParseResult) => void;
  onConfirmed: () => void;
  onDismiss: () => void;
};

function IncomeProjectionSection({ data, parseResult, onResult, onConfirmed, onDismiss }: ProjectionSectionProps): JSX.Element {
  return (
    <section className="mx-4 rounded-2xl border border-gray-200 bg-white p-4">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Income Projection</h2>
      <p className="mb-1 text-sm">
        Next week:{" "}
        <span className="font-semibold tabular-nums">
          {formatCents(data.incomeProjectedLow)}–{formatCents(data.incomeProjectedHigh)}
        </span>
      </p>
      <p className="mb-3 text-xs text-gray-400">Budget baseline: {formatCents(data.baselineWeeklyIncome)}</p>
      {!parseResult ? (
        <ScheduleUpload onResult={onResult} />
      ) : (
        <ParseConfirmCard
          result={parseResult}
          weekId={data.weekId}
          defaultPerShiftMin={data.lastPerShiftMin}
          defaultPerShiftMax={data.lastPerShiftMax}
          onConfirmed={onConfirmed}
          onDismiss={onDismiss}
        />
      )}
    </section>
  );
}

export default function ProjectionPage(): JSX.Element {
  const [data, setData] = useState<ProjectionData | null>(null);
  const [error, setError] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/projection");
      if (!res.ok) throw new Error("load failed");
      setData(await res.json());
    } catch {
      setError("Could not load projection data.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function handleConfirmed() { setParseResult(null); void load(); }

  if (error) return <AppShell><p className="p-6 text-center text-sm text-red-600">{error}</p></AppShell>;
  if (!data) return <AppShell><p className="p-6 text-center text-sm text-gray-400">Loading…</p></AppShell>;

  return (
    <AppShell>
      <main className="flex flex-col gap-4 pb-4 pt-4">
        <IncomeProjectionSection
          data={data} parseResult={parseResult}
          onResult={setParseResult} onConfirmed={handleConfirmed} onDismiss={() => setParseResult(null)}
        />
        <section className="mx-4 rounded-2xl border border-gray-200 bg-white">
          <h2 className="px-4 pt-4 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">History</h2>
          {data.closedWeeks.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-gray-400">Your history will appear here after your first full week.</p>
          ) : (
            <ul>{data.closedWeeks.map((week) => <li key={week.id}><WeekHistoryRow week={week} /></li>)}</ul>
          )}
        </section>
      </main>
    </AppShell>
  );
}
