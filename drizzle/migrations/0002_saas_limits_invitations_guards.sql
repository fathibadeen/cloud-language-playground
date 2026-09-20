-- 1. Effective plan limits for a company (falls back to the cheapest active plan)
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
    SELECT * INTO v_plan FROM public.plans WHERE is_active ORDER BY price_sar ASC LIMIT 1;
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

GRANT EXECUTE ON FUNCTION public.company_limit(uuid, text) TO authenticated, service_role;

-- 2. Is the company allowed to use the service right now?
CREATE OR REPLACE FUNCTION public.company_is_active(_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.company_status;
  v_sub_status public.subscription_status;
  v_period_end timestamptz;
BEGIN
  SELECT status INTO v_status FROM public.companies WHERE id = _company_id;
  IF v_status IS NULL THEN RETURN true; END IF;
  IF v_status <> 'active' THEN RETURN false; END IF;

  SELECT status, current_period_end INTO v_sub_status, v_period_end
  FROM public.subscriptions WHERE company_id = _company_id
  ORDER BY created_at DESC LIMIT 1;

  IF v_sub_status IS NULL THEN RETURN true; END IF;
  IF v_sub_status = 'canceled' THEN RETURN false; END IF;
  IF v_period_end < now() AND v_sub_status IN ('trialing', 'past_due') THEN RETURN false; END IF;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.company_is_active(uuid) TO authenticated, service_role;

-- 3. Monthly usage aggregate
CREATE OR REPLACE FUNCTION public.company_usage_this_month(_company_id uuid, _metric text)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(sum(quantity), 0)
  FROM public.usage_records
  WHERE company_id = _company_id
    AND metric = _metric
    AND occurred_at >= date_trunc('month', now());
$$;

GRANT EXECUTE ON FUNCTION public.company_usage_this_month(uuid, text) TO authenticated, service_role;

-- 4. Enforce suspension + plan resource limits on insert
CREATE OR REPLACE FUNCTION public.enforce_company_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_count integer;
  v_key text := TG_ARGV[0];
  v_table text := TG_ARGV[1];
BEGIN
  IF NOT public.company_is_active(NEW.company_id) THEN
    RAISE EXCEPTION 'company_inactive';
  END IF;

  v_limit := public.company_limit(NEW.company_id, v_key);
  IF v_limit IS NULL OR v_limit <= 0 THEN RETURN NEW; END IF;

  EXECUTE format('SELECT count(*) FROM public.%I WHERE company_id = $1', v_table)
    INTO v_count USING NEW.company_id;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'plan_limit_reached:%', v_key;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_limit_agents BEFORE INSERT ON public.ai_agents
FOR EACH ROW EXECUTE FUNCTION public.enforce_company_limits('agents', 'ai_agents');

CREATE TRIGGER trg_limit_documents BEFORE INSERT ON public.knowledge_documents
FOR EACH ROW EXECUTE FUNCTION public.enforce_company_limits('documents', 'knowledge_documents');

CREATE TRIGGER trg_limit_numbers BEFORE INSERT ON public.phone_numbers
FOR EACH ROW EXECUTE FUNCTION public.enforce_company_limits('numbers', 'phone_numbers');

CREATE TRIGGER trg_limit_members BEFORE INSERT ON public.company_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_company_limits('members', 'company_members');

-- 5. Never let a company lose its last owner; nobody changes their own role
CREATE OR REPLACE FUNCTION public.protect_company_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_owners integer;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.user_id = auth.uid() AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'cannot_change_own_role';
  END IF;

  IF OLD.role = 'owner' AND (TG_OP = 'DELETE' OR NEW.role IS DISTINCT FROM 'owner') THEN
    SELECT count(*) INTO v_owners
    FROM public.company_members
    WHERE company_id = OLD.company_id AND role = 'owner';
    IF v_owners <= 1 THEN
      RAISE EXCEPTION 'last_owner_required';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_owner BEFORE UPDATE OR DELETE ON public.company_members
FOR EACH ROW EXECUTE FUNCTION public.protect_company_owner();

-- 6. Real team invitations
CREATE TABLE public.company_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.company_role NOT NULL DEFAULT 'agent',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by uuid REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_invitations TO authenticated;
GRANT ALL ON public.company_invitations TO service_role;

ALTER TABLE public.company_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitations admin select" ON public.company_invitations
FOR SELECT TO authenticated
USING (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]) OR public.is_super_admin());

CREATE POLICY "invitations admin insert" ON public.company_invitations
FOR INSERT TO authenticated
WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));

CREATE POLICY "invitations admin update" ON public.company_invitations
FOR UPDATE TO authenticated
USING (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]))
WITH CHECK (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));

CREATE POLICY "invitations admin delete" ON public.company_invitations
FOR DELETE TO authenticated
USING (public.has_company_role(company_id, ARRAY['owner','admin']::public.company_role[]));

CREATE INDEX idx_invitations_company ON public.company_invitations (company_id, created_at DESC);

-- 7. Accepting an invitation
CREATE OR REPLACE FUNCTION public.accept_company_invitation(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_inv public.company_invitations%rowtype;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  SELECT * INTO v_inv FROM public.company_invitations WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
  IF v_inv.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'invitation_already_used'; END IF;
  IF v_inv.expires_at < now() THEN RAISE EXCEPTION 'invitation_expired'; END IF;
  IF lower(v_inv.email) <> lower(coalesce(v_email, '')) THEN RAISE EXCEPTION 'invitation_email_mismatch'; END IF;

  IF EXISTS (SELECT 1 FROM public.company_members WHERE user_id = v_uid AND company_id <> v_inv.company_id) THEN
    RAISE EXCEPTION 'user_already_belongs_to_another_company';
  END IF;

  INSERT INTO public.company_members (company_id, user_id, role, invited_email)
  VALUES (v_inv.company_id, v_uid, v_inv.role, v_inv.email)
  ON CONFLICT DO NOTHING;

  UPDATE public.company_invitations
  SET accepted_at = now(), accepted_by = v_uid
  WHERE id = v_inv.id;

  RETURN v_inv.company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_company_invitation(text) TO authenticated;

-- 8. Members may read and dismiss their own notifications; system writes them
CREATE INDEX IF NOT EXISTS idx_notifications_company ON public.notifications (company_id, created_at DESC);