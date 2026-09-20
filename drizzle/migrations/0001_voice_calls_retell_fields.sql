ALTER TABLE public.voice_calls
  ADD COLUMN IF NOT EXISTS recording_url text,
  ADD COLUMN IF NOT EXISTS ended_reason text;

CREATE UNIQUE INDEX IF NOT EXISTS voice_calls_provider_call_id_key
  ON public.voice_calls (provider, provider_call_id)
  WHERE provider_call_id IS NOT NULL;

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS provider_llm_id text,
  ADD COLUMN IF NOT EXISTS provider_status text NOT NULL DEFAULT 'not_connected',
  ADD COLUMN IF NOT EXISTS provider_error text;

CREATE INDEX IF NOT EXISTS ai_agents_provider_agent_id_idx ON public.ai_agents (provider_agent_id);
CREATE INDEX IF NOT EXISTS phone_numbers_phone_idx ON public.phone_numbers (phone_number);

ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_calls;