-- ============================================================
-- 0016_growth_core.sql — Sawti Growth (Phase 1)
-- ADDITIVE ONLY: creates new tables. Never alters existing Sawti tables.
-- Conventions follow migrations 0000-0015: RLS + is_company_member /
-- has_company_role / is_super_admin + set_updated_at trigger.
-- Safe defaults: campaigns_paused = true, caller_id_verified = false,
-- legal_review_confirmed = false, global kill switch = ON (fail-closed).
-- ============================================================

-- ------------------------------------------------------------
-- 1) Global kill switch (single row; written ONLY by service_role)
-- ------------------------------------------------------------
CREATE TABLE public.growth_global_flags (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  all_outreach_disabled boolean NOT NULL DEFAULT true,
  reason text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.growth_global_flags TO authenticated;
GRANT ALL ON public.growth_global_flags TO service_role;
ALTER TABLE public.growth_global_flags ENABLE ROW LEVEL SECURITY;

-- No INSERT/UPDATE/DELETE policies for authenticated: the switch is
-- managed exclusively server-side (service_role) — a user can never
-- lift the global pause.
CREATE POLICY "members read global growth flags" ON public.growth_global_flags
  FOR SELECT TO authenticated USING (true);

-- ------------------------------------------------------------
-- 2) Per-company growth settings (compliance is configurable)
-- ------------------------------------------------------------
CREATE TABLE public.growth_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'Asia/Riyadh',
  work_days integer[] NOT NULL DEFAULT '{0,1,2,3,4}', -- Sun..Thu business week
  call_window_start time NOT NULL DEFAULT '09:00',
  call_window_end time NOT NULL DEFAULT '18:00',
  whatsapp_window_start time NOT NULL DEFAULT '09:00',
  whatsapp_window_end time NOT NULL DEFAULT '20:00',
  daily_call_limit integer NOT NULL DEFAULT 20 CHECK (daily_call_limit BETWEEN 0 AND 500),
  daily_message_limit integer NOT NULL DEFAULT 100 CHECK (daily_message_limit BETWEEN 0 AND 2000),
  campaigns_paused boolean NOT NULL DEFAULT true,
  legal_review_confirmed boolean NOT NULL DEFAULT false,
  caller_id_verified boolean NOT NULL DEFAULT false,
  ai_identification_text text NOT NULL DEFAULT 'هذه مكالمة من وكيل ذكاء اصطناعي تابع لشركة',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.growth_settings TO authenticated;
GRANT ALL ON public.growth_settings TO service_role;
ALTER TABLE public.growth_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read growth settings" ON public.growth_settings
  FOR SELECT TO authenticated USING (public.is_company_member(company_id) OR public.is_super_admin());
CREATE POLICY "managers insert growth settings" ON public.growth_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));
CREATE POLICY "managers update growth settings" ON public.growth_settings
  FOR UPDATE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]))
  WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));

CREATE TRIGGER trg_growth_settings_updated BEFORE UPDATE ON public.growth_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 3) Lead sources (CSV import, company websites, licensed providers)
--    No Google Maps scraping; adapters only call compliant APIs.
-- ------------------------------------------------------------
CREATE TABLE public.lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  source_type text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  config jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_sources_type_check CHECK (source_type IN ('csv_import','website','licensed_provider','manual')),
  CONSTRAINT lead_sources_status_check CHECK (status IN ('active','disabled'))
);

CREATE INDEX idx_lead_sources_company ON public.lead_sources (company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_sources TO authenticated;
GRANT ALL ON public.lead_sources TO service_role;
ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read lead sources" ON public.lead_sources
  FOR SELECT TO authenticated USING (public.is_company_member(company_id) OR public.is_super_admin());
CREATE POLICY "members write lead sources" ON public.lead_sources
  FOR INSERT TO authenticated WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin','agent']::public.company_role[]));
CREATE POLICY "members update lead sources" ON public.lead_sources
  FOR UPDATE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin','agent']::public.company_role[]))
  WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin','agent']::public.company_role[]));
CREATE POLICY "managers delete lead sources" ON public.lead_sources
  FOR DELETE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));

