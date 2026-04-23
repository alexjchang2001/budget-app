-- Add Teller sync state columns missing from initial schema
ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS teller_sync_failed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS teller_access_token_iv text,
  ADD COLUMN IF NOT EXISTS teller_access_token_tag text,
  ADD COLUMN IF NOT EXISTS teller_degraded_since timestamptz;
