-- Reproduce the service-role failure with isolated, rollback-only fixtures.
DO $baseline$
DECLARE a uuid:=gen_random_uuid(); o uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); i uuid:=gen_random_uuid(); t text:=private.generate_capability_token(); e text:='accept-baseline-'||a||'@example.test';
BEGIN
 BEGIN
  INSERT INTO auth.users(id,email,email_confirmed_at) VALUES(a,e,now());
  INSERT INTO public.organizations(id,name,slug) VALUES(o,'Acceptance baseline','accept-baseline-'||o);
  INSERT INTO public.businesses(id,organization_id,name,slug) VALUES(b,o,'Acceptance baseline','accept-baseline-'||b);
  INSERT INTO public.member_invitations(id,business_id,email,role,expires_at) VALUES(i,b,e,'staff',now()+interval '7 days');
  INSERT INTO private.capability_tokens(business_id,kind,invitation_id,token_hash,expires_at) VALUES(b,'member_invitation',i,extensions.digest(t,'sha256'),now()+interval '7 days');
  EXECUTE 'SET LOCAL ROLE service_role';
  BEGIN
   PERFORM public.accept_member_invitation('baseline-'||a,t,a);
   RAISE EXCEPTION 'baseline unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
   IF SQLERRM NOT LIKE '%users%' THEN RAISE; END IF;
  END;
  EXECUTE 'RESET ROLE';
  RAISE EXCEPTION USING ERRCODE='Z0001',MESSAGE='baseline rollback';
 EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;
 END;
 RAISE NOTICE 'Baseline PASS: service_role acceptance fails 42501 on auth.users; fixtures rolled back';
END;
$baseline$;

