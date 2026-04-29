"use client";

import type { BucketDraft } from "./Step4Buckets";

export default function Step4BucketRow({
  bucket,
  onChange,
  onRemove,
}: {
  bucket: BucketDraft;
  onChange: (b: BucketDraft) => void;
  onRemove?: () => void;
}): JSX.Element {
  return (
    <div className="mb-3 flex items-center gap-2">
      <input
        type="text"
        placeholder="Name"
        value={bucket.name}
        onChange={(e) => onChange({ ...bucket, name: e.target.value })}
        className="flex-1 rounded-xl border p-3 text-sm"
      />
      <input
        type="number"
        placeholder="%"
        min={0}
        max={100}
        value={bucket.allocation_pct}
        onChange={(e) =>
          onChange({ ...bucket, allocation_pct: Number(e.target.value) })
        }
        className="w-20 rounded-xl border p-3 text-sm"
      />
      {bucket.deficit_floor_pct !== null && (
        <span className="text-xs text-gray-400">
          (floor: {bucket.deficit_floor_pct}%)
        </span>
      )}
      {onRemove && (
        <button
          onClick={onRemove}
          className="px-2 text-lg text-gray-400"
          aria-label="Remove bucket"
        >
          ✕
        </button>
      )}
    </div>
  );
}
