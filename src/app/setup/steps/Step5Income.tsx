"use client";

function IncomeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}): JSX.Element {
  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-sm text-gray-600">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border p-3 text-sm"
      />
    </label>
  );
}

export default function Step5Income({
  baselineIncome,
  onBaselineChange,
  shiftMin,
  onShiftMinChange,
  shiftMax,
  onShiftMaxChange,
  error,
  loading,
  onSubmit,
}: {
  baselineIncome: string;
  onBaselineChange: (v: string) => void;
  shiftMin: string;
  onShiftMinChange: (v: string) => void;
  shiftMax: string;
  onShiftMaxChange: (v: string) => void;
  error: string;
  loading: boolean;
  onSubmit: () => void;
}): JSX.Element {
  return (
    <div className="w-full max-w-sm">
      <h1 className="mb-2 text-2xl font-bold">Your income</h1>
      <p className="mb-6 text-sm text-gray-500">
        Tell us your typical weekly income and per-shift range.
      </p>
      <IncomeField
        label="Baseline weekly income ($)"
        value={baselineIncome}
        onChange={onBaselineChange}
      />
      <IncomeField
        label="Per-shift minimum ($)"
        value={shiftMin}
        onChange={onShiftMinChange}
      />
      <IncomeField
        label="Per-shift maximum ($)"
        value={shiftMax}
        onChange={onShiftMaxChange}
      />
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}
      <button
        onClick={onSubmit}
        disabled={loading}
        className="w-full rounded-xl bg-black py-4 text-base font-semibold text-white disabled:opacity-40"
      >
        {loading ? "Finishing…" : "Finish setup"}
      </button>
    </div>
  );
}
