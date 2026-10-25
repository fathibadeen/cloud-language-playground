ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link text, ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general', ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info';
CREATE INDEX IF NOT EXISTS idx_notifications_company_type ON public.notifications (company_id, type);

CREATE TABLE public.notification_preferences (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category text NOT NULL,
  in_app boolean NOT NULL DEFAULT true,
  email boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, category)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read prefs" ON public.notification_preferences FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "admins insert prefs" ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin']::company_role[]));
CREATE POLICY "admins update prefs" ON public.notification_preferences FOR UPDATE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin']::company_role[]));
CREATE POLICY "admins delete prefs" ON public.notification_preferences FOR DELETE TO authenticated USING (public.has_company_role(company_id, ARRAY['owner','admin']::company_role[]));

CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  type text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  body text,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.admin_notifications TO authenticated;
GRANT ALL ON public.admin_notifications TO service_role;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admins read" ON public.admin_notifications FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE POLICY "super admins update" ON public.admin_notifications FOR UPDATE TO authenticated USING (public.is_super_admin());

-- Central writer: respects in-app preference and dedupes by type key.
CREATE OR REPLACE FUNCTION public.push_notification(_company_id uuid, _category text, _type text, _title text, _body text, _link text, _severity text DEFAULT 'info')
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _company_id IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM notification_preferences WHERE company_id=_company_id AND category=_category AND in_app=false) THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM notifications WHERE company_id=_company_id AND type=_type) THEN RETURN false; END IF;
  INSERT INTO notifications(company_id, category, type, title, body, link, severity) VALUES (_company_id, _category, _type, _title, _body, _link, coalesce(_severity,'info'));
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.push_admin_notification(_company_id uuid, _category text, _type text, _title text, _body text, _link text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM admin_notifications WHERE type=_type) THEN RETURN false; END IF;
  INSERT INTO admin_notifications(company_id, category, type, title, body, link) VALUES (_company_id, _category, _type, _title, _body, _link);
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.push_notification(uuid,text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.push_admin_notification(uuid,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_notification(uuid,text,text,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.push_admin_notification(uuid,text,text,text,text,text) TO service_role;

-- Appointments: new agent booking + no-show
CREATE OR REPLACE FUNCTION public.notify_appointment_events() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE when_txt text := to_char(NEW.start_time AT TIME ZONE 'Asia/Riyadh', 'YYYY-MM-DD HH24:MI');
BEGIN
  IF TG_OP = 'INSERT' AND NEW.source <> 'manual' THEN
    PERFORM push_notification(NEW.company_id, 'appointment_new', 'appt_new:'||NEW.id, 'موعد جديد حجزه الوكيل',
      coalesce(NEW.customer_name,'عميل')||' — '||coalesce(NEW.service_name,'موعد')||' — '||when_txt, '/dashboard/appointments', 'success');
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'no_show' AND OLD.status IS DISTINCT FROM 'no_show' THEN
    PERFORM push_notification(NEW.company_id, 'no_show', 'appt_noshow:'||NEW.id, 'مريض/عميل لم يحضر',
      coalesce(NEW.customer_name,'عميل')||' لم يحضر موعد '||when_txt||'. اعرض عليه موعداً بديلاً.', '/dashboard/appointments', 'warning');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_appointments AFTER INSERT OR UPDATE OF status ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.notify_appointment_events();

-- Missed / failed calls
CREATE OR REPLACE FUNCTION public.notify_call_events() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'failed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'failed') THEN
    PERFORM push_notification(NEW.company_id, 'missed_call', 'call_missed:'||NEW.id, 'مكالمة فائتة تحتاج متابعة',
      'من '||coalesce(NEW.from_number,'رقم غير معروف')||' — اتصل به لاسترجاع الطلب.', '/dashboard/calls', 'warning');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_calls AFTER INSERT OR UPDATE OF status ON public.voice_calls FOR EACH ROW EXECUTE FUNCTION public.notify_call_events();

-- Human handoff
CREATE OR REPLACE FUNCTION public.notify_conversation_events() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'needs_human' AND OLD.status IS DISTINCT FROM 'needs_human' THEN
    PERFORM push_notification(NEW.company_id, 'handoff', 'handoff:'||NEW.id||':'||to_char(now(),'YYYYMMDDHH24'), 'محادثة تحتاج موظفاً',
      'عميل ينتظر رداً بشرياً، افتح المحادثة الآن.', '/dashboard/conversations', 'warning');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_conversations AFTER UPDATE OF status ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.notify_conversation_events();

-- Payments: owner + platform admin
CREATE OR REPLACE FUNCTION public.notify_payment_events() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cname text; amt text := to_char(NEW.amount_halalas/100.0, 'FM999999990.00');
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  SELECT name INTO cname FROM companies WHERE id = NEW.company_id;
  IF NEW.status = 'paid' THEN
    PERFORM push_notification(NEW.company_id, 'billing', 'pay_ok:'||NEW.id, 'تم استلام الدفع بنجاح', 'المبلغ '||amt||' ر.س — تم تفعيل اشتراكك.', '/dashboard/billing', 'success');
    PERFORM push_admin_notification(NEW.company_id, 'payment', 'pay_ok:'||NEW.id, 'دفعة جديدة: '||coalesce(cname,''), amt||' ر.س', '/admin');
  ELSIF NEW.status IN ('failed','expired','canceled') THEN
    PERFORM push_notification(NEW.company_id, 'billing', 'pay_fail:'||NEW.id, 'تعذّر إتمام الدفع', 'لم تكتمل عملية الدفع بقيمة '||amt||' ر.س. حاول مرة أخرى.', '/dashboard/billing', 'error');
    PERFORM push_admin_notification(NEW.company_id, 'payment', 'pay_fail:'||NEW.id, 'فشل دفع: '||coalesce(cname,''), amt||' ر.س — الحالة '||NEW.status, '/admin');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_payments AFTER UPDATE OF status ON public.payments FOR EACH ROW EXECUTE FUNCTION public.notify_payment_events();

-- WhatsApp connection errors
CREATE OR REPLACE FUNCTION public.notify_whatsapp_events() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cname text;
BEGIN
  IF NEW.status = 'error' AND OLD.status IS DISTINCT FROM 'error' THEN
    SELECT name INTO cname FROM companies WHERE id = NEW.company_id;
    PERFORM push_notification(NEW.company_id, 'channel', 'wa_err:'||NEW.id||':'||to_char(now(),'YYYYMMDD'), 'انقطع ربط واتساب', 'الوكيل لا يستطيع الرد على واتساب حالياً. أعد الربط من صفحة واتساب.', '/dashboard/whatsapp', 'error');
    PERFORM push_admin_notification(NEW.company_id, 'channel', 'wa_err:'||NEW.id||':'||to_char(now(),'YYYYMMDD'), 'خلل ربط واتساب: '||coalesce(cname,''), NEW.phone_number, '/admin');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_whatsapp AFTER UPDATE OF status ON public.whatsapp_accounts FOR EACH ROW EXECUTE FUNCTION public.notify_whatsapp_events();

-- New company signups (admin)
CREATE OR REPLACE FUNCTION public.notify_company_created() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM push_admin_notification(NEW.id, 'signup', 'company_new:'||NEW.id, 'شركة جديدة سجّلت: '||NEW.name, coalesce(NEW.industry,'')||' '||coalesce(NEW.city,''), '/admin/companies/'||NEW.id);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_company_created AFTER INSERT ON public.companies FOR EACH ROW EXECUTE FUNCTION public.notify_company_created();

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;