CREATE TRIGGER trg_lead_sources_updated BEFORE UPDATE ON public.lead_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 4) Leads (business prospects — B2B context, tenant-scoped)
-- ------------------------------------------------------------
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.lead_sources(id) ON DELETE SET NULL,
  business_name text NOT NULL,
  contact_name text,
  contact_phone text NOT NULL,
  contact_email text,
  website text,
  city text,
  industry text,
  status text NOT NULL DEFAULT 'new',
  fit_score smallint CHECK (fit_score BETWEEN 0 AND 100),
  dedupe_key text NOT NULL, -- normalized phone; unique per tenant
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT leads_status_check CHECK (status IN ('new','enriched','qualified','approved','contacted','converted','rejected','disqualified'))
);

CREATE UNIQUE INDEX idx_leads_company_dedupe ON public.leads (company_id, dedupe_key) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_company_status ON public.leads (company_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read leads" ON public.leads
  FOR SELECT TO authenticated USING (public.is_company_member(company_id) OR public.is_super_admin());
CREATE POLICY "members write leads" ON public.leads
  FOR INSERT TO authenticated WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin','agent']::public.company_role[]));
CREATE POLICY "members update leads" ON public.leads
  FOR UPDATE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin','agent']::public.company_role[]))
  WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin','agent']::public.company_role[]));
CREATE POLICY "managers delete leads" ON public.leads
  FOR DELETE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));

CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 5) Lead enrichments (AI output stored as UNTRUSTED data, versioned)
-- ------------------------------------------------------------
CREATE TABLE public.lead_enrichments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  prompt_version text NOT NULL DEFAULT 'v1',
  industry_classification text,
  suggested_fit_score smallint CHECK (suggested_fit_score BETWEEN 0 AND 100),
  confidence numeric(4,3) CHECK (confidence >= 0 AND confidence <= 1),
  source_provenance text NOT NULL,
  raw_output jsonb NOT NULL,
  human_reviewed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_enrichments_lead ON public.lead_enrichments (lead_id);

GRANT SELECT, INSERT, UPDATE ON public.lead_enrichments TO authenticated;
GRANT ALL ON public.lead_enrichments TO service_role;
ALTER TABLE public.lead_enrichments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read lead enrichments" ON public.lead_enrichments
  FOR SELECT TO authenticated USING (public.is_company_member(company_id) OR public.is_super_admin());
CREATE POLICY "members insert lead enrichments" ON public.lead_enrichments
  FOR INSERT TO authenticated WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin','agent']::public.company_role[]));
CREATE POLICY "members update lead enrichments" ON public.lead_enrichments
  FOR UPDATE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin','agent']::public.company_role[]))
  WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin','agent']::public.company_role[]));

-- ------------------------------------------------------------
-- 6) Consent records (append-only evidence; withdrawal via withdrawn_at)
--    No marketing outreach without a lawful basis documented here.
-- ------------------------------------------------------------
CREATE TABLE public.consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  channel text NOT NULL,
  lawful_basis text NOT NULL,
  purpose text NOT NULL,
  source text NOT NULL, -- where the consent evidence came from
  evidence_url text,
  evidence_text text,
  granted_at timestamptz,
  withdrawn_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consent_channel_check CHECK (channel IN ('call','whatsapp')),
  CONSTRAINT consent_basis_check CHECK (lawful_basis IN ('explicit_consent','existing_customer_contract','legitimate_interest_b2b'))
);

CREATE INDEX idx_consent_company_lead ON public.consent_records (company_id, lead_id);
CREATE INDEX idx_consent_company_channel ON public.consent_records (company_id, channel);

GRANT SELECT, INSERT, UPDATE ON public.consent_records TO authenticated;
GRANT ALL ON public.consent_records TO service_role;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

-- NO DELETE policy: consent evidence is append-only (audit integrity).
CREATE POLICY "members read consent records" ON public.consent_records
  FOR SELECT TO authenticated USING (public.is_company_member(company_id) OR public.is_super_admin());
