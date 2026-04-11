import { describe, it, expect } from "vitest";
import {
  generateRecoveryCode,
  generateSalt,
  hashRecoveryCode,
  verifyRecoveryCode,
} from "../recovery";

const BASE62_RE = /^[0-9A-Za-z]{16}$/;

describe("generateRecoveryCode", () => {
  it("returns exactly 16 characters", () => {
    for (let i = 0; i < 5; i++) {
      expect(generateRecoveryCode()).toHaveLength(16);
    }
  });

  it("uses only base62 characters", () => {
    for (let i = 0; i < 5; i++) {
      expect(generateRecoveryCode()).toMatch(BASE62_RE);
    }
  });

  it("generates unique codes (no collisions in 200 samples)", () => {
    const codes = new Set(Array.from({ length: 200 }, generateRecoveryCode));
    expect(codes.size).toBe(200);
  });
});

describe("generateSalt", () => {
  it("returns a 32-character hex string", () => {
    expect(generateSalt()).toMatch(/^[0-9a-f]{32}$/);
  });

  it("generates unique salts", () => {
    expect(generateSalt()).not.toBe(generateSalt());
  });
});

describe("hashRecoveryCode", () => {
  it("returns a 64-character hex string (SHA-256)", () => {
    const hash = hashRecoveryCode("ABCDEFGH12345678", "0".repeat(32));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same inputs", () => {
    const salt = generateSalt();
    const code = generateRecoveryCode();
    expect(hashRecoveryCode(code, salt)).toBe(hashRecoveryCode(code, salt));
  });

  it("differs when code differs", () => {
    const salt = generateSalt();
    expect(hashRecoveryCode("AAA", salt)).not.toBe(hashRecoveryCode("BBB", salt));
  });

  it("differs when salt differs", () => {
    const code = generateRecoveryCode();
    expect(hashRecoveryCode(code, "aaa")).not.toBe(hashRecoveryCode(code, "bbb"));
  });
});

describe("verifyRecoveryCode", () => {
  it("returns true for the correct code", () => {
    const code = generateRecoveryCode();
    const salt = generateSalt();
    const hash = hashRecoveryCode(code, salt);
    expect(verifyRecoveryCode(code, salt, hash)).toBe(true);
  });

  it("returns false for a wrong code", () => {
    const code = generateRecoveryCode();
    const salt = generateSalt();
    const hash = hashRecoveryCode(code, salt);
    expect(verifyRecoveryCode("WRONG00000000000", salt, hash)).toBe(false);
  });

  it("returns false for a wrong salt", () => {
    const code = generateRecoveryCode();
    const salt = generateSalt();
    const hash = hashRecoveryCode(code, salt);
    expect(verifyRecoveryCode(code, generateSalt(), hash)).toBe(false);
  });

  it("returns false for a tampered hash", () => {
    const code = generateRecoveryCode();
    const salt = generateSalt();
    expect(verifyRecoveryCode(code, salt, "a".repeat(64))).toBe(false);
  });
});
