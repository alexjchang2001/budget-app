-- Fix run_allocation_writes so that a second deposit mid-week does not clobber
-- bucket_allocation adjustments made by prior bill confirmations (confirm_bill_reroute).
-- After the regular upserts, re-deduct confirmed bill totals from the bills bucket
-- and route the freed amount to the highest-priority non-bill bucket.

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
  alloc             jsonb;
  bill_rec          record;
  confirmed_total   integer;
  target_bucket_id  uuid;
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

  -- Re-apply deductions for bills already confirmed this week.
  -- The upsert above resets allocated_amount to the full bill total, erasing
  -- any prior confirm_bill_reroute adjustments. Subtract confirmed amounts from
  -- the bills bucket and add them back to the highest-priority non-bill bucket.
  SELECT COALESCE(SUM(b.amount), 0) INTO confirmed_total
  FROM bill_status bs
  JOIN bill b ON b.id = bs.bill_id
  WHERE bs.week_id = p_week_id AND bs.status != 'unpaid';

  IF confirmed_total > 0 THEN
    UPDATE bucket_allocation ba
    SET allocated_amount = GREATEST(0, ba.allocated_amount - confirmed_total)
    WHERE ba.week_id = p_week_id
      AND ba.bucket_id IN (
        SELECT id FROM bucket WHERE user_id = p_user_id AND type = 'bills'
      );

    SELECT ba.bucket_id INTO target_bucket_id
    FROM bucket_allocation ba
    JOIN bucket bk ON bk.id = ba.bucket_id
    WHERE ba.week_id = p_week_id
      AND bk.user_id = p_user_id
      AND bk.type != 'bills'
    ORDER BY
      CASE bk.type
        WHEN 'debt'    THEN 1
        WHEN 'savings' THEN 2
        WHEN 'food'    THEN 3
        WHEN 'flex'    THEN 4
        ELSE 5 + bk.priority_order
      END
    LIMIT 1;

    IF target_bucket_id IS NOT NULL THEN
      UPDATE bucket_allocation
      SET allocated_amount = allocated_amount + confirmed_total
      WHERE week_id = p_week_id AND bucket_id = target_bucket_id;
    END IF;
  END IF;
END;
$$;
