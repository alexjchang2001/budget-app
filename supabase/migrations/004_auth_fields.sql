-- 004_auth_fields.sql
-- Add WebAuthn authenticator fields needed for assertion verification.
-- The spec's user table stores passkey_credential_id but omits the public key
-- and counter required by @simplewebauthn/server to verify login assertions.
-- Idempotent: ADD COLUMN IF NOT EXISTS.

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS passkey_public_key  text,
  ADD COLUMN IF NOT EXISTS passkey_counter      integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS passkey_transports   text[]  NOT NULL DEFAULT '{}';