CREATE POLICY "managers insert consent records" ON public.consent_records
  FOR INSERT TO authenticated WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));
CREATE POLICY "managers update consent records" ON public.consent_records
  FOR UPDATE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]))
  WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));

-- ------------------------------------------------------------
-- 7) Suppression list (global rows: company_id NULL, service_role only)
--    Checked BEFORE every single outreach — nothing may bypass it.
-- ------------------------------------------------------------
CREATE TABLE public.suppression_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE, -- NULL = global
  phone text NOT NULL, -- normalized E.164 (+966...)
  reason text NOT NULL,
  source text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_suppression_global_phone ON public.suppression_list (phone) WHERE company_id IS NULL;
CREATE UNIQUE INDEX idx_suppression_company_phone ON public.suppression_list (company_id, phone) WHERE company_id IS NOT NULL;
CREATE INDEX idx_suppression_phone ON public.suppression_list (phone);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppression_list TO authenticated;
GRANT ALL ON public.suppression_list TO service_role;
ALTER TABLE public.suppression_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read suppression" ON public.suppression_list
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR public.is_company_member(company_id) OR public.is_super_admin());
CREATE POLICY "managers insert tenant suppression" ON public.suppression_list
  FOR INSERT TO authenticated
  WITH CHECK (company_id IS NOT NULL AND public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));
CREATE POLICY "managers update tenant suppression" ON public.suppression_list
  FOR UPDATE TO authenticated
  USING (company_id IS NOT NULL AND public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]))
  WITH CHECK (company_id IS NOT NULL AND public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));
CREATE POLICY "managers delete tenant suppression" ON public.suppression_list
  FOR DELETE TO authenticated
  USING (company_id IS NOT NULL AND public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));
-- Global rows (company_id NULL): no write policy for authenticated → service_role only.

-- ------------------------------------------------------------
-- 8) Approval batches + items (human gate before any outreach)
-- ------------------------------------------------------------
CREATE TABLE public.approval_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  campaign_id uuid, -- FK added after campaigns table
  channel text NOT NULL,
  title text NOT NULL,
  item_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approval_status_check CHECK (status IN ('pending','approved','rejected','cancelled')),
  CONSTRAINT approval_channel_check CHECK (channel IN ('call','whatsapp'))
);

CREATE TABLE public.approval_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.approval_batches(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  decision text NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approval_item_decision_check CHECK (decision IN ('pending','approved','rejected'))
);

CREATE INDEX idx_approval_batches_company ON public.approval_batches (company_id, status);
CREATE INDEX idx_approval_items_batch ON public.approval_items (batch_id, decision);

GRANT SELECT, INSERT, UPDATE ON public.approval_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.approval_items TO authenticated;
GRANT ALL ON public.approval_batches TO service_role;
GRANT ALL ON public.approval_items TO service_role;
ALTER TABLE public.approval_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_items ENABLE ROW LEVEL SECURITY;

-- Approving a batch NEVER creates consent and NEVER bypasses suppression;
-- the runtime re-checks consent + suppression per lead at dial time.
CREATE POLICY "members read approval batches" ON public.approval_batches
  FOR SELECT TO authenticated USING (public.is_company_member(company_id) OR public.is_super_admin());
CREATE POLICY "managers write approval batches" ON public.approval_batches
  FOR INSERT TO authenticated WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin','agent']::public.company_role[]));
CREATE POLICY "managers decide approval batches" ON public.approval_batches
  FOR UPDATE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]))
  WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));

CREATE POLICY "members read approval items" ON public.approval_items
  FOR SELECT TO authenticated USING (public.is_company_member(company_id) OR public.is_super_admin());
CREATE POLICY "members insert approval items" ON public.approval_items
  FOR INSERT TO authenticated WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin','agent']::public.company_role[]));
CREATE POLICY "managers decide approval items" ON public.approval_items
  FOR UPDATE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin','agent']::public.company_role[]))
  WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin','agent']::public.company_role[]));

