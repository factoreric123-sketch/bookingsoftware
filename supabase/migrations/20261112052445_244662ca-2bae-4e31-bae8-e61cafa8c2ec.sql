CREATE FUNCTION public.update_member_access(
 p_actor_user_id uuid,
 p_business_id uuid,
 p_member_id uuid,
 p_expected_row_version bigint,
 p_role text,
 p_active boolean,
 p_all_locations boolean,
 p_can_manage_customers boolean,
 p_can_manage_services boolean,
 p_can_manage_staff boolean,
 p_can_manage_forms boolean,
 p_can_manage_messages boolean,
 p_can_manage_automations boolean,
 p_can_view_analytics boolean,
 p_can_manage_billing boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
 v_before public.business_members%ROWTYPE;
 v_after public.business_members%ROWTYPE;
 v_actor_id uuid;
 v_location_id uuid;
 v_has_location boolean := false;
 v_request_id uuid := pg_catalog.gen_random_uuid();
BEGIN
 -- Stabilize the actor membership while checking explicit-actor authorization.
 SELECT bm.id INTO v_actor_id
 FROM public.business_members bm
 WHERE bm.business_id = p_business_id AND bm.user_id = p_actor_user_id
 FOR SHARE;
 IF v_actor_id IS NULL OR private.actor_business_role(p_business_id,p_actor_user_id) IS DISTINCT FROM 'owner' THEN
  RAISE EXCEPTION USING ERRCODE='P0403', MESSAGE='active business owner required';
 END IF;
 IF p_member_id = v_actor_id THEN
  RAISE EXCEPTION USING ERRCODE='P0403', MESSAGE='cannot edit own membership';
 END IF;
 SELECT * INTO v_before FROM public.business_members bm
 WHERE bm.id=p_member_id AND bm.business_id=p_business_id
 FOR UPDATE;
 IF NOT FOUND THEN
  RAISE EXCEPTION USING ERRCODE='P0403', MESSAGE='member does not belong to business';
 END IF;
 IF v_before.role='owner' THEN
  RAISE EXCEPTION USING ERRCODE='P0403', MESSAGE='cannot edit owner membership';
 END IF;
 IF p_expected_row_version IS NULL OR v_before.row_version <> p_expected_row_version THEN
  RAISE EXCEPTION USING ERRCODE='P0409', MESSAGE='membership version changed';
 END IF;
 IF p_role IS NULL OR p_role NOT IN ('manager','staff') THEN
  RAISE EXCEPTION USING ERRCODE='P0422', MESSAGE='role must be manager or staff';
 END IF;
 IF p_active IS NULL OR p_all_locations IS NULL
 OR p_can_manage_customers IS NULL OR p_can_manage_services IS NULL
 OR p_can_manage_staff IS NULL OR p_can_manage_forms IS NULL
 OR p_can_manage_messages IS NULL OR p_can_manage_automations IS NULL
 OR p_can_view_analytics IS NULL OR p_can_manage_billing IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='P0422', MESSAGE='access flags must be explicit booleans';
 END IF;
 IF p_role='staff' AND (p_all_locations OR p_can_manage_customers OR p_can_manage_services
 OR p_can_manage_staff OR p_can_manage_forms OR p_can_manage_messages
 OR p_can_manage_automations OR p_can_view_analytics OR p_can_manage_billing) THEN
  RAISE EXCEPTION USING ERRCODE='P0422', MESSAGE='staff cannot have manager permissions or all locations';
 END IF;
 IF p_role='manager' AND NOT p_all_locations THEN
  -- Preserve existing assignments and protect them from concurrent removal until commit.
  FOR v_location_id IN
   SELECT ml.location_id FROM public.member_locations ml
   WHERE ml.business_id=p_business_id AND ml.business_member_id=p_member_id
   FOR SHARE
  LOOP
   v_has_location := true;
  END LOOP;
  IF NOT v_has_location THEN
   RAISE EXCEPTION USING ERRCODE='P0422', MESSAGE='scoped manager requires an assigned location';
  END IF;
 END IF;
 UPDATE public.business_members bm SET
 role=p_role, active=p_active, all_locations=p_all_locations,
 can_manage_customers=p_can_manage_customers, can_manage_services=p_can_manage_services,
 can_manage_staff=p_can_manage_staff, can_manage_forms=p_can_manage_forms,
 can_manage_messages=p_can_manage_messages, can_manage_automations=p_can_manage_automations,
 can_view_analytics=p_can_view_analytics, can_manage_billing=p_can_manage_billing
 WHERE bm.id=v_before.id AND bm.business_id=v_before.business_id
 RETURNING bm.* INTO v_after;
 INSERT INTO private.audit_logs
 (actor_user_id,actor_type,business_id,action,entity_type,entity_id,request_id,changes)
 VALUES (p_actor_user_id,'user',p_business_id,'update_member_access','business_member',v_before.id,
 v_request_id,pg_catalog.jsonb_build_object('before',pg_catalog.to_jsonb(v_before),'after',pg_catalog.to_jsonb(v_after)));
 RETURN pg_catalog.to_jsonb(v_after);
END;
$function$;
REVOKE ALL ON FUNCTION public.update_member_access(uuid,uuid,uuid,bigint,text,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.update_member_access(uuid,uuid,uuid,bigint,text,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean) TO service_role;