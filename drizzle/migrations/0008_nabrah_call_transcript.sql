ALTER TABLE public.voice_calls
  ADD COLUMN IF NOT EXISTS transcript jsonb,
  ADD COLUMN IF NOT EXISTS analysis jsonb,
  ADD COLUMN IF NOT EXISTS call_type text,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz;