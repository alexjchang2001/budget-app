"use client";

import { formatCents } from "@/lib/money";

function daysUntilFriday(): number {
  const day = new Date().getUTCDay(); // 0=Sun … 6=Sat
  return (5 - day + 7) % 7 || 7;
}

export default function PaydayCountdown({ weekStatus, incomeActual, incomeProjectedLow, incomeProjectedHigh }: {
  weekStatus: string;
  incomeActual: number | null;
  incomeProjectedLow: number;
  incomeProjectedHigh: number;
}): JSX.Element {
  if (incomeActual !== null) {
    return (
      <p className="text-center text-sm text-gray-600">
        This week: <span className="font-semibold">{formatCents(incomeActual)}</span> deposited
      </p>
    );
  }

  if (weekStatus === "projected") {
    const low = formatCents(incomeProjectedLow);
    const high = formatCents(incomeProjectedHigh);
    return (
      <p className="text-center text-sm text-gray-500">
        Payday — waiting on deposit · Projected ~{low}–{high}
      </p>
    );
  }

  const days = daysUntilFriday();
  return (
    <p className="text-center text-sm text-gray-500">
      Payday in <span className="font-semibold">{days}</span> {days === 1 ? "day" : "days"}
    </p>
  );
}
