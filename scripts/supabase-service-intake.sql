-- Apply atomically through the Supabase connector.
CREATE TABLE private.service_intake_settings (
  business_id uuid NOT NULL,
  service_id uuid NOT NULL,
  form_id uuid NOT NULL,
  timing text NOT NULL CHECK (timing IN ('required_before','optional_after')),
  row_version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (business_id,service_id),
  FOREIGN KEY (business_id,service_id) REFERENCES public.services(business_id,id),
  FOREIGN KEY (business_id,form_id) REFERENCES public.forms(business_id,id)
);
CREATE INDEX service_intake_form ON private.service_intake_settings(business_id,form_id);
ALTER TABLE private.service_intake_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON private.service_intake_settings TO service_role;
REVOKE ALL ON private.service_intake_settings FROM PUBLIC,anon,authenticated;
CREATE POLICY service_intake_server ON private.service_intake_settings TO service_role USING (true) WITH CHECK (true);
CREATE INDEX intake_consumed_hold ON public.appointment_holds(business_id,consumed_appointment_id)
  WHERE consumed_appointment_id IS NOT NULL;
CREATE INDEX intake_appointment_response ON public.form_submissions(business_id,appointment_id,form_version_id)
  WHERE source='booking' AND appointment_id IS NOT NULL;

CREATE FUNCTION public.get_service_intake_settings(p_business_id uuid,p_actor_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $fn$
BEGIN
  IF private.actor_business_role(p_business_id,p_actor_user_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Owner access is required' USING ERRCODE='P0403';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(i)-'business_id' ORDER BY i.service_id)
    FROM private.service_intake_settings i WHERE i.business_id=p_business_id),'[]');
END;
$fn$;

CREATE FUNCTION public.save_service_intake_settings(p_business_id uuid,p_actor_user_id uuid,p_service_id uuid,
  p_form_id uuid,p_timing text,p_expected_row_version bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE saved private.service_intake_settings%ROWTYPE; form_version uuid;
BEGIN
  IF private.actor_business_role(p_business_id,p_actor_user_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Owner access is required' USING ERRCODE='P0403';
  END IF;
  PERFORM 1 FROM public.services WHERE business_id=p_business_id AND id=p_service_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Service not found' USING ERRCODE='P0404'; END IF;
  SELECT * INTO saved FROM private.service_intake_settings WHERE business_id=p_business_id AND service_id=p_service_id;
  IF saved.row_version IS DISTINCT FROM p_expected_row_version THEN
    RAISE EXCEPTION 'Intake settings changed. Reload before saving.' USING ERRCODE='P0409';
  END IF;
  IF p_form_id IS NULL THEN
    DELETE FROM private.service_intake_settings WHERE business_id=p_business_id AND service_id=p_service_id;
    RETURN NULL;
  END IF;
  SELECT f.active_version_id INTO form_version FROM public.forms f JOIN public.form_versions v
    ON v.business_id=f.business_id AND v.id=f.active_version_id AND v.form_id=f.id AND v.published_at IS NOT NULL
    WHERE f.business_id=p_business_id AND f.id=p_form_id AND f.status='published';
  IF form_version IS NULL OR p_timing IS NULL OR p_timing NOT IN ('required_before','optional_after')
    OR EXISTS(SELECT FROM public.form_fields WHERE business_id=p_business_id AND form_version_id=form_version AND field_type='file')
  THEN RAISE EXCEPTION 'Choose a published form without file uploads and a collection time' USING ERRCODE='P0422'; END IF;
  INSERT INTO private.service_intake_settings AS i (business_id,service_id,form_id,timing)
    VALUES(p_business_id,p_service_id,p_form_id,p_timing)
    ON CONFLICT (business_id,service_id) DO UPDATE SET form_id=excluded.form_id,timing=excluded.timing,row_version=i.row_version+1
    RETURNING * INTO saved;
  RETURN to_jsonb(saved)-'business_id';
END;
$fn$;

CREATE FUNCTION private.intake_snapshot(bid uuid,sid uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $fn$
DECLARE result jsonb; mode text;
BEGIN
  SELECT i.timing INTO mode FROM private.service_intake_settings i WHERE i.business_id=bid AND i.service_id=sid;
  IF mode IS NULL THEN RETURN NULL; END IF;
  SELECT jsonb_build_object('name',f.name,'description',f.description,'form_id',f.id,
    'version_id',v.id,'timing',mode,'fields',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',ff.id,'field_key',ff.field_key,'label',ff.label,'field_type',ff.field_type,'required',ff.required,
      'placeholder',ff.placeholder,'help_text',ff.help_text,'options',ff.options,'validation',ff.validation,
      'visibility_rule',ff.visibility_rule) ORDER BY ff.sort_order)
      FROM public.form_fields ff WHERE ff.business_id=bid AND ff.form_version_id=v.id),'[]'))
  INTO result
  FROM private.service_intake_settings i JOIN public.forms f ON f.business_id=i.business_id AND f.id=i.form_id
  JOIN public.form_versions v ON v.business_id=f.business_id AND v.form_id=f.id AND v.id=f.active_version_id
  WHERE i.business_id=bid AND i.service_id=sid AND f.status='published' AND v.published_at IS NOT NULL
    AND NOT EXISTS(SELECT FROM public.form_fields ff WHERE ff.business_id=bid AND ff.form_version_id=v.id AND ff.field_type='file');
  IF result IS NULL AND mode='required_before' THEN
    RAISE EXCEPTION 'The required intake form is unavailable. Contact the business to book.' USING ERRCODE='P0409';
  END IF;
  RETURN result;
