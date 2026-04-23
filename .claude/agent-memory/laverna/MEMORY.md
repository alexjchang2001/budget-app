# Security Auditor Memory

> This file is automatically loaded into the Security Auditor agent's system prompt (first 200 lines).
> Record audit findings, vulnerability patterns, and compliance observations specific to this project.

## Audit History
- [Sprint 1 Foundation Auth Audit](audit_sprint1_foundation.md) — 2026-04-11; WebAuthn/JWT/recovery/RLS review; 2 account-takeover-class P1s open (recovery cookie forgery, teller token plaintext)

## Vulnerability Patterns Found
- Unsigned challenge cookies used as session state (recovery flow)
- Missing env vars in .env.example causing silent insecure defaults (RP_ID/ORIGIN)
- Exported but-unused service-role helper with confused-deputy potential

## Compliance Checkpoints
- Encryption at rest: INCOMPLETE — teller_access_token column is plaintext; Sprint 2 T2.1 is supposed to add AES-256-GCM
- RLS: enabled on all 9 tables; classification_config is SELECT-only for authenticated, no write policies (correct)
- Secrets in VCS: clean — .env.example has no values; vercel.json has only key names

## Scan Targets
- src/lib/supabase-server.ts — createServiceRoleClient() exported but unused; review on any refactor
- src/app/api/auth/recover/ — recovery cookie forgery vector; re-audit when signing is added
- supabase/migrations/ — teller_access_token encryption not yet present; check when T2.1 lands
