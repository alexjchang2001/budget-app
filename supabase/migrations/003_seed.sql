-- 003_seed.sql
-- Seed the single classification_config row.
-- Idempotent: INSERT ... ON CONFLICT DO NOTHING.

INSERT INTO classification_config (
  id,
  auto_assign_threshold,
  flag_threshold,
  food_weekly_minimum,
  seed_examples
)
VALUES (
  'a0000000-0000-0000-0000-000000000001'::uuid,
  0.85,
  0.60,
  5000,
  '[
    {"merchant_name": "DoorDash",    "bucket_type": "food", "condition": "amount_cents > 3000"},
    {"merchant_name": "DoorDash",    "bucket_type": "flex", "condition": "amount_cents <= 3000"},
    {"merchant_name": "Uber Eats",   "bucket_type": "food", "condition": "amount_cents > 3000"},
    {"merchant_name": "Uber Eats",   "bucket_type": "flex", "condition": "amount_cents <= 3000"},
    {"merchant_name": "Grubhub",     "bucket_type": "food", "condition": "amount_cents > 3000"},
    {"merchant_name": "Grubhub",     "bucket_type": "flex", "condition": "amount_cents <= 3000"},
    {"merchant_name": "Instacart",   "bucket_type": "food", "condition": "amount_cents > 3000"},
    {"merchant_name": "Instacart",   "bucket_type": "flex", "condition": "amount_cents <= 3000"},
    {"merchant_name": "Chevron",     "bucket_type": "flex"},
    {"merchant_name": "Shell",       "bucket_type": "flex"},
    {"merchant_name": "BP",          "bucket_type": "flex"},
    {"merchant_name": "ExxonMobil",  "bucket_type": "flex"},
    {"merchant_name": "Whole Foods", "bucket_type": "food"},
    {"merchant_name": "Trader Joe'\''s", "bucket_type": "food"},
    {"merchant_name": "Kroger",      "bucket_type": "food"},
    {"merchant_name": "Safeway",     "bucket_type": "food"},
    {"merchant_name": "Aldi",        "bucket_type": "food"},
    {"keyword": "ConEd",             "bucket_type": "bills"},
    {"keyword": "PG&E",              "bucket_type": "bills"},
    {"keyword": "Electric",          "bucket_type": "bills"},
    {"keyword": "Gas",               "bucket_type": "bills"},
    {"keyword": "Water",             "bucket_type": "bills"},
    {"keyword": "Internet",          "bucket_type": "bills"},
    {"keyword": "minimum payment",   "bucket_type": "debt"},
    {"keyword": "autopay",           "bucket_type": "debt"}
  ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
