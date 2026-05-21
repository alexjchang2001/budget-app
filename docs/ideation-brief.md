# Budget App — What We've Built

## What it is

A mobile-first PWA for one user in the restaurant industry. Connected live to Bank of America via Teller.io. Fully automated — income is detected automatically, budget is recalculated on every deposit, and transactions are classified by AI in the background. The user never manually logs income or transactions.

Built around one constraint: it has to work at 2am after a shift, not just when you're clear-headed in the morning.

---

## What it can do

### Authentication
- Passkey login (Face ID / Touch ID) — no passwords
- Account recovery via email + one-time 16-character code
- 7-day session with Edge middleware protecting all routes

### Setup (one-time, 5 steps)
- Links to your bank account via Teller Connect
- Captures recurring monthly bills (rent, subscriptions, etc.)
- Configures budget buckets (Food / Flex / Savings / Debt) as percentages of post-bills income
- Records baseline weekly income and per-shift min/max range
- All data flows directly into the allocation engine on first run

### Home Screen — daily financial state at a glance
- **Daily limit:** how much you can spend today, color-coded green → amber → red as you approach zero
- **Payday countdown:** days until Friday, or confirmation that this week's deposit cleared and how much
- **Summary pills:** bills paid X of Y, what % went to debt and savings this week
- **Deposit detection:** auto-detects your weekly paycheck the moment it clears; surfaces a correction flow if the wrong transaction was flagged
- **Deficit mode:** if bills eat more than 92% of income, or less than $50 remains for food after floors, a modal appears with three plans to choose from (Emergency, Optimal, Long-Term Responsible) — each one recalculates all buckets automatically

### Budget Buckets Screen — where did the money go
- Bills bucket: each bill with due date, paid/unpaid status, one-tap manual confirmation
- When a bill is confirmed paid, the freed amount automatically re-routes to priority buckets (Debt → Savings → Food → Flex)
- Per-bucket cards: allocated vs. spent, color-coded by spend percentage
- Uncategorized transactions: anything the AI wasn't confident about surfaces here with a red badge on the tab
- Tap any transaction to reclassify it — your correction feeds back into future AI classifications

### Projection + History Screen — forward and backward view
- Upload a photo of your shift schedule → Claude reads it, extracts shift count and days, asks you to confirm a per-shift income range → calculates your projected income for the week
- Manual fallback if the photo fails
- Full history of closed weeks: actual income, which deficit plan was used (if any), total spent vs. allocated, expandable bucket-by-bucket breakdown

### Behind the scenes (always running)
- **Teller polling:** fetches new transactions every 15 minutes via cron + instant via webhook
- **Claude classification:** every transaction is automatically categorized into your buckets using AI with tiered confidence — high confidence auto-assigns, medium confidence flags for review, low confidence surfaces as uncategorized
- **Allocation engine:** runs on every deposit — calculates distributable income, splits by your bucket percentages, routes rounding residue to savings
- **Deficit detection:** runs on every allocation — checks both trigger conditions, stores the result on the week record

---

## What it knows over time

Every week the app accumulates a data point: how many shifts were scheduled, which days, what the projected income range was, and what actually deposited. This is stored explicitly so a future prediction model can be trained on it — slow months, holiday peaks, shift patterns by day of week.

Right now that data sits in the database unused beyond the current week's projection. It's there.

---

## Current state

- All 18 planned tasks across 4 sprints complete
- 12 database migrations applied (schema, RLS, RPCs, storage)
- Codebase passes architecture check (all files under line limits, no violations)
- End-to-end flow validated across 10 scenarios
- Merged to master, ready to deploy to Vercel + Supabase
- Not yet deployed — no live URL
