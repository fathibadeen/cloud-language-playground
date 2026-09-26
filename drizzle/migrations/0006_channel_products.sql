ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS product text NOT NULL DEFAULT 'bundle';
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'basic';

CREATE OR REPLACE FUNCTION public.company_limit(_company_id uuid, _key text)
 RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_plan public.plans%rowtype; v_product text; v_voice boolean; v_wa boolean;
BEGIN
  SELECT p.* INTO v_plan FROM public.subscriptions s JOIN public.plans p ON p.id = s.plan_id
  WHERE s.company_id = _company_id ORDER BY s.created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    SELECT voice_enabled, whatsapp_enabled INTO v_voice, v_wa FROM public.companies WHERE id = _company_id;
    v_product := CASE WHEN coalesce(v_voice,true) AND coalesce(v_wa,true) THEN 'bundle' WHEN v_voice THEN 'voice' ELSE 'whatsapp' END;
    SELECT * INTO v_plan FROM public.plans WHERE is_active AND product = v_product ORDER BY price_sar LIMIT 1;
  END IF;
  IF NOT FOUND THEN
    SELECT * INTO v_plan FROM public.plans WHERE is_active ORDER BY sort_order LIMIT 1;
  END IF;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN CASE _key
    WHEN 'agents' THEN v_plan.max_agents WHEN 'members' THEN v_plan.max_members
    WHEN 'documents' THEN v_plan.max_documents WHEN 'numbers' THEN v_plan.max_phone_numbers
    WHEN 'voice_minutes' THEN v_plan.voice_minutes WHEN 'whatsapp_messages' THEN v_plan.whatsapp_messages
    ELSE NULL END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_channel_enabled()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_ch text := TG_ARGV[0]; v_ok boolean;
BEGIN
  IF v_ch = 'agent' THEN v_ch := NEW.channel::text; END IF;
  SELECT CASE WHEN v_ch = 'voice' THEN voice_enabled ELSE whatsapp_enabled END INTO v_ok
  FROM public.companies WHERE id = NEW.company_id;
  IF v_ok IS FALSE THEN RAISE EXCEPTION 'channel_not_enabled:%', v_ch; END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_channel_numbers ON public.phone_numbers;
CREATE TRIGGER trg_channel_numbers BEFORE INSERT ON public.phone_numbers FOR EACH ROW EXECUTE FUNCTION public.enforce_channel_enabled('voice');
DROP TRIGGER IF EXISTS trg_channel_wa ON public.whatsapp_accounts;
CREATE TRIGGER trg_channel_wa BEFORE INSERT ON public.whatsapp_accounts FOR EACH ROW EXECUTE FUNCTION public.enforce_channel_enabled('whatsapp');
DROP TRIGGER IF EXISTS trg_channel_agents ON public.ai_agents;
CREATE TRIGGER trg_channel_agents BEFORE INSERT ON public.ai_agents FOR EACH ROW EXECUTE FUNCTION public.enforce_channel_enabled('agent');