CREATE TRIGGER trg_approval_batches_updated BEFORE UPDATE ON public.approval_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 9) Campaigns (approval-gated, limit-capped, pausable)
-- ------------------------------------------------------------
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel text NOT NULL,
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  daily_limit integer NOT NULL DEFAULT 20 CHECK (daily_limit BETWEEN 0 AND 500),
  window_start time NOT NULL DEFAULT '09:00',
  window_end time NOT NULL DEFAULT '18:00',
  script_intro text, -- must include honest AI identification
  approved_at timestamptz,
  approved_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_channel_check CHECK (channel IN ('call','whatsapp')),
  CONSTRAINT campaign_status_check CHECK (status IN ('draft','pending_approval','approved','running','paused','completed','stopped')),
  -- A campaign can only run when a human approved it
  CONSTRAINT campaign_running_requires_approval CHECK (status <> 'running' OR approved_at IS NOT NULL)
);

CREATE INDEX idx_campaigns_company_status ON public.campaigns (company_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read campaigns" ON public.campaigns
  FOR SELECT TO authenticated USING (public.is_company_member(company_id) OR public.is_super_admin());
CREATE POLICY "members write campaigns" ON public.campaigns
  FOR INSERT TO authenticated WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin','agent']::public.company_role[]));
CREATE POLICY "managers update campaigns" ON public.campaigns
  FOR UPDATE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]))
  WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));
CREATE POLICY "managers delete campaigns" ON public.campaigns
  FOR DELETE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));

CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- late FK: batches may reference campaigns
ALTER TABLE public.approval_batches
  ADD CONSTRAINT approval_batches_campaign_fk
  FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- 10) Call jobs (queue; every row stores its full compliance verdict)
-- ------------------------------------------------------------
CREATE TABLE public.call_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  approval_item_id uuid REFERENCES public.approval_items(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued',
  compliance_checks jsonb NOT NULL DEFAULT '{}',
  idempotency_key text,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT call_jobs_status_check CHECK (status IN ('queued','compliance_blocked','ready','dialing','done','failed','suppressed','cancelled'))
);

CREATE UNIQUE INDEX idx_call_jobs_idem ON public.call_jobs (company_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_call_jobs_company_status ON public.call_jobs (company_id, status, scheduled_for);

GRANT SELECT, INSERT, UPDATE ON public.call_jobs TO authenticated;
GRANT ALL ON public.call_jobs TO service_role;
ALTER TABLE public.call_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read call jobs" ON public.call_jobs
  FOR SELECT TO authenticated USING (public.is_company_member(company_id) OR public.is_super_admin());
CREATE POLICY "members insert call jobs" ON public.call_jobs
  FOR INSERT TO authenticated WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin','agent']::public.company_role[]));
CREATE POLICY "managers update call jobs" ON public.call_jobs
  FOR UPDATE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]))
  WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));

CREATE TRIGGER trg_call_jobs_updated BEFORE UPDATE ON public.call_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 11) Growth calls (persist Nabrah call ids; facts about real calls)
-- ------------------------------------------------------------
CREATE TABLE public.growth_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  call_job_id uuid NOT NULL REFERENCES public.call_jobs(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  nabrah_call_id text,
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  call_from text,
  call_to text,
  status text NOT NULL DEFAULT 'initiated',
  outcome text,
  duration_sec integer,
  recording_url text,
  transcript jsonb,
  analysis jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT growth_calls_status_check CHECK (status IN ('initiated','ringing','in_progress','completed','failed','no_answer','busy','cancelled'))
);

CREATE UNIQUE INDEX idx_growth_calls_nabrah ON public.growth_calls (company_id, nabrah_call_id) WHERE nabrah_call_id IS NOT NULL;
CREATE INDEX idx_growth_calls_company_created ON public.growth_calls (company_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.growth_calls TO authenticated;
GRANT ALL ON public.growth_calls TO service_role;
ALTER TABLE public.growth_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read growth calls" ON public.growth_calls
  FOR SELECT TO authenticated USING (public.is_company_member(company_id) OR public.is_super_admin());
CREATE POLICY "members insert growth calls" ON public.growth_calls
  FOR INSERT TO authenticated WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin','agent']::public.company_role[]));
CREATE POLICY "managers update growth calls" ON public.growth_calls
  FOR UPDATE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]))
  WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));

