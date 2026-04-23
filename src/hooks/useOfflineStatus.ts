"use client";

import { useEffect, useState } from "react";

/**
 * Tracks the browser's online/offline status.
 * Returns true when offline.
 */
export function useOfflineStatus(): boolean {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return offline;
}
