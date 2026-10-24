CREATE TABLE public.clinic_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  specialty text NOT NULL DEFAULT 'general',
  map_url text,
  arrival_details text,
  insurance text[] NOT NULL DEFAULT '{}',
  pre_visit_instructions jsonb NOT NULL DEFAULT '{}'::jsonb,
  cancellation_policy text,
  payment_policy text,
  emergency_number text NOT NULL DEFAULT '997',
  recording_notice text NOT NULL DEFAULT 'تنبيه: هذه المكالمة مسجلة لأغراض تحسين الخدمة، وباستمرارك توافق على ذلك.',
  reminder_24h boolean NOT NULL DEFAULT true,
  reminder_2h boolean NOT NULL DEFAULT true,
  followup_enabled boolean NOT NULL DEFAULT true,
  noshow_recovery boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.clinic_settings TO authenticated;
GRANT ALL ON public.clinic_settings TO service_role;
ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read clinic settings" ON public.clinic_settings FOR SELECT TO authenticated USING (public.is_company_member(company_id) OR public.is_super_admin());
CREATE POLICY "managers insert clinic settings" ON public.clinic_settings FOR INSERT TO authenticated WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));
CREATE POLICY "managers update clinic settings" ON public.clinic_settings FOR UPDATE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[])) WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));
CREATE TRIGGER trg_clinic_settings_updated BEFORE UPDATE ON public.clinic_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.clinic_doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  specialty text,
  work_days integer[] NOT NULL DEFAULT '{0,1,2,3,4}',
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '17:00',
  services text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinic_doctors_company ON public.clinic_doctors (company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_doctors TO authenticated;
GRANT ALL ON public.clinic_doctors TO service_role;
ALTER TABLE public.clinic_doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read doctors" ON public.clinic_doctors FOR SELECT TO authenticated USING (public.is_company_member(company_id) OR public.is_super_admin());
CREATE POLICY "managers insert doctors" ON public.clinic_doctors FOR INSERT TO authenticated WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));
CREATE POLICY "managers update doctors" ON public.clinic_doctors FOR UPDATE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[])) WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));
CREATE POLICY "managers delete doctors" ON public.clinic_doctors FOR DELETE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));
CREATE TRIGGER trg_clinic_doctors_updated BEFORE UPDATE ON public.clinic_doctors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.appointments ADD COLUMN doctor_id uuid REFERENCES public.clinic_doctors(id) ON DELETE SET NULL;
ALTER TABLE public.appointments ADD COLUMN reminder_24h_at timestamptz;
ALTER TABLE public.appointments ADD COLUMN reminder_2h_at timestamptz;
ALTER TABLE public.appointments ADD COLUMN followup_at timestamptz;
ALTER TABLE public.appointments ADD COLUMN noshow_contacted_at timestamptz;
ALTER TABLE public.appointments ADD COLUMN patient_confirmed boolean;
ALTER TABLE public.appointments DROP CONSTRAINT appointments_status_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check CHECK (status IN ('confirmed','cancelled','completed','rescheduled','no_show'));