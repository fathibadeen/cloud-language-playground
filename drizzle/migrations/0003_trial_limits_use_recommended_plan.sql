-- During the trial (no plan assigned yet) a company gets the recommended plan's
-- limits instead of the smallest one, so onboarding can create both channels.
CREATE OR REPLACE FUNCTION public.company_limit(_company_id uuid, _key text)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_plan public.plans%rowtype;
BEGIN
  SELECT p.* INTO v_plan
  FROM public.subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE s.company_id = _company_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT * INTO v_plan FROM public.plans WHERE is_active ORDER BY sort_order OFFSET 1 LIMIT 1;
  END IF;
  IF NOT FOUND THEN
    SELECT * INTO v_plan FROM public.plans WHERE is_active ORDER BY sort_order LIMIT 1;
  END IF;
  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN CASE _key
    WHEN 'agents' THEN v_plan.max_agents
    WHEN 'members' THEN v_plan.max_members
    WHEN 'documents' THEN v_plan.max_documents
    WHEN 'numbers' THEN v_plan.max_phone_numbers
    WHEN 'voice_minutes' THEN v_plan.voice_minutes
    WHEN 'whatsapp_messages' THEN v_plan.whatsapp_messages
    ELSE NULL
  END;
END;
$$;