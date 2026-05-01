"use client";

export default function PageStatus({ error }: { error?: string }): JSX.Element {
  return (
    <main>
      {error
        ? <p className="p-6 text-center text-sm text-red-600">{error}</p>
        : <p className="p-6 text-center text-sm text-gray-400">Loading…</p>}
    </main>
  );
}
