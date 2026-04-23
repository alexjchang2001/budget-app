import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase-server";
import { handleTellerError, clearTellerDegraded } from "@/lib/teller/errors";

const TELLER_API = "https://api.teller.io";

export type TellerAccount = {
  id: string;
  name: string;
  type: string;
  subtype: string;
  status: string;
  institution: { name: string };
  enrollment_id: string;
};

export type TellerTransaction = {
  id: string;
  account_id: string;
  amount: string;
  description: string;
  details: { counterparty?: { name?: string } };
  date: string;
  status: "posted" | "pending";
  type: string;
};

export type TellerBalance = {
  account_id: string;
  available: string;
  ledger: string;
};

function getEncryptionKey(): Buffer {
  // TELLER_ENCRYPTION_KEY is the dedicated secret for token encryption.
  // Falls back to JWT_SECRET only for tokens encrypted before TELLER_ENCRYPTION_KEY was set.
  const secret = process.env.TELLER_ENCRYPTION_KEY ?? process.env.JWT_SECRET;
  if (!secret) throw new Error("TELLER_ENCRYPTION_KEY not set");
  return createHash("sha256").update(secret).digest();
}

export function encryptToken(plaintext: string): {
  encrypted: string;
  iv: string;
  tag: string;
} {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    encrypted: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
  };
}

export function decryptToken(
  encrypted: string,
  iv: string,
  tag: string
): string {
  const key = getEncryptionKey();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

async function getDecryptedToken(userId: string): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user")
    .select("teller_access_token, teller_access_token_iv, teller_access_token_tag")
    .eq("id", userId)
    .single();
  if (error || !data?.teller_access_token) {
    throw new Error("Teller access token not found for user");
  }
  if (!data.teller_access_token_iv || !data.teller_access_token_tag) {
    // Legacy plain-text token (pre-migration) — return as-is
    return data.teller_access_token;
  }
  return decryptToken(
    data.teller_access_token,
    data.teller_access_token_iv,
    data.teller_access_token_tag
  );
}

async function tellerFetch<T>(path: string, userId: string): Promise<T> {
  const token = await getDecryptedToken(userId);
  const auth = Buffer.from(token + ":").toString("base64");

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${TELLER_API}${path}`, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (res.ok) {
      await clearTellerDegraded(userId);
      return res.json() as Promise<T>;
    }

    const { retry, delayMs } = await handleTellerError(
      res.status,
      userId,
      attempt
    );
    if (!retry) throw new Error(`Teller API error: ${res.status}`);
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }

  throw new Error("Teller API: max retries exceeded");
}

export async function getAccounts(userId: string): Promise<TellerAccount[]> {
  return tellerFetch<TellerAccount[]>("/accounts", userId);
}

export async function getTransactions(
  accountId: string,
  userId: string
): Promise<TellerTransaction[]> {
  return tellerFetch<TellerTransaction[]>(
    `/accounts/${accountId}/transactions`,
    userId
  );
}

export async function getBalances(
  accountId: string,
  userId: string
): Promise<TellerBalance> {
  return tellerFetch<TellerBalance>(
    `/accounts/${accountId}/balances`,
    userId
  );
}
