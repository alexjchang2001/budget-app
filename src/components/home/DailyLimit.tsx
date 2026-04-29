"use client";

import { getHomeColor } from "@/lib/ui/homeColors";
import { formatCents } from "@/lib/money";

const COLOR_CLASSES = {
  green: "text-green-600",
  amber: "text-amber-500",
  red: "text-red-600",
};

export default function DailyLimit({ dailyLimit, openingDailyLimit }: { dailyLimit: number; openingDailyLimit: number }): JSX.Element {
  const color = getHomeColor(dailyLimit, openingDailyLimit);
  return (
    <div className="flex flex-col items-center py-8">
      <p className="mb-1 text-sm text-gray-500">Today&apos;s limit</p>
      <p className={`text-6xl font-bold tabular-nums ${COLOR_CLASSES[color]}`}>
        {formatCents(dailyLimit)}
      </p>
    </div>
  );
}
