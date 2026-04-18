import { describe, it, expect, beforeAll } from "vitest";
import { signJwt, verifyJwt } from "../jwt";

beforeAll(() => {
  // Must be ≥ 32 chars for HS256
  process.env.JWT_SECRET = "test-jwt-secret-at-least-32-chars-long!!";
});

describe("signJwt + verifyJwt", () => {
  it("round-trips the userId", async () => {
    const userId = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
    const token = await signJwt(userId);
    const { userId: decoded } = await verifyJwt(token);
    expect(decoded).toBe(userId);
  });

  it("produces a 3-part JWT string", async () => {
    const token = await signJwt("some-user");
    expect(token.split(".")).toHaveLength(3);
  });

  it("throws on a completely invalid token", async () => {
    await expect(verifyJwt("not.a.jwt")).rejects.toThrow();
  });

  it("throws on a token signed with the wrong secret", async () => {
    // Sign with different secret via raw jose
    const { SignJWT } = await import("jose");
    const wrongToken = await new SignJWT({ sub: "user", role: "authenticated" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(new TextEncoder().encode("wrong-secret-that-is-different!!"));
    await expect(verifyJwt(wrongToken)).rejects.toThrow();
  });

  it("throws on a tampered payload", async () => {
    const token = await signJwt("user-id");
    const parts = token.split(".");
    // Modify the payload segment
    const tampered = parts[0] + "." + parts[1].slice(0, -2) + "XX" + "." + parts[2];
    await expect(verifyJwt(tampered)).rejects.toThrow();
  });

  it("includes role: authenticated in payload", async () => {
    const { jwtVerify } = await import("jose");
    const token = await signJwt("some-user");
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);
    expect(payload.role).toBe("authenticated");
    expect(payload.sub).toBe("some-user");
  });
});
