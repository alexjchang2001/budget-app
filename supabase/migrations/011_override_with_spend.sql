-- Atomic transaction bucket override that also adjusts bucket_allocation.spent_amount.
-- Replaces the two-step (UPDATE transaction + client-side reconciliation) approach.

CREATE OR REPLACE FUNCTION override_transaction_bucket(
  p_tx_id         uuid,
  p_new_bucket_id uuid,
  p_user_id       uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_bucket_id uuid;
  v_week_id       uuid;
  v_amount        integer;
BEGIN
  SELECT bucket_id, week_id, amount
    INTO v_old_bucket_id, v_week_id, v_amount
  FROM transaction
  WHERE id = p_tx_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'transaction not found';
  END IF;

  UPDATE transaction
  SET bucket_id = p_new_bucket_id,
      classification_override = true
  WHERE id = p_tx_id;

  IF v_week_id IS NOT NULL THEN
    IF v_old_bucket_id IS NOT NULL THEN
      UPDATE bucket_allocation
      SET spent_amount = GREATEST(0, spent_amount - v_amount)
      WHERE week_id = v_week_id AND bucket_id = v_old_bucket_id;
    END IF;

    UPDATE bucket_allocation
    SET spent_amount = spent_amount + v_amount
    WHERE week_id = v_week_id AND bucket_id = p_new_bucket_id;
  END IF;
END;
$$;
