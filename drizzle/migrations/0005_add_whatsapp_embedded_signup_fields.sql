-- WhatsApp Embedded Signup: per-company phone number id + verified name
ALTER TABLE public.whatsapp_accounts
  ADD COLUMN IF NOT EXISTS phone_number_id text,
  ADD COLUMN IF NOT EXISTS verified_name text;