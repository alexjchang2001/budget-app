-- Make schedule-screenshots storage bucket private.
-- The raw_screenshot_url column now stores the storage path (not a public URL).
-- Signed URLs should be generated on-demand when access is needed.

UPDATE storage.buckets
SET public = false
WHERE id = 'schedule-screenshots';
