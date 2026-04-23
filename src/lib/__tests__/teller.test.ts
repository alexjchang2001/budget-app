import { describe, it, expect, beforeAll } from "vitest";
import { computeBackoffDelay, addJitter } from "@/lib/teller/errors";
import { encryptToken, decryptToken } from "@/lib/teller/client";
import { verifyTellerHmac } from "@/lib/teller/hmac";
import { createHmac } from "crypto";

beforeAll(() => {
  process.env.JWT_SECRET = "test-jwt-secret-for-unit-tests-only";
});

describe("computeBackoffDelay", () => {
  it("returns base delay on attempt 0", () => {
    expect(computeBackoffDelay(0)).toBe(30_000);
  });

  it("doubles delay each attempt", () => {
    expect(computeBackoffDelay(1)).toBe(60_000);
    expect(computeBackoffDelay(2)).toBe(120_000);
    expect(computeBackoffDelay(3)).toBe(240_000);
  });

  it("caps at maxMs", () => {
    expect(computeBackoffDelay(10)).toBe(3_600_000);
    expect(computeBackoffDelay(100)).toBe(3_600_000);
  });

  it("respects custom base and max", () => {
    expect(computeBackoffDelay(0, 1000, 5000)).toBe(1000);
    expect(computeBackoffDelay(3, 1000, 5000)).toBe(5000);
  });
});

describe("addJitter", () => {
  it("returns value between 75% and 100% of input", () => {
    for (let i = 0; i < 100; i++) {
      const result = addJitter(10_000);
      expect(result).toBeGreaterThanOrEqual(7500);
      expect(result).toBeLessThanOrEqual(10_000);
    }
  });

  it("returns integer", () => {
    expect(Number.isInteger(addJitter(10_000))).toBe(true);
  });
});

describe("encryptToken / decryptToken round-trip", () => {
  it("decrypts to original plaintext", () => {
    const token = "test-access-token-12345";
    const { encrypted, iv, tag } = encryptToken(token);
    expect(decryptToken(encrypted, iv, tag)).toBe(token);
  });

  it("produces different ciphertext each time (random IV)", () => {
    const token = "same-token";
    const first = encryptToken(token);
    const second = encryptToken(token);
    expect(first.iv).not.toBe(second.iv);
    expect(first.encrypted).not.toBe(second.encrypted);
  });

  it("throws on tampered tag", () => {
    const { encrypted, iv } = encryptToken("token");
    const badTag = "00".repeat(16);
    expect(() => decryptToken(encrypted, iv, badTag)).toThrow();
  });
});

describe("verifyTellerHmac", () => {
  const secret = "test-signing-secret";

  function currentTimestamp(): string {
    return Math.floor(Date.now() / 1000).toString();
  }

  function makeSignature(body: string, timestamp: string): string {
    const payload = `${timestamp}.${body}`;
    const hmac = createHmac("sha256", secret).update(payload).digest("hex");
    return `t=${timestamp},v1=${hmac}`;
  }

  it("accepts a valid signature", () => {
    const body = JSON.stringify({ type: "transaction.created" });
    const sig = makeSignature(body, currentTimestamp());
    expect(verifyTellerHmac(body, sig, secret)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = JSON.stringify({ type: "transaction.created" });
    const sig = makeSignature(body, currentTimestamp());
    expect(verifyTellerHmac('{"type":"other"}', sig, secret)).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const body = JSON.stringify({ type: "transaction.created" });
    const sig = makeSignature(body, currentTimestamp());
    expect(verifyTellerHmac(body, sig, "wrong-secret")).toBe(false);
  });

  it("rejects a malformed signature header", () => {
    expect(verifyTellerHmac("body", "not-valid", secret)).toBe(false);
    expect(verifyTellerHmac("body", "", secret)).toBe(false);
  });
});
