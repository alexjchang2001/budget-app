"use client";

import { useOfflineStatus } from "@/hooks/useOfflineStatus";

export default function OfflineBanner({ lastUpdated }: { lastUpdated: number }): JSX.Element | null {
  const offline = useOfflineStatus();
  if (!offline) return null;

  const mins = Math.floor((Date.now() - lastUpdated) / 60000);
  const label = mins < 1 ? "just now" : `${mins} min ago`;

  return (
    <div className="mx-4 rounded-lg bg-yellow-50 px-4 py-2 text-center text-xs text-yellow-800">
      Last updated {label} — no connection
    </div>
  );
}
