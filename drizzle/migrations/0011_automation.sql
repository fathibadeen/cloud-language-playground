-- Phase A: Automation infrastructure
-- Add provider_ref to webhook_events for reliable retry
-- Add indexes for job queries

ALTER TABLE public.webhook_events 
  ADD COLUMN IF NOT EXISTS provider_ref text;

COMMENT ON COLUMN public.webhook_events.provider_ref IS 
  'Provider-specific reference (agent UUID for nabrah, phone_number_id for whatsapp)';

-- Indexes for job performance
CREATE INDEX IF NOT EXISTS idx_webhook_events_retry 
  ON public.webhook_events (status, created_at, attempts) 
  WHERE status = 'failed' AND attempts < 5;

CREATE INDEX IF NOT EXISTS idx_conversations_sla 
  ON public.conversations (status, created_at) 
  WHERE status = 'pending' AND assigned_user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_janitor 
  ON public.conversations (status, last_message_at) 
  WHERE status = 'resolved' AND summary IS NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_cycle 
  ON public.subscriptions (status, current_period_end) 
  WHERE status = 'active';
