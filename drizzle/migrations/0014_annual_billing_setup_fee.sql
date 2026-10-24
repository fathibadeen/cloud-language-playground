ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS billing_period text NOT NULL DEFAULT 'monthly';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS setup_fee_halalas integer NOT NULL DEFAULT 0;
UPDATE public.plans SET price_sar = 999 WHERE code = 'bundle_pro' AND price_sar < 999;