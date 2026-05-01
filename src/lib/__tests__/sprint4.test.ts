import { describe, it, expect, beforeAll, vi } from "vitest";
import { verifyJwt } from "../jwt";

beforeAll(() => {
  process.env.JWT_SECRET = "test-jwt-secret-at-least-32-chars-long!!";
});

// ─── JWT algorithm pinning ───────────────────────────────────────────────────

describe("verifyJwt – algorithm pinning", () => {
  it("rejects a token claiming alg=none", async () => {
    const h = Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url");
    const p = Buffer.from(`{"sub":"u","exp":${Math.floor(Date.now() / 1000) + 3600}}`).toString("base64url");
    await expect(verifyJwt(`${h}.${p}.`)).rejects.toThrow();
  });

  it("rejects a token claiming alg=RS256", async () => {
    const h = Buffer.from('{"alg":"RS256","typ":"JWT"}').toString("base64url");
    const p = Buffer.from(`{"sub":"u","exp":${Math.floor(Date.now() / 1000) + 3600}}`).toString("base64url");
    await expect(verifyJwt(`${h}.${p}.fakesig`)).rejects.toThrow();
  });
});

// ─── getUncategorizedCount ───────────────────────────────────────────────────

vi.mock("@/lib/supabase-server", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase-server";
import { getUncategorizedCount } from "@/app/(app)/_helpers";

type MockFn = ReturnType<typeof vi.fn>;

function makeClient(weekRow: { id: string } | null, txCount: number | null) {
  const txQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockResolvedValue({ count: txCount }) };
  const weekQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: weekRow }) };
  return { from: vi.fn((t: string) => (t === "week" ? weekQuery : txQuery)) };
}

describe("getUncategorizedCount", () => {
  it("returns 0 when no current week exists", async () => {
    (createAdminClient as MockFn).mockReturnValue(makeClient(null, null));
    await expect(getUncategorizedCount("user-1")).resolves.toBe(0);
  });

  it("returns the Supabase count", async () => {
    (createAdminClient as MockFn).mockReturnValue(makeClient({ id: "week-1" }, 3));
    await expect(getUncategorizedCount("user-1")).resolves.toBe(3);
  });

  it("returns 0 when count is null", async () => {
    (createAdminClient as MockFn).mockReturnValue(makeClient({ id: "week-1" }, null));
    await expect(getUncategorizedCount("user-1")).resolves.toBe(0);
  });
});
