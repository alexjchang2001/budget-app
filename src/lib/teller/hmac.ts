import { createHmac, timingSafeEqual } from "crypto";

export function verifyTellerHmac(
  body: string,
  signatureHeader: string,
  secret: string
): boolean {
  const parts: Record<string, string> = {};
  for (const part of signatureHeader.split(",")) {
    const [k, v] = part.split("=");
    if (k && v) parts[k] = v;
  }
  if (!parts["t"] || !parts["v1"]) return false;

  // Reject signatures older than 5 minutes (replay protection)
  const age = Math.abs(Date.now() / 1000 - parseInt(parts["t"], 10));
  if (age > 300) return false;

  const payload = `${parts["t"]}.${body}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(parts["v1"], "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}
