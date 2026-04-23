---
name: Schema null vs code null drift in budget-app
description: Project has recurring pattern where code inserts null for columns that are NOT NULL in Postgres schema
type: project
---

The budget-app schema uses `NOT NULL DEFAULT ''` / `NOT NULL DEFAULT 0` patterns in several places, but TypeScript code paths frequently insert `?? null` at boundary layers (Teller webhook, polling, classification). This causes runtime 23502 errors that are easy to miss.

Why: The schema was authored first (migration 001) with strict NOT NULL + defaults, but handler code was written assuming defaults apply on null insert. PostgREST does NOT substitute column defaults when a key is explicitly sent as null — the default is used only when the key is omitted.

How to apply: When reviewing inserts in Sprint 2+ routes/polling/webhooks, always cross-check that `?? null` fallbacks match the column nullability in `001_schema.sql`. Confirmed offenders at review time: `transaction.merchant_name` (NOT NULL) receiving null from teller webhook + polling. Similar pattern may recur in Sprint 3 setup flow.
