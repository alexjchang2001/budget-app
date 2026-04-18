-- Atomic bill confirmation + re-routing in a single transaction.
-- Called via supabase.rpc('confirm_bill_reroute', ...) from the confirm route.

CREATE OR REPLACE FUNCTION confirm_bill_reroute(
  p_week_id          uuid,
  p_bill_id          uuid,
  p_bills_bucket_id  uuid,
  p_target_bucket_id uuid,       -- nullable: no non-bill bucket edge case
  p_freed_amount     integer,
  p_confirmed_by     text,
  p_transaction_id   uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mark bill as confirmed
  UPDATE bill_status
  SET
    status         = CASE
                       WHEN p_confirmed_by = 'teller'
                       THEN 'teller_confirmed'::bill_payment_status
                       ELSE 'manually_confirmed'::bill_payment_status
                     END,
    confirmed_at   = now(),
    confirmed_by   = p_confirmed_by::confirmed_by_type,
    transaction_id = p_transaction_id
  WHERE week_id = p_week_id AND bill_id = p_bill_id;

  -- Decrement bills bucket allocation
  UPDATE bucket_allocation
  SET allocated_amount = allocated_amount - p_freed_amount
  WHERE week_id = p_week_id AND bucket_id = p_bills_bucket_id;

  -- Route freed amount to the highest-priority non-bill bucket (if any)
  IF p_target_bucket_id IS NOT NULL THEN
    UPDATE bucket_allocation
    SET allocated_amount = allocated_amount + p_freed_amount
    WHERE week_id = p_week_id AND bucket_id = p_target_bucket_id;
  END IF;
END;
$$;