END;
$fn$;

CREATE FUNCTION private.store_booking_intake(bid uuid, aid uuid, cid uuid, snapshot jsonb, payload jsonb, request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE field jsonb; rule jsonb; val jsonb; actual jsonb; field_key text; kind text;
  answers jsonb := payload->'answers'; cleaned jsonb := '{}'; submission uuid;
BEGIN
  IF jsonb_typeof(answers) IS DISTINCT FROM 'object' OR length(answers::text)>50000
    OR payload->>'version_id' IS DISTINCT FROM snapshot->>'version_id'
  THEN RAISE EXCEPTION 'Complete the current intake form before submitting' USING ERRCODE='P0422'; END IF;
  FOR field IN SELECT value FROM jsonb_array_elements(snapshot->'fields') LOOP
    rule:=field->'visibility_rule';
    IF jsonb_typeof(rule)='object' THEN
      actual:=answers->(rule->>'field_key');
      IF NOT coalesce(CASE rule->>'operator'
        WHEN 'equals' THEN actual=rule->'value'
        WHEN 'not_equals' THEN actual IS DISTINCT FROM rule->'value'
        WHEN 'contains' THEN strpos(coalesce(actual#>>'{}',''),rule->>'value')>0
        WHEN 'is_checked' THEN (actual IS NOT DISTINCT FROM 'true'::jsonb)=(rule->'value'='true'::jsonb)
        ELSE true END,false) THEN CONTINUE; END IF;
    END IF;
    field_key:=field->>'field_key'; kind:=field->>'field_type'; val:=answers->field_key;
    IF val IS NULL OR val='null' OR btrim(val#>>'{}')='' THEN
      IF (field->>'required')::boolean THEN
        RAISE EXCEPTION 'Required intake answer: %', field->>'label' USING ERRCODE='P0422';
      END IF;
      CONTINUE;
    END IF;
    IF kind IN ('checkbox','consent') THEN
      IF jsonb_typeof(val)<>'boolean' OR ((field->>'required')::boolean AND val<>'true') THEN
        RAISE EXCEPTION 'Invalid intake answer: %',field->>'label' USING ERRCODE='P0422';
      END IF;
    ELSIF jsonb_typeof(val)<>'string' OR length(val#>>'{}')>10000 OR
      (kind IN ('select','radio') AND NOT EXISTS(SELECT FROM jsonb_array_elements(field->'options') opt WHERE opt->'value'=val)) OR
      (kind='email' AND (val#>>'{}') !~ '^[^[:space:]@]+@[^[:space:]@]+$') OR
      (field->'validation'->>'min_length' ~ '^[0-9]{1,5}$' AND length(val#>>'{}') < (field->'validation'->>'min_length')::integer) OR
      (field->'validation'->>'max_length' ~ '^[0-9]{1,5}$' AND length(val#>>'{}') > (field->'validation'->>'max_length')::integer)
    THEN RAISE EXCEPTION 'Invalid intake answer: %',field->>'label' USING ERRCODE='P0422'; END IF;
    cleaned:=cleaned||jsonb_build_object(field->>'id',val);
  END LOOP;
  INSERT INTO public.form_submissions (business_id,form_id,form_version_id,customer_id,appointment_id,source,idempotency_key)
    VALUES (bid,(snapshot->>'form_id')::uuid,(snapshot->>'version_id')::uuid,cid,aid,'booking',request_id) RETURNING id INTO submission;
  INSERT INTO public.form_submission_answers (business_id,submission_id,form_field_id,value)
    SELECT bid,submission,key::uuid,value FROM jsonb_each(cleaned);
END;
$fn$;

CREATE FUNCTION private.intake_appointment_by_token(p_token text)
RETURNS public.appointments LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $fn$
DECLARE a public.appointments%ROWTYPE;
BEGIN
  SELECT ap.* INTO a FROM private.capability_tokens t JOIN public.appointments ap
    ON ap.business_id=t.business_id AND ap.id=t.appointment_id
    WHERE t.kind='appointment_manage' AND t.token_hash=extensions.digest(p_token,'sha256') AND t.revoked_at IS NULL AND t.expires_at>now();
  IF NOT FOUND THEN RAISE EXCEPTION 'Management link is invalid or expired' USING ERRCODE='P0403'; END IF;
  RETURN a;
END;
$fn$;

CREATE FUNCTION public.get_appointment_intake(p_management_token text,p_subject_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE a public.appointments%ROWTYPE; snapshot jsonb;
BEGIN
  PERFORM private.check_rate_limit('manage_token',p_subject_hash,20,600);
  a:=private.intake_appointment_by_token(p_management_token);
  SELECT h.price_snapshot->'intake' INTO snapshot FROM public.appointment_holds h
    WHERE h.business_id=a.business_id AND h.consumed_appointment_id=a.id;
  IF a.status='cancelled' OR snapshot->>'timing' IS DISTINCT FROM 'optional_after' THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('form',snapshot-'form_id'-'timing','submitted',EXISTS(SELECT FROM public.form_submissions f
    WHERE f.business_id=a.business_id AND f.appointment_id=a.id AND f.source='booking' AND f.form_version_id=(snapshot->>'version_id')::uuid));
END;
$fn$;

CREATE FUNCTION public.submit_appointment_intake(p_management_token text,p_subject_hash text,p_intake jsonb,p_request_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $fn$
DECLARE a public.appointments%ROWTYPE; snapshot jsonb;
BEGIN
  PERFORM private.check_rate_limit('manage_token',p_subject_hash,20,600);
  a:=private.intake_appointment_by_token(p_management_token);
  SELECT * INTO a FROM public.appointments WHERE business_id=a.business_id AND id=a.id FOR UPDATE;
  SELECT h.price_snapshot->'intake' INTO snapshot FROM public.appointment_holds h
    WHERE h.business_id=a.business_id AND h.consumed_appointment_id=a.id;
  IF a.status='cancelled' OR snapshot->>'timing' IS DISTINCT FROM 'optional_after' THEN
    RAISE EXCEPTION 'This appointment has no open intake form' USING ERRCODE='P0409';
  END IF;
  IF NOT EXISTS (SELECT FROM public.form_submissions f WHERE f.business_id=a.business_id AND f.appointment_id=a.id
    AND f.source='booking' AND f.form_version_id=(snapshot->>'version_id')::uuid)
  THEN PERFORM private.store_booking_intake(a.business_id,a.id,a.customer_id,snapshot,p_intake,p_request_key); END IF;
  RETURN jsonb_build_object('received',true);
END;
$fn$;

DO $patch$
DECLARE source text; modified text; signature regprocedure;
BEGIN
  signature:='private.booking_hold_core(text,uuid,uuid,uuid,uuid,timestamptz,jsonb,integer,uuid,boolean)'::regprocedure;
  source:=pg_get_functiondef(signature);
  modified:=replace(source,'RETURNING id INTO v_hold_id;', $code$RETURNING id INTO v_hold_id;
  IF p_public THEN
    UPDATE public.appointment_holds SET price_snapshot=price_snapshot||
      jsonb_build_object('intake',private.intake_snapshot(v_page.business_id,v_service.id))
    WHERE business_id=v_page.business_id AND id=v_hold_id;
  END IF;$code$);
  IF source=modified THEN RAISE EXCEPTION 'Booking hold snapshot anchor changed'; END IF;
  source:=modified;
  modified:=replace(source,'INSERT INTO private.idempotency_records (business_id, scope, subject_hash, request_key, request_hash, status, response_status, response_body, expires_at)',
    $code$v_result := v_result || jsonb_build_object('intake_form',(
      SELECT (h.price_snapshot->'intake')-'form_id'-'timing' FROM public.appointment_holds h
      WHERE h.business_id=v_page.business_id AND h.id=v_hold_id AND h.price_snapshot->'intake'->>'timing'='required_before'));
  INSERT INTO private.idempotency_records (business_id, scope, subject_hash, request_key, request_hash, status, response_status, response_body, expires_at)$code$);
  IF source=modified THEN RAISE EXCEPTION 'Booking hold result anchor changed'; END IF;
  EXECUTE modified;
  signature:='public.confirm_booking(text,text,uuid,uuid,jsonb,text,jsonb,uuid)'::regprocedure;
  source:=pg_get_functiondef(signature);
  modified:=replace(source,'RETURNING id INTO v_appointment_id;', $code$RETURNING id INTO v_appointment_id;
  IF v_hold.price_snapshot->'intake'->>'timing'='required_before' THEN
    PERFORM private.store_booking_intake(v_hold.business_id,v_appointment_id,v_customer_id,
      v_hold.price_snapshot->'intake',p_contact->'intake',p_request_key);
  END IF;$code$);
  IF source=modified THEN RAISE EXCEPTION 'Booking confirmation anchor changed'; END IF;
  EXECUTE modified;
END;
$patch$;
DO $permissions$
DECLARE signature regprocedure;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.get_service_intake_settings(uuid,uuid)'::regprocedure,
    'public.save_service_intake_settings(uuid,uuid,uuid,uuid,text,bigint)'::regprocedure,
    'private.intake_snapshot(uuid,uuid)'::regprocedure,
    'private.store_booking_intake(uuid,uuid,uuid,jsonb,jsonb,uuid)'::regprocedure,
    'private.intake_appointment_by_token(text)'::regprocedure,
    'public.get_appointment_intake(text,text)'::regprocedure,
    'public.submit_appointment_intake(text,text,jsonb,uuid)'::regprocedure
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',signature);
  END LOOP;
END;
$permissions$;
