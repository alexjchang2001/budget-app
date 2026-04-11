import { createHash, randomBytes, timingSafeEqual } from "crypto";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const CODE_LENGTH = 16;

export function generateSalt(): string {
  return randomBytes(16).toString("hex");
}

/**
 * 16-char base62 code from 12 random bytes (~95 bits entropy).
 * Uses BigInt base-conversion for uniform distribution.
 */
export function generateRecoveryCode(): string {
  const bytes = randomBytes(12);
  let n = BigInt("0x" + bytes.toString("hex"));
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code = BASE62[Number(n % 62n)] + code;
    n = n / 62n;
  }
  return code;
}

/**
 * SHA-256(code + salt) hex digest. NOT bcrypt — high-entropy tokens (~95 bits)
 * don't benefit from bcrypt's slow hashing; SHA-256 is appropriate here.
 */
export function hashRecoveryCode(code: string, salt: string): string {
  return createHash("sha256").update(code + salt).digest("hex");
}

/** Constant-time comparison to prevent timing attacks on hash verification. */
export function verifyRecoveryCode(
  code: string,
  salt: string,
  storedHash: string
): boolean {
  const computed = Buffer.from(hashRecoveryCode(code, salt), "hex");
  const stored = Buffer.from(storedHash, "hex");
  if (computed.length !== stored.length) return false;
  return timingSafeEqual(computed, stored);
}

/** Generate a complete { code, salt, hash } bundle atomically. Used at enrollment and recovery. */
export function generateRecoveryBundle(): { code: string; salt: string; hash: string } {
  const code = generateRecoveryCode();
  const salt = generateSalt();
  return { code, salt, hash: hashRecoveryCode(code, salt) };
}
