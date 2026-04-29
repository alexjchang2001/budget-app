-- Create storage bucket for schedule screenshots if it does not already exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('schedule-screenshots', 'schedule-screenshots', true)
ON CONFLICT (id) DO NOTHING;
