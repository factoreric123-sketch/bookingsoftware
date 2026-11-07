CREATE FUNCTION public.create_member_invitation(p_actor_user_id uuid,p_business_id uuid,p_email text,p_role text,p_location_ids uuid[],p_permissions jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  m public.business_members%ROWTYPE;
  email_normalized text := lower(btrim(p_email));
  locations_normalized uuid[] := COALESCE(p_location_ids,ARRAY[]::uuid[]);
  supplied jsonb := COALESCE(p_permissions,'{}'::jsonb);
  permissions_normalized jsonb := '{}'::jsonb;
  flags text[] := ARRAY['can_manage_customers','can_manage_services','can_manage_staff','can_manage_forms','can_manage_messages','can_manage_automations','can_view_analytics','can_manage_billing'];
  flag text;
  loc uuid;
  enabled boolean;
  invitation uuid := gen_random_uuid();
  token text;
  expiry timestamptz := now()+interval '7 days';
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'active owner or staff-managing manager required' USING ERRCODE='P0403';
  END IF;
  -- Serialize invitation creation for this business, including duplicate checks.
  PERFORM 1 FROM public.businesses WHERE id=p_business_id FOR UPDATE;
  SELECT * INTO m FROM public.business_members
    WHERE business_id=p_business_id AND user_id=p_actor_user_id AND active FOR SHARE;
  IF NOT FOUND OR NOT (m.role='owner' OR (m.role='manager' AND m.can_manage_staff)) THEN
    RAISE EXCEPTION 'active owner or staff-managing manager required' USING ERRCODE='P0403';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('manager','staff') THEN
    RAISE EXCEPTION 'invitation role must be manager or staff' USING ERRCODE='P0400';
  END IF;
  IF m.role='manager' AND p_role<>'staff' THEN
    RAISE EXCEPTION 'managers can invite staff only' USING ERRCODE='P0403';
  END IF;
  IF email_normalized IS NULL OR length(email_normalized)>254
     OR length(split_part(email_normalized,'@',1))>64
     OR email_normalized !~ '^[a-z0-9!#$%&''*+/=?^_`{|}~-]+([.][a-z0-9!#$%&''*+/=?^_`{|}~-]+)*@[a-z0-9]([a-z0-9-]*[a-z0-9])?([.][a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' THEN
    RAISE EXCEPTION 'valid invitation email required' USING ERRCODE='P0400';
  END IF;
  IF jsonb_typeof(supplied) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'permissions must be an object of documented boolean flags' USING ERRCODE='P0400';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_each(supplied) e WHERE NOT (e.key=ANY(flags)) OR jsonb_typeof(e.value) IS DISTINCT FROM 'boolean') THEN
    RAISE EXCEPTION 'permissions must contain only documented boolean flags' USING ERRCODE='P0400';
  END IF;
  FOREACH flag IN ARRAY flags LOOP
    enabled := COALESCE((supplied->>flag)::boolean,false);
    IF m.role='manager' AND enabled AND NOT (to_jsonb(m)->>flag)::boolean THEN
      RAISE EXCEPTION 'cannot grant a permission the inviter lacks' USING ERRCODE='P0403';
    END IF;
    IF p_role='staff' AND enabled THEN
      RAISE EXCEPTION 'staff invitation permissions must all be false' USING ERRCODE='P0400';
    END IF;
    permissions_normalized := permissions_normalized || jsonb_build_object(flag,enabled);
  END LOOP;
  IF COALESCE(array_ndims(locations_normalized),1)<>1 OR array_position(locations_normalized,NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'location IDs must be a one-dimensional array without nulls' USING ERRCODE='P0400';
  END IF;
  -- Acceptance interprets an empty array as all_locations=true; never widen a scoped manager.
  IF cardinality(locations_normalized)=0 AND m.role='manager' AND NOT m.all_locations THEN
    RAISE EXCEPTION 'scoped managers must supply accessible location IDs' USING ERRCODE='P0403';
  END IF;
  FOREACH loc IN ARRAY locations_normalized LOOP
    PERFORM 1 FROM public.locations WHERE business_id=p_business_id AND id=loc FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'location does not belong to this business' USING ERRCODE='P0403';
    END IF;
    IF m.role='manager' AND NOT m.all_locations THEN
      PERFORM 1 FROM public.member_locations WHERE business_id=p_business_id AND business_member_id=m.id AND location_id=loc FOR SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION 'location is outside inviter scope' USING ERRCODE='P0403'; END IF;
    END IF;
  END LOOP;
  SELECT COALESCE(array_agg(DISTINCT x ORDER BY x),ARRAY[]::uuid[]) INTO locations_normalized FROM unnest(locations_normalized) x;
  IF EXISTS(SELECT 1 FROM public.member_invitations WHERE business_id=p_business_id AND email=email_normalized AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now()) THEN
    RAISE EXCEPTION 'an active invitation already exists for this email' USING ERRCODE='P0409';
  END IF;
  token := private.generate_capability_token();
  INSERT INTO public.member_invitations(id,business_id,email,role,location_ids,permissions,invited_by_user_id,expires_at)
    VALUES(invitation,p_business_id,email_normalized,p_role,locations_normalized,permissions_normalized,p_actor_user_id,expiry);
  INSERT INTO private.capability_tokens(business_id,kind,invitation_id,token_hash,expires_at)
    VALUES(p_business_id,'member_invitation',invitation,extensions.digest(token,'sha256'),expiry);
  RETURN jsonb_build_object('invitation_id',invitation,'token',token,'expires_at',expiry);
END;
$function$;
REVOKE ALL ON FUNCTION public.create_member_invitation(uuid,uuid,text,text,uuid[],jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_member_invitation(uuid,uuid,text,text,uuid[],jsonb) TO service_role;

-- Rollback-only regression fixtures: no invitations, tokens, memberships or scope changes remain.
DO $tests$
DECLARE
 a uuid := 'a2000000-0000-4000-8000-000000000001';
 b uuid := 'b2000000-0000-4000-8000-000000000001';
 owner_a uuid := '47fff988-90c4-4129-b072-146f8e35b701';
 owner_b uuid := '8317c8b5-0dfb-4f08-965b-55b3e51fd1da';
 la uuid := 'a3000000-0000-4000-8000-000000000001';
 lb uuid := 'b3000000-0000-4000-8000-000000000001';
 manager_id uuid;
 recipient_email text;
 prefix text := 'inv-reg-'||substr(gen_random_uuid()::text,1,12);
 result jsonb;
 redemption jsonb;
 invitation uuid;
 one_time_token text;
 blocked boolean;
 checks integer:=0;
 item record;
 accept_before text := pg_get_functiondef('public.accept_member_invitation(text,text,uuid)'::regprocedure);
BEGIN
 BEGIN
  SELECT id INTO STRICT manager_id FROM public.business_members WHERE business_id=a AND user_id=owner_b;
  UPDATE public.business_members SET role='manager',active=true,can_manage_staff=true,can_manage_billing=false,all_locations=false WHERE id=manager_id;
  INSERT INTO public.member_locations(business_id,business_member_id,location_id) VALUES(a,manager_id,la) ON CONFLICT DO NOTHING;

  PERFORM set_config('role','service_role',true);
  result := public.create_member_invitation(owner_a,a,'  '||upper(prefix)||'@EXAMPLE.COM  ','manager',ARRAY[la],'{"can_manage_forms":true}');
  PERFORM set_config('role','postgres',true);
  invitation := (result->>'invitation_id')::uuid;
  one_time_token := result->>'token';
  IF NOT EXISTS(SELECT 1 FROM public.member_invitations WHERE id=invitation AND email=prefix||'@example.com' AND invited_by_user_id=owner_a AND permissions->'can_manage_forms'='true'::jsonb AND expires_at=now()+interval '7 days') THEN RAISE EXCEPTION 'owner create/normalization/expiry failed'; END IF;
  checks:=checks+1;
  IF length(one_time_token)<>43 OR NOT EXISTS(SELECT 1 FROM private.capability_tokens WHERE invitation_id=invitation AND kind='member_invitation' AND token_hash=extensions.digest(one_time_token,'sha256') AND octet_length(token_hash)=32 AND token_hash<>convert_to(one_time_token,'UTF8') AND expires_at=(result->>'expires_at')::timestamptz) THEN RAISE EXCEPTION 'token digest or expiry failed'; END IF;
  checks:=checks+1;

  -- Concrete denial cases, executed as the actual service_role.
  FOR item IN SELECT * FROM (VALUES
   (owner_a,a,prefix||'@example.com','staff',ARRAY[la],'{}'::jsonb,'P0409','duplicate'),
   (owner_b,a,prefix||'-manager@example.com','manager',ARRAY[la],'{}'::jsonb,'P0403','manager inviting manager'),
   (owner_a,a,prefix||'-owner@example.com','owner',ARRAY[la],'{}'::jsonb,'P0400','owner role'),
   (owner_b,a,prefix||'-grant@example.com','staff',ARRAY[la],'{"can_manage_billing":true}'::jsonb,'P0403','permission escalation'),
   (owner_b,a,prefix||'-foreign@example.com','staff',ARRAY[lb],'{}'::jsonb,'P0403','foreign location'),
   (owner_b,a,prefix||'-all@example.com','staff',ARRAY[]::uuid[],'{}'::jsonb,'P0403','scoped all-location escalation'),
   (owner_a,b,prefix||'-tenant@example.com','staff',ARRAY[lb],'{}'::jsonb,'P0403','cross tenant'),
   (NULL::uuid,a,prefix||'-null@example.com','staff',ARRAY[la],'{}'::jsonb,'P0403','null actor'),
   (owner_a,a,'not-an-email','staff',ARRAY[la],'{}'::jsonb,'P0400','invalid email'),
   (owner_a,a,prefix||'-unknown@example.com','staff',ARRAY[la],'{"admin":true}'::jsonb,'P0400','unknown permission'),
   (owner_a,a,prefix||'-string@example.com','staff',ARRAY[la],'{"can_manage_staff":"true"}'::jsonb,'P0400','string permission'),
   (owner_a,a,prefix||'-number@example.com','staff',ARRAY[la],'{"can_manage_staff":1}'::jsonb,'P0400','number permission'),
   (owner_a,a,prefix||'-jsonnull@example.com','staff',ARRAY[la],'{"can_manage_staff":null}'::jsonb,'P0400','null permission'),
   (owner_a,a,prefix||'-array@example.com','staff',ARRAY[la],'[]'::jsonb,'P0400','array permissions'),
   (owner_a,a,prefix||'-stafftrue@example.com','staff',ARRAY[la],'{"can_manage_forms":true}'::jsonb,'P0400','staff true permission'),
   (owner_a,a,prefix||'-nullloc@example.com','staff',ARRAY[NULL::uuid],'{}'::jsonb,'P0400','null location')
  ) AS cases(actor,business,email,role,locations,permissions,code,label) LOOP
   blocked:=false;
   BEGIN
    PERFORM set_config('role','service_role',true);
    PERFORM public.create_member_invitation(item.actor,item.business,item.email,item.role,item.locations,item.permissions);
    PERFORM set_config('role','postgres',true);
   EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE<>item.code THEN RAISE EXCEPTION 'case % returned unexpected SQLSTATE %',item.label,SQLSTATE; END IF;
    blocked:=true;
   END;
   IF NOT blocked THEN RAISE EXCEPTION 'case % was allowed',item.label; END IF;
   checks:=checks+1;
  END LOOP;

  PERFORM set_config('role','service_role',true);
  result:=public.create_member_invitation(owner_b,a,prefix||'-scoped@example.com','staff',ARRAY[la,la],NULL);
  PERFORM set_config('role','postgres',true);
  IF NOT EXISTS(SELECT 1 FROM public.member_invitations WHERE id=(result->>'invitation_id')::uuid AND location_ids=ARRAY[la] AND (SELECT count(*) FROM jsonb_each(permissions))=8 AND NOT EXISTS(SELECT 1 FROM jsonb_each(permissions) e WHERE e.value<>'false'::jsonb)) THEN RAISE EXCEPTION 'scoped staff defaults failed'; END IF;
  checks:=checks+1;

  DELETE FROM public.member_locations WHERE business_id=a AND business_member_id=manager_id AND location_id=la;
  blocked:=false;
  BEGIN
   PERFORM set_config('role','service_role',true);
   PERFORM public.create_member_invitation(owner_b,a,prefix||'-outscope@example.com','staff',ARRAY[la],'{}');
  EXCEPTION WHEN SQLSTATE 'P0403' THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'unassigned location allowed'; END IF;
  checks:=checks+1;

  FOR item IN SELECT * FROM (VALUES ('staff',true,true),('manager',false,true),('manager',true,false)) x(role,active,manage_staff) LOOP
   UPDATE public.business_members SET role=item.role,active=item.active,can_manage_staff=item.manage_staff WHERE id=manager_id;
   blocked:=false;
   BEGIN
    PERFORM set_config('role','service_role',true);
    PERFORM public.create_member_invitation(owner_b,a,prefix||'-denied@example.com','staff',ARRAY[la],'{}');
   EXCEPTION WHEN SQLSTATE 'P0403' THEN blocked:=true;
   END;
   IF NOT blocked THEN RAISE EXCEPTION 'staff/inactive/missing permission allowed'; END IF;
   checks:=checks+1;
  END LOOP;

  -- Owner B invites owner A, who has no membership in B. Read email internally; never log it or tokens.
  SELECT email INTO STRICT recipient_email FROM auth.users WHERE id=owner_a;
  PERFORM set_config('role','service_role',true);
  result:=public.create_member_invitation(owner_b,b,recipient_email,'staff',ARRAY[lb],'{}');
  PERFORM set_config('role','postgres',true);
  invitation:=(result->>'invitation_id')::uuid;
  one_time_token:=result->>'token';
  blocked:=false;
  BEGIN
   PERFORM public.accept_member_invitation(prefix||'-wrong',one_time_token,owner_b);
  EXCEPTION WHEN SQLSTATE 'P0403' THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'wrong email redemption allowed'; END IF;
  checks:=checks+1;

  -- Existing accept RPC reads auth.users but service_role lacks SELECT: preserve and expose this limitation.
  blocked:=false;
  BEGIN
   PERFORM set_config('role','service_role',true);
   PERFORM public.accept_member_invitation(prefix||'-service',one_time_token,owner_a);
  EXCEPTION WHEN insufficient_privilege THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'expected existing service-role auth.users limitation not reproduced'; END IF;
  checks:=checks+1;

  redemption:=public.accept_member_invitation(prefix||'-matching',one_time_token,owner_a);
  IF NOT EXISTS(SELECT 1 FROM public.business_members WHERE id=(redemption->>'business_member_id')::uuid AND business_id=b AND user_id=owner_a AND role='staff' AND NOT all_locations AND NOT can_manage_staff)
    OR NOT EXISTS(SELECT 1 FROM public.member_locations WHERE business_id=b AND business_member_id=(redemption->>'business_member_id')::uuid AND location_id=lb)
    OR NOT EXISTS(SELECT 1 FROM public.member_invitations WHERE id=invitation AND accepted_at IS NOT NULL)
    OR NOT EXISTS(SELECT 1 FROM private.capability_tokens WHERE invitation_id=invitation AND revoked_at IS NOT NULL AND last_used_at IS NOT NULL) THEN RAISE EXCEPTION 'matching actor redemption failed'; END IF;
  checks:=checks+1;
  blocked:=false;
  BEGIN
   PERFORM public.accept_member_invitation(prefix||'-replay',one_time_token,owner_a);
  EXCEPTION WHEN SQLSTATE 'P0403' THEN blocked:=true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'token replay allowed'; END IF;
  checks:=checks+1;

  FOR item IN SELECT unnest(ARRAY['anon','authenticated']) AS role LOOP
   blocked:=false;
   BEGIN
    PERFORM set_config('role',item.role,true);
    PERFORM public.create_member_invitation(owner_a,a,prefix||'-direct@example.com','staff',ARRAY[la],'{}');
   EXCEPTION WHEN insufficient_privilege THEN blocked:=true;
   END;
   IF NOT blocked THEN RAISE EXCEPTION 'direct % execution allowed',item.role; END IF;
   checks:=checks+1;
  END LOOP;
  IF accept_before<>pg_get_functiondef('public.accept_member_invitation(text,text,uuid)'::regprocedure)
    OR has_function_privilege('anon','public.accept_member_invitation(text,text,uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.accept_member_invitation(text,text,uuid)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.accept_member_invitation(text,text,uuid)','EXECUTE') THEN RAISE EXCEPTION 'accept semantics or grants changed'; END IF;
  checks:=checks+1;
  IF checks<>30 THEN RAISE EXCEPTION 'expected 30 checks, got %',checks; END IF;
  RAISE NOTICE '30/30 assertions passed, including reproduction of existing service-role redemption failure (42501); matching-actor redemption passed as migration role only';
  RAISE SQLSTATE 'Z0003' USING MESSAGE='rollback invitation regression fixtures';
 EXCEPTION WHEN SQLSTATE 'Z0003' THEN NULL;
 END;
 IF EXISTS(SELECT 1 FROM public.member_invitations WHERE email LIKE prefix||'%') OR EXISTS(SELECT 1 FROM public.member_invitations WHERE id=invitation) THEN RAISE EXCEPTION 'invitation fixture rollback failed'; END IF;
 RAISE NOTICE 'All invitation regression fixtures rolled back';
END;
$tests$;