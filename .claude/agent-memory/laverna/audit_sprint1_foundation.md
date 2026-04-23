---
name: Sprint 1 Foundation Auth Audit
description: Security findings from Sprint 1 WebAuthn/JWT/recovery auth review — key open issues to track for follow-up sprints
type: project
---

Audit conducted 2026-04-11 covering src/lib/{jwt,auth,webauthn,recovery,supabase-server}.ts and all six auth API routes plus migrations 001-004 and config files.

## Open findings by severity

**P0 — blocks deploy**
- None identified. Auth is pre-launch single-user app so threshold is lower.

**P1 — fix before merge**
1. Recovery challenge cookie is unsigned JSON — `isRecovery: true` can be forged by any client that calls `recover/verify` successfully and then replays a modified cookie. The `complete` endpoint trusts this flag to gate passkey replacement.
2. `teller_access_token` stored plaintext in DB. Schema comment says "Encrypted at rest" but no encryption exists in migrations or app code. Sprint 2 task T2.1 is supposed to add AES-256-GCM — confirm it ships before Teller integration.
3. `createServiceRoleClient()` in supabase-server.ts is exported but unused; it reads user cookies while holding the service role key — a confused-deputy risk if ever called. Either wire it correctly or delete it.
4. No rate limiting on any auth endpoint (register/challenge, login/challenge, recover/verify). Single-user app reduces blast radius but recovery/verify is a brute-force vector if the recovery email is known.
5. `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGIN` not documented in .env.example — misconfiguration risk at deploy time (defaults fall back to localhost/http which would silently work in dev and break in prod).

**P2 — harden before production**
6. JWT `role: "authenticated"` claim must match Supabase JWT secret exactly — if JWT_SECRET diverges from the value configured in the Supabase dashboard (Settings > API > JWT Secret), all RLS will silently fail open (auth.uid() returns null).
7. clearAuthCookie() does not set httpOnly/secure/sameSite on the clearing response — some browsers will not honor the deletion.
8. DB timing side-channel on recovery verify: email hit vs miss produces measurably different round-trip times. The in-process constant-time comparison is correct but does not cover network + Postgres latency.
9. classification_config INSERT/UPDATE/DELETE has no explicit DENY policy; relies on absence of a permissive policy. Correct under Supabase default-deny, but worth an explicit comment or a deny policy for auditability.
10. passkey_public_key stored as standard base64 (not base64url) — cross-check that @simplewebauthn/server v9 verifyAuthenticationResponse accepts this encoding without silent truncation/error.

**Why:** Teller access token and the recovery cookie forgery are the two items that could directly lead to account takeover or financial data exposure in production.
**How to apply:** Flag P1 items in any PR that touches the auth or Teller integration layers.
