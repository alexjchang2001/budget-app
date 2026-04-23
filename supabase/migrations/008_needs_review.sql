-- Add needs_review flag to transaction so UI can surface mid-confidence classifications.
-- Derivation rule: needs_review = true when confidence < 0.85 AND classification_override = false.
-- Stored explicitly for efficient querying without recomputing thresholds.

ALTER TABLE transaction
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;