CREATE TRIGGER trg_growth_calls_updated BEFORE UPDATE ON public.growth_calls
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 12) Growth messages (approved WhatsApp follow-up only)
-- ------------------------------------------------------------
CREATE TABLE public.growth_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  direction text NOT NULL DEFAULT 'outbound',
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  external_message_id text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  error_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT growth_messages_status_check CHECK (status IN ('pending','sent','delivered','read','failed','suppressed'))
);

CREATE INDEX idx_growth_messages_company_status ON public.growth_messages (company_id, status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.growth_messages TO authenticated;
GRANT ALL ON public.growth_messages TO service_role;
ALTER TABLE public.growth_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read growth messages" ON public.growth_messages
  FOR SELECT TO authenticated USING (public.is_company_member(company_id) OR public.is_super_admin());
CREATE POLICY "members insert growth messages" ON public.growth_messages
  FOR INSERT TO authenticated WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin','agent']::public.company_role[]));
CREATE POLICY "members update growth messages" ON public.growth_messages
  FOR UPDATE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin','agent']::public.company_role[]))
  WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin','agent']::public.company_role[]));

-- ------------------------------------------------------------
-- 13) Sales opportunities (CRM pipeline)
-- ------------------------------------------------------------
CREATE TABLE public.sales_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  stage text NOT NULL DEFAULT 'new',
  value numeric(12,2) CHECK (value >= 0),
  currency text NOT NULL DEFAULT 'SAR',
  owner_user_id uuid,
  next_action_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunities_stage_check CHECK (stage IN ('new','contacted','interested','proposal','negotiation','won','lost'))
);

CREATE INDEX idx_opportunities_company_stage ON public.sales_opportunities (company_id, stage);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_opportunities TO authenticated;
GRANT ALL ON public.sales_opportunities TO service_role;
ALTER TABLE public.sales_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read opportunities" ON public.sales_opportunities
  FOR SELECT TO authenticated USING (public.is_company_member(company_id) OR public.is_super_admin());
CREATE POLICY "members write opportunities" ON public.sales_opportunities
  FOR INSERT TO authenticated WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin','agent']::public.company_role[]));
CREATE POLICY "members update opportunities" ON public.sales_opportunities
  FOR UPDATE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin','agent']::public.company_role[]))
  WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin','agent']::public.company_role[]));
CREATE POLICY "managers delete opportunities" ON public.sales_opportunities
  FOR DELETE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));

CREATE TRIGGER trg_opportunities_updated BEFORE UPDATE ON public.sales_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 14) Conversions (real Sawti registrations + paid subscriptions only)
-- ------------------------------------------------------------
CREATE TABLE public.conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES public.sales_opportunities(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  sawti_registration_id text,
  plan_name text,
  amount numeric(12,2),
  currency text NOT NULL DEFAULT 'SAR',
  status text NOT NULL DEFAULT 'trial',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversions_status_check CHECK (status IN ('trial','paid','churned','refunded'))
);

CREATE INDEX idx_conversions_company_occurred ON public.conversions (company_id, occurred_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.conversions TO authenticated;
GRANT ALL ON public.conversions TO service_role;
ALTER TABLE public.conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read conversions" ON public.conversions
  FOR SELECT TO authenticated USING (public.is_company_member(company_id) OR public.is_super_admin());
CREATE POLICY "managers insert conversions" ON public.conversions
  FOR INSERT TO authenticated WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));
CREATE POLICY "managers update conversions" ON public.conversions
  FOR UPDATE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]))
  WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));

-- ------------------------------------------------------------
-- Seed the global kill-switch row (ON = fail-closed until an
-- administrator verifies SIP + caller ID + legal review).
-- ------------------------------------------------------------
INSERT INTO public.growth_global_flags (id, all_outreach_disabled, reason)
VALUES (1, true, 'Initial fail-closed state — outbound outreach disabled until legal review, SIP outbound config and Saudi caller ID are verified.')
ON CONFLICT (id) DO NOTHING;
