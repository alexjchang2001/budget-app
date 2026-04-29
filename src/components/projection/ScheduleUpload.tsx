"use client";

import { useRef, useState } from "react";

export type ParseResult =
  | { status: "ok"; parseId: string; shiftCount: number; shiftDays: string[] }
  | { status: "low"; parseId: string; shiftCount: number }
  | { status: "failed" };

type Props = { onResult: (result: ParseResult) => void };

export default function ScheduleUpload({ onResult }: Props): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/schedule/parse", { method: "POST", body: form });
      if (!res.ok) { onResult({ status: "failed" }); return; }
      const json = await res.json() as Record<string, unknown>;
      if (json.error === "parse_failed") { onResult({ status: "failed" }); return; }
      const conf = json.confidence as number;
      const parseId = json.parse_id as string;
      const shiftCount = json.shift_count as number;
      const shiftDays = json.shift_days as string[];
      onResult(conf >= 0.7
        ? { status: "ok", parseId, shiftCount, shiftDays }
        : { status: "low", parseId, shiftCount }
      );
    } catch {
      onResult({ status: "failed" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {uploading ? "Parsing…" : "Update from schedule"}
      </button>
    </>
  );
}
