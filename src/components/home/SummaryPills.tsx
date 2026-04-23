"use client";

function Pill({ label }: { label: string }): JSX.Element {
  return (
    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
      {label}
    </span>
  );
}

export default function SummaryPills({ billsPaid, billsTotal, debtPct, savingsPct }: {
  billsPaid: number; billsTotal: number; debtPct: number; savingsPct: number;
}): JSX.Element {
  return (
    <div className="flex flex-wrap justify-center gap-2 px-4">
      <Pill label={`Bills ${billsPaid}/${billsTotal} paid`} />
      <Pill label={`Debt ${debtPct}%`} />
      <Pill label={`Savings ${savingsPct}%`} />
    </div>
  );
}
