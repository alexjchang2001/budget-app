-- 001_schema.sql
-- All 9 tables in FK-dependency order.
-- Idempotent: uses IF NOT EXISTS throughout.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE recurrence_type AS ENUM ('monthly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE bucket_type AS ENUM ('bills', 'debt', 'savings', 'food', 'flex', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE deficit_plan_type AS ENUM ('optimal', 'emergency', 'long_term_responsible');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE week_status AS ENUM ('projected', 'active', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE bill_payment_status AS ENUM ('unpaid', 'teller_confirmed', 'manually_confirmed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE confirmed_by_type AS ENUM ('teller', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 1. user (no FK deps)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "user" (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passkey_credential_id text,
  recovery_email        text,
  recovery_code_hash    text,
  recovery_code_salt    text,
  teller_enrollment_id  text,
  teller_access_token   text,
  baseline_weekly_income integer NOT NULL DEFAULT 0,
  setup_complete        boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. bill (FK → user)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bill (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name             text NOT NULL,
  amount           integer NOT NULL CHECK (amount > 0),
  due_day_of_month integer NOT NULL CHECK (due_day_of_month BETWEEN 1 AND 31),
  recurrence       recurrence_type NOT NULL DEFAULT 'monthly',
  active           boolean NOT NULL DEFAULT true
);

-- ---------------------------------------------------------------------------
-- 3. bucket (FK → user)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bucket (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name             text NOT NULL,
  allocation_pct   decimal(5,2) NOT NULL DEFAULT 0,
  priority_order   integer NOT NULL DEFAULT 0,
  type             bucket_type NOT NULL,
  deficit_floor_pct decimal(5,2)
    CONSTRAINT deficit_floor_null_only_for_flex
    CHECK (type = 'flex' OR deficit_floor_pct IS NOT NULL)
);

-- ---------------------------------------------------------------------------
-- 4. week (FK → user)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS week (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  week_start               date NOT NULL,
  week_end                 date NOT NULL,
  payday                   date,
  income_actual            integer,
  income_projected_low     integer NOT NULL DEFAULT 0,
  income_projected_high    integer NOT NULL DEFAULT 0,
  deficit_plan             deficit_plan_type,
  deficit_plan_chosen_at   timestamptz,
  deficit_plan_expires_at  timestamptz,
  rounding_residue         integer NOT NULL DEFAULT 0,
  status                   week_status NOT NULL DEFAULT 'projected',
  CONSTRAINT week_start_is_friday CHECK (EXTRACT(DOW FROM week_start) = 5),
  CONSTRAINT week_end_is_thursday CHECK (EXTRACT(DOW FROM week_end) = 4)
);

-- ---------------------------------------------------------------------------
-- 5. bucket_allocation (FK → week, bucket)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bucket_allocation (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id                 uuid NOT NULL REFERENCES week(id) ON DELETE CASCADE,
  bucket_id               uuid NOT NULL REFERENCES bucket(id) ON DELETE CASCADE,
  allocated_amount        integer NOT NULL DEFAULT 0,
  spent_amount            integer NOT NULL DEFAULT 0,
  floor_amount            integer NOT NULL DEFAULT 0,
  opening_allocated_amount integer NOT NULL DEFAULT 0,
  UNIQUE (week_id, bucket_id)
);

-- ---------------------------------------------------------------------------
-- 6. transaction (FK → user; nullable FKs → week, bucket, bill)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS transaction (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  teller_transaction_id    text NOT NULL UNIQUE,
  amount                   integer NOT NULL,
  description              text NOT NULL DEFAULT '',
  merchant_name            text NOT NULL DEFAULT '',
  posted_at                timestamptz NOT NULL,
  week_id                  uuid REFERENCES week(id) ON DELETE SET NULL,
  bucket_id                uuid REFERENCES bucket(id) ON DELETE SET NULL,
  classification_confidence decimal(4,3),
  classification_override  boolean NOT NULL DEFAULT false,
  is_direct_deposit        boolean NOT NULL DEFAULT false,
  bill_id                  uuid REFERENCES bill(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- 7. bill_status (FK → week, bill; nullable FK → transaction)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bill_status (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id        uuid NOT NULL REFERENCES week(id) ON DELETE CASCADE,
  bill_id        uuid NOT NULL REFERENCES bill(id) ON DELETE CASCADE,
  status         bill_payment_status NOT NULL DEFAULT 'unpaid',
  confirmed_at   timestamptz,
  confirmed_by   confirmed_by_type,
  transaction_id uuid REFERENCES transaction(id) ON DELETE SET NULL,
  UNIQUE (week_id, bill_id)
);

-- ---------------------------------------------------------------------------
-- 8. schedule_parse (FK → user, week)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS schedule_parse (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  week_id               uuid NOT NULL REFERENCES week(id) ON DELETE CASCADE,
  raw_screenshot_url    text NOT NULL DEFAULT '',
  parsed_shift_count    integer NOT NULL DEFAULT 0,
  parsed_shift_days     text[] NOT NULL DEFAULT '{}',
  per_shift_income_min  integer NOT NULL DEFAULT 0,
  per_shift_income_max  integer NOT NULL DEFAULT 0,
  projected_low         integer NOT NULL DEFAULT 0,
  projected_high        integer NOT NULL DEFAULT 0,
  confidence            decimal(4,3) NOT NULL DEFAULT 0,
  confirmed_by_user     boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 9. classification_config (singleton — single-row CHECK constraint)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS classification_config (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_assign_threshold decimal(4,3) NOT NULL DEFAULT 0.85,
  flag_threshold        decimal(4,3) NOT NULL DEFAULT 0.60,
  food_weekly_minimum   integer NOT NULL DEFAULT 5000,
  seed_examples         jsonb NOT NULL DEFAULT '[]',
  CONSTRAINT single_row CHECK (id = 'a0000000-0000-0000-0000-000000000001'::uuid)
);
