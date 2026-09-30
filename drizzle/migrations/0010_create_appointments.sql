CREATE TABLE public.booking_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  timezone text NOT NULL DEFAULT 'Asia/Riyadh',
  work_days integer[] NOT NULL DEFAULT '{0,1,2,3,4}',
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '17:00',
  slot_minutes integer NOT NULL DEFAULT 30,
  services text[] NOT NULL DEFAULT '{}',
  calendar_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_settings TO authenticated;
GRANT ALL ON public.booking_settings TO service_role;
ALTER TABLE public.booking_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read booking settings" ON public.booking_settings
  FOR SELECT TO authenticated USING (public.is_company_member(company_id) OR public.is_super_admin());
CREATE POLICY "managers insert booking settings" ON public.booking_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));
CREATE POLICY "managers update booking settings" ON public.booking_settings
  FOR UPDATE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]))
  WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));

CREATE TRIGGER trg_booking_settings_updated BEFORE UPDATE ON public.booking_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  call_id uuid REFERENCES public.voice_calls(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  customer_name text,
  customer_phone text,
  service_name text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'confirmed',
  source text NOT NULL DEFAULT 'manual',
  google_event_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointments_status_check CHECK (status IN ('confirmed','cancelled','completed','rescheduled')),
  CONSTRAINT appointments_source_check CHECK (source IN ('voice_call','whatsapp','manual'))
);

CREATE INDEX idx_appointments_company_start ON public.appointments (company_id, start_time);
CREATE UNIQUE INDEX idx_appointments_call ON public.appointments (call_id) WHERE call_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read appointments" ON public.appointments
  FOR SELECT TO authenticated USING (public.is_company_member(company_id) OR public.is_super_admin());
CREATE POLICY "members insert appointments" ON public.appointments
  FOR INSERT TO authenticated WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin','agent']::public.company_role[]));
CREATE POLICY "members update appointments" ON public.appointments
  FOR UPDATE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin','agent']::public.company_role[]))
  WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin','agent']::public.company_role[]));
CREATE POLICY "managers delete appointments" ON public.appointments
  FOR DELETE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));

CREATE TRIGGER trg_appointments_updated BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();