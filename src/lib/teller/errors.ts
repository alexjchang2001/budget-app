import { createAdminClient } from "@/lib/supabase-server";

const BACKOFF_BASE_MS = 30_000;
const BACKOFF_MAX_MS = 3_600_000;
const NOTIFY_THRESHOLD_MS = 3_600_000;
const MAX_500_RETRIES = 3;

export type TellerErrorResult = {
  retry: boolean;
  delayMs: number;
  shouldNotify: boolean;
};

export function computeBackoffDelay(
  attempt: number,
  baseMs = BACKOFF_BASE_MS,
  maxMs = BACKOFF_MAX_MS
): number {
  const delay = baseMs * Math.pow(2, attempt);
  return Math.min(delay, maxMs);
}

export function addJitter(delayMs: number): number {
  // Jitter: 75–100% of delay to spread load across cron runs
  return Math.floor(delayMs * (0.75 + Math.random() * 0.25));
}

async function setTellerSyncFailed(userId: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("user")
    .update({ teller_sync_failed: true, teller_degraded_since: null })
    .eq("id", userId);
}

async function setDegradedSince(
  userId: string,
  since: string | null
): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("user")
    .update({ teller_degraded_since: since })
    .eq("id", userId);
}

async function getDegradedSince(userId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("user")
    .select("teller_degraded_since")
    .eq("id", userId)
    .single();
  return data?.teller_degraded_since ?? null;
}

export async function handleTellerError(
  statusCode: number,
  userId: string,
  attempt: number
): Promise<TellerErrorResult> {
  if (statusCode === 401) {
    await setTellerSyncFailed(userId);
    return { retry: false, delayMs: 0, shouldNotify: true };
  }

  if (statusCode === 429) {
    let degradedSince = await getDegradedSince(userId);
    if (!degradedSince) {
      degradedSince = new Date().toISOString();
      await setDegradedSince(userId, degradedSince);
    }
    const degradedMs = Date.now() - new Date(degradedSince).getTime();
    const shouldNotify = degradedMs >= NOTIFY_THRESHOLD_MS;
    const base = computeBackoffDelay(attempt);
    const delayMs = addJitter(base);
    return { retry: true, delayMs, shouldNotify };
  }

  if (statusCode >= 500) {
    if (attempt >= MAX_500_RETRIES - 1) {
      await setTellerSyncFailed(userId);
      return { retry: false, delayMs: 0, shouldNotify: true };
    }
    return { retry: true, delayMs: 0, shouldNotify: false };
  }

  // Disconnect / unknown: preserve data, set flag
  await setTellerSyncFailed(userId);
  return { retry: false, delayMs: 0, shouldNotify: true };
}

export async function clearTellerDegraded(userId: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("user")
    .update({ teller_sync_failed: false, teller_degraded_since: null })
    .eq("id", userId);
}
