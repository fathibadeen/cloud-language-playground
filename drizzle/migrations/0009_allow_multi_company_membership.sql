CREATE OR REPLACE FUNCTION public.create_company_with_owner(_payload jsonb, _service text DEFAULT 'both'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.companies (
    name, cr_number, industry, description, website, address, city,
    contact_phone, contact_email, default_locale,
    voice_enabled, whatsapp_enabled, onboarding_completed, onboarding_step, created_by
  ) values (
    coalesce(nullif(_payload->>'name',''), 'Company'),
    nullif(_payload->>'cr_number',''),
    nullif(_payload->>'industry',''),
    nullif(_payload->>'description',''),
    nullif(_payload->>'website',''),
    nullif(_payload->>'address',''),
    nullif(_payload->>'city',''),
    nullif(_payload->>'contact_phone',''),
    nullif(_payload->>'contact_email',''),
    coalesce(nullif(_payload->>'default_locale',''), 'ar'),
    _service <> 'whatsapp',
    _service <> 'voice',
    true, 7, v_uid
  )
  returning id into v_company_id;

  insert into public.company_members (company_id, user_id, role)
  values (v_company_id, v_uid, 'owner');

  return v_company_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.accept_company_invitation(_token text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  INSERT INTO public.company_members (company_id, user_id, role, invited_email)
  VALUES (v_inv.company_id, v_uid, v_inv.role, v_inv.email)
  ON CONFLICT DO NOTHING;

  UPDATE public.company_invitations
  SET accepted_at = now(), accepted_by = v_uid
  WHERE id = v_inv.id;

  RETURN v_inv.company_id;
END;
$function$;