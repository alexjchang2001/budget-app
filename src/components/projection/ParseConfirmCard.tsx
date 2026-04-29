"use client";

import { useState } from "react";
import { formatCents } from "@/lib/money";
import type { ParseResult } from "./ScheduleUpload";

type Props = {
  result: ParseResult;
  weekId: string;
  defaultPerShiftMin: number;
  defaultPerShiftMax: number;
  onConfirmed: () => void;
  onDismiss: () => void;
};

function RangeInputs({ minVal, maxVal, onMinChange, onMaxChange }: {
  minVal: string; maxVal: string;
  onMinChange: (v: string) => void; onMaxChange: (v: string) => void;
}): JSX.Element {
  return (
    <div className="flex gap-3">
      <label className="flex flex-1 flex-col gap-1">
        <span className="text-xs text-gray-500">Min per shift ($)</span>
        <input type="number" min="0" step="0.01" value={minVal} onChange={(e) => onMinChange(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm" placeholder="0.00" />
      </label>
      <label className="flex flex-1 flex-col gap-1">
        <span className="text-xs text-gray-500">Max per shift ($)</span>
        <input type="number" min="0" step="0.01" value={maxVal} onChange={(e) => onMaxChange(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm" placeholder="0.00" />
      </label>
    </div>
  );
}

function ParseStatusHeader({ result, manualCount, onChange }: {
  result: ParseResult; manualCount: string; onChange: (v: string) => void;
}): JSX.Element | null {
  if (result.status === "ok") {
    return (
      <div className="mb-3">
        <p className="font-semibold">{result.shiftCount} shifts detected</p>
        <p className="text-sm text-gray-500">{result.shiftDays.join(", ")}</p>
      </div>
    );
  }
  const isLow = result.status === "low";
  return (
    <div className="mb-3">
      <p className={`font-semibold ${isLow ? "text-amber-600" : "text-red-600"}`}>
        {isLow ? "Couldn’t read your schedule clearly" : "Something went wrong"}
      </p>
      <p className="mb-2 text-sm text-gray-500">
        {isLow ? "Enter your shift count manually." : "Try a clearer screenshot or enter shifts manually."}
      </p>
      <input type="number" min="1" value={manualCount} onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border px-3 py-2 text-sm" placeholder="Number of shifts" />
    </div>
  );
}

function useConfirmLogic(result: ParseResult, weekId: string, onConfirmed: () => void) {
  const [manualCount, setManualCount] = useState(
    result.status === "low" && result.shiftCount > 0 ? String(result.shiftCount) : ""
  );
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState("");

  const isManual = result.status !== "ok";
  const shiftCount = isManual ? parseInt(manualCount || "0", 10) : result.shiftCount;

  async function handleConfirm(perShiftMin: number, perShiftMax: number) {
    if (perShiftMin <= 0 || perShiftMax <= 0 || perShiftMin > perShiftMax) {
      setErr("Enter a valid min/max range (min ≤ max)."); return;
    }
    if (isManual && shiftCount < 1) { setErr("Enter shift count."); return; }
    setPending(true); setErr("");
    try {
      let parseId: string;
      const reuseParse = result.status === "ok" || (result.status === "low" && shiftCount === result.shiftCount);
      if (reuseParse && "parseId" in result) {
        parseId = result.parseId;
      } else {
        const r = await fetch("/api/schedule/manual-parse", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shift_count: shiftCount, week_id: weekId }),
        });
        if (!r.ok) { setErr("Could not save. Try again."); return; }
        parseId = ((await r.json()) as { parse_id: string }).parse_id;
      }
      const r2 = await fetch("/api/schedule/confirm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parse_id: parseId, per_shift_min: perShiftMin, per_shift_max: perShiftMax, week_id: weekId }),
      });
      if (!r2.ok) { setErr("Confirm failed. Try again."); return; }
      onConfirmed();
    } finally {
      setPending(false);
    }
  }

  return { manualCount, setManualCount, pending, err, shiftCount, handleConfirm };
}

export default function ParseConfirmCard({ result, weekId, defaultPerShiftMin, defaultPerShiftMax, onConfirmed, onDismiss }: Props): JSX.Element {
  const defaultMin = defaultPerShiftMin > 0 ? (defaultPerShiftMin / 100).toFixed(2) : "";
  const defaultMax = defaultPerShiftMax > 0 ? (defaultPerShiftMax / 100).toFixed(2) : "";
  const [minVal, setMinVal] = useState(defaultMin);
  const [maxVal, setMaxVal] = useState(defaultMax);
  const { manualCount, setManualCount, pending, err, shiftCount, handleConfirm } = useConfirmLogic(result, weekId, onConfirmed);

  const perShiftMin = parseFloat(minVal || "0");
  const perShiftMax = parseFloat(maxVal || "0");
  const projLow = Math.round(perShiftMin * shiftCount * 100);
  const projHigh = Math.round(perShiftMax * shiftCount * 100);

  return (
    <div className="mx-4 rounded-2xl border border-gray-200 bg-white p-4">
      <ParseStatusHeader result={result} manualCount={manualCount} onChange={setManualCount} />
      <div className="mb-3">
        <RangeInputs minVal={minVal} maxVal={maxVal} onMinChange={setMinVal} onMaxChange={setMaxVal} />
      </div>
      {shiftCount > 0 && perShiftMin > 0 && perShiftMax > 0 && (
        <p className="mb-3 text-sm text-gray-500">Projected: {formatCents(projLow)}–{formatCents(projHigh)}</p>
      )}
      {err && <p className="mb-2 text-xs text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onDismiss} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold">Cancel</button>
        <button type="button" disabled={pending} onClick={() => void handleConfirm(perShiftMin, perShiftMax)}
          className="flex-1 rounded-xl bg-black py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? "Saving…" : "Confirm"}
        </button>
      </div>
    </div>
  );
}
