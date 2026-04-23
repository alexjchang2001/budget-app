import { describe, it, expect } from "vitest";
import { isDirectDepositBySignals } from "@/lib/classification/deposit-detection";
import { buildSystemPrompt, buildUserContent } from "@/lib/classification/prompt";
import type { BucketInfo } from "@/lib/classification/prompt";

// ---------------------------------------------------------------------------
// isDirectDepositBySignals — shared helper
// ---------------------------------------------------------------------------
const BASELINE_CENTS = 80000; // $800/week

function makeTx(overrides: {
  amount?: number;
  description?: string;
  merchant_name?: string;
  posted_at?: string;
}) {
  return {
    amount: overrides.amount ?? 90000,
    description: overrides.description ?? "Direct Deposit",
    merchant_name: overrides.merchant_name ?? "",
    posted_at: overrides.posted_at ?? "2026-04-17T09:00:00.000Z", // Friday
  };
}

// ---------------------------------------------------------------------------
// isDirectDepositBySignals — day-of-week detection
// ---------------------------------------------------------------------------
describe("isDirectDepositBySignals: day-of-week", () => {
  it("detects a standard direct deposit on Friday", () => {
    expect(isDirectDepositBySignals(makeTx({}), BASELINE_CENTS)).toBe(true);
  });

  it("detects on Saturday (fallback day)", () => {
    const tx = makeTx({ posted_at: "2026-04-18T09:00:00.000Z" });
    expect(isDirectDepositBySignals(tx, BASELINE_CENTS)).toBe(true);
  });

  it("detects on Sunday (fallback day)", () => {
    const tx = makeTx({ posted_at: "2026-04-19T09:00:00.000Z" });
    expect(isDirectDepositBySignals(tx, BASELINE_CENTS)).toBe(true);
  });

  it("rejects on Monday (not a deposit day)", () => {
    const tx = makeTx({ posted_at: "2026-04-20T09:00:00.000Z" });
    expect(isDirectDepositBySignals(tx, BASELINE_CENTS)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isDirectDepositBySignals — amount & keyword matching
// ---------------------------------------------------------------------------
describe("isDirectDepositBySignals: amount & keywords", () => {
  it("rejects negative amount", () => {
    expect(isDirectDepositBySignals(makeTx({ amount: -90000 }), BASELINE_CENTS)).toBe(false);
  });

  it("rejects when no deposit keyword matches", () => {
    const tx = makeTx({ description: "Amazon Purchase", merchant_name: "Amazon" });
    expect(isDirectDepositBySignals(tx, BASELINE_CENTS)).toBe(false);
  });

  it("rejects when amount < 60% of baseline", () => {
    const tx = makeTx({ amount: 40000 });
    expect(isDirectDepositBySignals(tx, BASELINE_CENTS)).toBe(false);
  });

  it("accepts amount exactly at 60% of baseline", () => {
    const tx = makeTx({ amount: 48000 });
    expect(isDirectDepositBySignals(tx, BASELINE_CENTS)).toBe(true);
  });

  it("detects ACH credit keyword", () => {
    const tx = makeTx({ description: "ACH Credit Payroll", merchant_name: "" });
    expect(isDirectDepositBySignals(tx, BASELINE_CENTS)).toBe(true);
  });

  it("detects payroll keyword in merchant name", () => {
    const tx = makeTx({ description: "", merchant_name: "Employer Payroll" });
    expect(isDirectDepositBySignals(tx, BASELINE_CENTS)).toBe(true);
  });

  it("skips baseline check when baseline is 0", () => {
    const tx = makeTx({ amount: 5000 });
    expect(isDirectDepositBySignals(tx, 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildSystemPrompt
// ---------------------------------------------------------------------------
describe("buildSystemPrompt", () => {
  const buckets: BucketInfo[] = [
    { id: "1", type: "food", name: "Food" },
    { id: "2", type: "flex", name: "Flex" },
    { id: "3", type: "bills", name: "Bills" },
  ];

  const examples = [
    { input: "DoorDash | $45.00", bucket_type: "food", rationale: "Delivery > $30" },
    { input: "DoorDash | $25.00", bucket_type: "flex", rationale: "Delivery ≤ $30" },
  ];

  it("includes all bucket types", () => {
    const prompt = buildSystemPrompt(buckets, examples);
    expect(prompt).toContain("food");
    expect(prompt).toContain("flex");
    expect(prompt).toContain("bills");
  });

  it("includes examples", () => {
    const prompt = buildSystemPrompt(buckets, examples);
    expect(prompt).toContain("DoorDash");
  });

  it("specifies JSON output format", () => {
    const prompt = buildSystemPrompt(buckets, examples);
    expect(prompt).toContain("bucket_type");
    expect(prompt).toContain("confidence");
    expect(prompt).toContain("rationale");
  });
});

// ---------------------------------------------------------------------------
// buildUserContent
// ---------------------------------------------------------------------------
describe("buildUserContent", () => {
  it("includes merchant name and dollar amount", () => {
    const content = buildUserContent({
      merchant_name: "Whole Foods",
      description: "Grocery purchase",
      amount: 4523,
      posted_at: "2026-04-17T14:00:00.000Z",
    });
    expect(content).toContain("Whole Foods");
    expect(content).toContain("45.23");
    expect(content).toContain("2026-04-17");
  });

  it("falls back to description when merchant_name is empty", () => {
    const content = buildUserContent({
      merchant_name: "",
      description: "ACH Transfer",
      amount: 10000,
      posted_at: "2026-04-17T00:00:00.000Z",
    });
    expect(content).toContain("ACH Transfer");
  });
});
