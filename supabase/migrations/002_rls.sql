-- 002_rls.sql
-- Row Level Security policies for all 9 tables.
-- Idempotent: uses IF NOT EXISTS / OR REPLACE where supported; policies use
-- DROP IF EXISTS before CREATE to allow re-runs cleanly.

-- ---------------------------------------------------------------------------
-- Enable RLS on all tables
-- ---------------------------------------------------------------------------

ALTER TABLE "user"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE bucket               ENABLE ROW LEVEL SECURITY;
ALTER TABLE week                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE bucket_allocation    ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_status          ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_parse       ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification_config ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- user: own row only (id = auth.uid())
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "user_select_own"  ON "user";
DROP POLICY IF EXISTS "user_insert_own"  ON "user";
DROP POLICY IF EXISTS "user_update_own"  ON "user";
DROP POLICY IF EXISTS "user_delete_own"  ON "user";

CREATE POLICY "user_select_own"
  ON "user" FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "user_insert_own"
  ON "user" FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "user_update_own"
  ON "user" FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "user_delete_own"
  ON "user" FOR DELETE
  USING (id = auth.uid());

-- ---------------------------------------------------------------------------
-- bill: scoped to user_id = auth.uid()
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "bill_select_own"  ON bill;
DROP POLICY IF EXISTS "bill_insert_own"  ON bill;
DROP POLICY IF EXISTS "bill_update_own"  ON bill;
DROP POLICY IF EXISTS "bill_delete_own"  ON bill;

CREATE POLICY "bill_select_own"
  ON bill FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "bill_insert_own"
  ON bill FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "bill_update_own"
  ON bill FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "bill_delete_own"
  ON bill FOR DELETE
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- bucket: scoped to user_id = auth.uid()
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "bucket_select_own"  ON bucket;
DROP POLICY IF EXISTS "bucket_insert_own"  ON bucket;
DROP POLICY IF EXISTS "bucket_update_own"  ON bucket;
DROP POLICY IF EXISTS "bucket_delete_own"  ON bucket;

CREATE POLICY "bucket_select_own"
  ON bucket FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "bucket_insert_own"
  ON bucket FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "bucket_update_own"
  ON bucket FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "bucket_delete_own"
  ON bucket FOR DELETE
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- week: scoped to user_id = auth.uid()
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "week_select_own"  ON week;
DROP POLICY IF EXISTS "week_insert_own"  ON week;
DROP POLICY IF EXISTS "week_update_own"  ON week;
DROP POLICY IF EXISTS "week_delete_own"  ON week;

CREATE POLICY "week_select_own"
  ON week FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "week_insert_own"
  ON week FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "week_update_own"
  ON week FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "week_delete_own"
  ON week FOR DELETE
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- bucket_allocation: user owns it if they own the week
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "bucket_allocation_select_own"  ON bucket_allocation;
DROP POLICY IF EXISTS "bucket_allocation_insert_own"  ON bucket_allocation;
DROP POLICY IF EXISTS "bucket_allocation_update_own"  ON bucket_allocation;
DROP POLICY IF EXISTS "bucket_allocation_delete_own"  ON bucket_allocation;

CREATE POLICY "bucket_allocation_select_own"
  ON bucket_allocation FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM week w
      WHERE w.id = bucket_allocation.week_id
        AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "bucket_allocation_insert_own"
  ON bucket_allocation FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM week w
      WHERE w.id = bucket_allocation.week_id
        AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "bucket_allocation_update_own"
  ON bucket_allocation FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM week w
      WHERE w.id = bucket_allocation.week_id
        AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "bucket_allocation_delete_own"
  ON bucket_allocation FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM week w
      WHERE w.id = bucket_allocation.week_id
        AND w.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- transaction: scoped to user_id = auth.uid()
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "transaction_select_own"  ON transaction;
DROP POLICY IF EXISTS "transaction_insert_own"  ON transaction;
DROP POLICY IF EXISTS "transaction_update_own"  ON transaction;
DROP POLICY IF EXISTS "transaction_delete_own"  ON transaction;

CREATE POLICY "transaction_select_own"
  ON transaction FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "transaction_insert_own"
  ON transaction FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "transaction_update_own"
  ON transaction FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "transaction_delete_own"
  ON transaction FOR DELETE
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- bill_status: user owns it if they own the week
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "bill_status_select_own"  ON bill_status;
DROP POLICY IF EXISTS "bill_status_insert_own"  ON bill_status;
DROP POLICY IF EXISTS "bill_status_update_own"  ON bill_status;
DROP POLICY IF EXISTS "bill_status_delete_own"  ON bill_status;

CREATE POLICY "bill_status_select_own"
  ON bill_status FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM week w
      WHERE w.id = bill_status.week_id
        AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "bill_status_insert_own"
  ON bill_status FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM week w
      WHERE w.id = bill_status.week_id
        AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "bill_status_update_own"
  ON bill_status FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM week w
      WHERE w.id = bill_status.week_id
        AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "bill_status_delete_own"
  ON bill_status FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM week w
      WHERE w.id = bill_status.week_id
        AND w.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- schedule_parse: scoped to user_id = auth.uid()
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "schedule_parse_select_own"  ON schedule_parse;
DROP POLICY IF EXISTS "schedule_parse_insert_own"  ON schedule_parse;
DROP POLICY IF EXISTS "schedule_parse_update_own"  ON schedule_parse;
DROP POLICY IF EXISTS "schedule_parse_delete_own"  ON schedule_parse;

CREATE POLICY "schedule_parse_select_own"
  ON schedule_parse FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "schedule_parse_insert_own"
  ON schedule_parse FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "schedule_parse_update_own"
  ON schedule_parse FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "schedule_parse_delete_own"
  ON schedule_parse FOR DELETE
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- classification_config: read-only for authenticated users (singleton config)
-- No INSERT/UPDATE/DELETE from app — service role only via server-side code.
-- Write policies are intentionally absent (Supabase default = deny). Writes
-- must go through createAdminClient() in trusted server-side contexts only.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "classification_config_select_authenticated" ON classification_config;

CREATE POLICY "classification_config_select_authenticated"
  ON classification_config FOR SELECT
  USING (auth.role() = 'authenticated');
