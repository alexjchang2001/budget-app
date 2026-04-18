-- Atomic allocation write — wraps bucket_allocation upserts, week update,
-- and bill_status creation in a single transaction.
-- Called via supabase.rpc('run_allocation_writes', ...) from the allocation engine.

CREATE OR REPLACE FUNCTION run_allocation_writes(
  p_week_id           uuid,
  p_user_id           uuid,
  p_allocations       jsonb,
  p_rounding_residue  integer DEFAULT 0
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  alloc    jsonb;
  bill_rec record;
BEGIN
  -- Upsert bucket allocations.
  -- opening_allocated_amount is snapshotted on first insert only; never updated.
  FOR alloc IN SELECT * FROM jsonb_array_elements(p_allocations)
  LOOP
    INSERT INTO bucket_allocation (
      week_id, bucket_id,
      allocated_amount, opening_allocated_amount,
      spent_amount, floor_amount
    ) VALUES (
      p_week_id,
      (alloc->>'bucket_id')::uuid,
      (alloc->>'allocated_amount')::integer,
      (alloc->>'allocated_amount')::integer,
      0,
      COALESCE((alloc->>'floor_amount')::integer, 0)
    )
    ON CONFLICT (week_id, bucket_id) DO UPDATE SET
      allocated_amount = EXCLUDED.allocated_amount,
      floor_amount     = EXCLUDED.floor_amount;
    -- opening_allocated_amount intentionally excluded from UPDATE
  END LOOP;

  -- Record rounding residue on the week row
  UPDATE week SET rounding_residue = p_rounding_residue WHERE id = p_week_id;

  -- Create bill_status rows for every active bill (idempotent)
  FOR bill_rec IN
    SELECT id FROM bill WHERE user_id = p_user_id AND active = true
  LOOP
    INSERT INTO bill_status (week_id, bill_id, status)
    VALUES (p_week_id, bill_rec.id, 'unpaid')
    ON CONFLICT (week_id, bill_id) DO NOTHING;
  END LOOP;
END;
$$;