-- Only a boolean is exposed: no directory rows or email values are returned.
CREATE FUNCTION private.invitation_actor_has_verified_email(p_actor_user_id uuid,p_invited_email text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $helper$
 SELECT EXISTS (
  SELECT 1 FROM auth.users AS u
  WHERE u.id=p_actor_user_id
    AND u.email_confirmed_at IS NOT NULL
    AND u.email IS NOT NULL
    AND lower(u.email)=p_invited_email
 );
$helper$;
REVOKE ALL ON FUNCTION private.invitation_actor_has_verified_email(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.invitation_actor_has_verified_email(uuid,text) TO service_role;

-- Replace only the email lookup/check; retain every other statement verbatim.
DO $repair$
DECLARE old_definition text:=pg_get_functiondef('public.accept_member_invitation(text,text,uuid)'::regprocedure);
 old_check text := E'  SELECT email INTO v_email FROM auth.users WHERE id = p_actor_user_id;\n  IF lower(v_email) <> v_invite.email THEN';
 new_check text := E'  IF NOT private.invitation_actor_has_verified_email(p_actor_user_id, v_invite.email) THEN';
BEGIN
 IF strpos(old_definition,old_check)=0 THEN RAISE EXCEPTION 'Expected acceptance email check not found; refusing unrelated changes'; END IF;
 EXECUTE replace(old_definition,old_check,new_check);
END;
$repair$;
REVOKE ALL ON FUNCTION public.accept_member_invitation(text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.accept_member_invitation(text,text,uuid) TO service_role;

-- Live transactional regressions. All fixtures and side effects are rolled back.
DO $tests$
DECLARE
 a uuid:=gen_random_uuid(); other_actor uuid:=gen_random_uuid(); unverified uuid:=gen_random_uuid(); missing_actor uuid:=gen_random_uuid();
 o uuid:=gen_random_uuid(); b1 uuid:=gen_random_uuid(); b2 uuid:=gen_random_uuid(); l1 uuid:=gen_random_uuid(); l2 uuid:=gen_random_uuid();
 e text:='accept-'||a||'@example.test'; e2 text:='accept-'||other_actor||'@example.test'; eu text:='accept-'||unverified||'@example.test';
 ids uuid[]:=ARRAY[]::uuid[]; tokens text[]:=ARRAY[]::text[]; invitation uuid; token text; j integer; result jsonb; member uuid; outcome text;
 tests integer:=0;
BEGIN
 BEGIN
  INSERT INTO auth.users(id,email,email_confirmed_at) VALUES(a,e,now()),(other_actor,e2,now()),(unverified,eu,NULL);
  INSERT INTO public.organizations(id,name,slug) VALUES(o,'Acceptance regression','accept-test-'||o);
  INSERT INTO public.businesses(id,organization_id,name,slug) VALUES(b1,o,'Acceptance A','accept-test-'||b1),(b2,o,'Acceptance B','accept-test-'||b2);
  INSERT INTO public.locations(id,business_id,name,slug) VALUES(l1,b1,'Location A','a'),(l2,b2,'Location B','b');
  -- Cases: verified success, mismatch, unverified, expired token, revoked token,
  -- expired invitation, revoked invitation, already accepted, tenant B success, missing actor, null actor.
  FOR j IN 1..11 LOOP
   invitation:=gen_random_uuid(); token:=private.generate_capability_token(); ids:=array_append(ids,invitation); tokens:=array_append(tokens,token);
   INSERT INTO public.member_invitations(id,business_id,email,role,location_ids,permissions,expires_at,revoked_at,accepted_at)
   VALUES(invitation,CASE WHEN j=9 THEN b2 ELSE b1 END,CASE WHEN j=3 THEN eu WHEN j=9 THEN e2 ELSE e END,
    'manager',ARRAY[CASE WHEN j=9 THEN l2 ELSE l1 END],'{"can_manage_customers":true,"can_view_analytics":true}'::jsonb,
    CASE WHEN j=6 THEN now()-interval '1 second' ELSE now()+interval '7 days' END,
    CASE WHEN j=7 THEN now() ELSE NULL END,CASE WHEN j=8 THEN now() ELSE NULL END);
   INSERT INTO private.capability_tokens(business_id,kind,invitation_id,token_hash,expires_at,revoked_at)
   VALUES(CASE WHEN j=9 THEN b2 ELSE b1 END,'member_invitation',invitation,extensions.digest(token,'sha256'),
    CASE WHEN j=4 THEN now()-interval '1 second' ELSE now()+interval '7 days' END,CASE WHEN j=5 THEN now() ELSE NULL END);
  END LOOP;
  EXECUTE 'SET LOCAL ROLE service_role';
  IF current_user<>'service_role' THEN RAISE EXCEPTION 'tests must run as service_role'; END IF;
  result:=public.accept_member_invitation('accept-success-'||a,tokens[1],a);
  member:=(result->>'business_member_id')::uuid;
  IF result->>'business_id'<>b1::text OR result->>'role'<>'manager' THEN RAISE EXCEPTION 'wrong success response'; END IF;
  tests:=tests+1;
  IF NOT EXISTS(SELECT 1 FROM public.business_members WHERE id=member AND business_id=b1 AND user_id=a AND role='manager' AND active AND NOT all_locations AND can_manage_customers AND can_view_analytics AND NOT can_manage_staff AND NOT can_manage_billing) THEN RAISE EXCEPTION 'membership/permissions incorrect'; END IF;
  tests:=tests+1;
  IF (SELECT count(*) FROM public.member_locations WHERE business_member_id=member)<>1 OR NOT EXISTS(SELECT 1 FROM public.member_locations WHERE business_member_id=member AND business_id=b1 AND location_id=l1) THEN RAISE EXCEPTION 'location scope incorrect'; END IF;
  tests:=tests+1;
  IF NOT EXISTS(SELECT 1 FROM private.audit_logs WHERE business_id=b1 AND actor_user_id=a AND action='member.invitation_accepted' AND entity_id=member AND actor_type='user') THEN RAISE EXCEPTION 'audit absent'; END IF;
  tests:=tests+1;
  IF NOT EXISTS(SELECT 1 FROM public.member_invitations WHERE id=ids[1] AND accepted_at IS NOT NULL) OR NOT EXISTS(SELECT 1 FROM private.capability_tokens WHERE invitation_id=ids[1] AND revoked_at IS NOT NULL AND last_used_at IS NOT NULL AND token_hash=extensions.digest(tokens[1],'sha256')) THEN RAISE EXCEPTION 'redemption state incorrect'; END IF;
  tests:=tests+1;
  FOR j IN 1..11 LOOP
   IF j=9 THEN CONTINUE; END IF;
   outcome:=NULL;
   BEGIN
    PERFORM public.accept_member_invitation('accept-denial-'||a||'-'||j,tokens[j],CASE WHEN j=2 THEN other_actor WHEN j=3 THEN unverified WHEN j=10 THEN missing_actor WHEN j=11 THEN NULL ELSE a END);
   EXCEPTION WHEN OTHERS THEN outcome:=SQLSTATE;
   END;
   IF outcome IS DISTINCT FROM (CASE WHEN j IN (6,7,8) THEN 'P0409' ELSE 'P0403' END) THEN RAISE EXCEPTION 'denial case % returned %',j,outcome; END IF;
   tests:=tests+1;
  END LOOP;
  outcome:=NULL;
  BEGIN PERFORM public.accept_member_invitation('accept-forged-'||a,tokens[9]||'x',other_actor); EXCEPTION WHEN OTHERS THEN outcome:=SQLSTATE; END;
  IF outcome IS DISTINCT FROM 'P0403' THEN RAISE EXCEPTION 'forged digest accepted'; END IF;
  tests:=tests+1;
  outcome:=NULL;
  BEGIN PERFORM public.accept_member_invitation('accept-cross-'||a,tokens[9],a); EXCEPTION WHEN OTHERS THEN outcome:=SQLSTATE; END;
  IF outcome IS DISTINCT FROM 'P0403' THEN RAISE EXCEPTION 'cross-business wrong actor accepted'; END IF;
  tests:=tests+1;
  result:=public.accept_member_invitation('accept-tenant-b-'||a,tokens[9],other_actor);
  IF result->>'business_id'<>b2::text OR EXISTS(SELECT 1 FROM public.business_members WHERE (user_id=a AND business_id=b2) OR (user_id=other_actor AND business_id=b1)) OR NOT EXISTS(SELECT 1 FROM public.member_locations WHERE business_id=b2 AND business_member_id=(result->>'business_member_id')::uuid AND location_id=l2) THEN RAISE EXCEPTION 'tenant isolation failed'; END IF;
  tests:=tests+1;
  IF EXISTS(SELECT 1 FROM public.member_invitations WHERE id=ANY(ids[2:8]) AND id<>ids[8] AND accepted_at IS NOT NULL) OR EXISTS(SELECT 1 FROM public.business_members WHERE user_id=unverified) THEN RAISE EXCEPTION 'denials changed membership or acceptance'; END IF;
  tests:=tests+1;
  EXECUTE 'SET LOCAL ROLE anon';
  outcome:=NULL;
  BEGIN PERFORM public.accept_member_invitation('direct-anon',tokens[2],a); EXCEPTION WHEN OTHERS THEN outcome:=SQLSTATE; END;
  IF outcome IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'anon not denied'; END IF;
  tests:=tests+1;
  EXECUTE 'RESET ROLE'; EXECUTE 'SET LOCAL ROLE authenticated';
  outcome:=NULL;
  BEGIN PERFORM public.accept_member_invitation('direct-auth',tokens[2],a); EXCEPTION WHEN OTHERS THEN outcome:=SQLSTATE; END;
  IF outcome IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'authenticated not denied'; END IF;
  tests:=tests+1;
  EXECUTE 'RESET ROLE';
  IF has_table_privilege('service_role','auth.users','SELECT') OR has_function_privilege('anon','private.invitation_actor_has_verified_email(uuid,text)','EXECUTE') OR has_function_privilege('authenticated','private.invitation_actor_has_verified_email(uuid,text)','EXECUTE') OR NOT has_function_privilege('service_role','private.invitation_actor_has_verified_email(uuid,text)','EXECUTE') OR NOT has_function_privilege('service_role','public.accept_member_invitation(text,text,uuid)','EXECUTE') THEN RAISE EXCEPTION 'least-privilege grants failed'; END IF;
  tests:=tests+1;
  IF tests<>22 THEN RAISE EXCEPTION 'expected 22 assertions, got %',tests; END IF;
  RAISE EXCEPTION USING ERRCODE='Z0001',MESSAGE='rollback all acceptance fixtures';
 EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;
 END;
 IF EXISTS(SELECT 1 FROM auth.users WHERE id IN (a,other_actor,unverified)) OR EXISTS(SELECT 1 FROM public.organizations WHERE id=o) OR EXISTS(SELECT 1 FROM public.member_invitations WHERE id=ANY(ids)) OR EXISTS(SELECT 1 FROM private.audit_logs WHERE actor_user_id IN (a,other_actor,unverified)) THEN RAISE EXCEPTION 'fixture rollback failed'; END IF;
 RAISE NOTICE 'Acceptance repair PASS: 22/22 assertions as actual database roles; all fixtures and side effects rolled back';
END;
$tests$;