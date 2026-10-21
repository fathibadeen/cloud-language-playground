CREATE TABLE public.platform_payment_settings (
  provider text PRIMARY KEY DEFAULT 'moyasar',
  publishable_key text,
  secret_key text,
  webhook_secret text,
  mode text NOT NULL DEFAULT 'test' CHECK (mode IN ('test','live')),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.platform_payment_settings TO service_role;
ALTER TABLE public.platform_payment_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'moyasar',
  moyasar_invoice_id text UNIQUE,
  moyasar_payment_id text,
  amount_halalas integer NOT NULL,
  vat_halalas integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'initiated',
  applied boolean NOT NULL DEFAULT false,
  raw jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read company payments" ON public.payments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id = payments.company_id AND m.user_id = auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE INDEX payments_company_idx ON public.payments(company_id, created_at DESC);