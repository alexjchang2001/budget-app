import { describe, it, expect } from "vitest";
import { dollarsToCents, centsToDollars, formatCents } from "../money";

describe("dollarsToCents", () => {
  it("converts whole dollars", () => {
    expect(dollarsToCents(10)).toBe(1000);
    expect(dollarsToCents(0)).toBe(0);
    expect(dollarsToCents(1)).toBe(100);
  });

  it("handles common floating-point amounts correctly", () => {
    expect(dollarsToCents(19.99)).toBe(1999);
    expect(dollarsToCents(9.99)).toBe(999);
    expect(dollarsToCents(0.99)).toBe(99);
  });

  it("handles 0.1 + 0.2 floating-point trap", () => {
    // Without Math.round: (0.1 + 0.2) * 100 = 30.000000000000004
    expect(dollarsToCents(0.1 + 0.2)).toBe(30);
  });

  it("rounds correctly at half-cent boundaries", () => {
    // 1.005 in IEEE 754 is 1.00499999... so Math.round gives 100, not 101
    expect(dollarsToCents(1.005)).toBe(100);
    expect(dollarsToCents(1.004)).toBe(100);
    expect(dollarsToCents(1.006)).toBe(101);
  });

  it("handles negative amounts (debits)", () => {
    expect(dollarsToCents(-5.5)).toBe(-550);
    expect(dollarsToCents(-19.99)).toBe(-1999);
  });

  it("handles large amounts", () => {
    expect(dollarsToCents(10000)).toBe(1000000);
  });
});

describe("centsToDollars", () => {
  it("converts cents to dollars", () => {
    expect(centsToDollars(1999)).toBe(19.99);
    expect(centsToDollars(0)).toBe(0);
    expect(centsToDollars(100)).toBe(1);
  });

  it("round-trips with dollarsToCents", () => {
    const amounts = [42.5, 9.99, 0, 1000, 19.99];
    for (const amount of amounts) {
      expect(centsToDollars(dollarsToCents(amount))).toBe(amount);
    }
  });

  it("handles negative cents", () => {
    expect(centsToDollars(-550)).toBe(-5.5);
  });
});

describe("formatCents", () => {
  it("formats positive amounts as USD", () => {
    expect(formatCents(1999)).toBe("$19.99");
    expect(formatCents(100)).toBe("$1.00");
    expect(formatCents(0)).toBe("$0.00");
  });

  it("includes cents for whole dollar amounts", () => {
    expect(formatCents(500)).toBe("$5.00");
  });

  it("returns a string", () => {
    expect(typeof formatCents(1234)).toBe("string");
  });
});
