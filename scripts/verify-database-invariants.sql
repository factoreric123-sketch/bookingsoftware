-- Run through a privileged Supabase SQL connection. Every fixture is rolled back.
BEGIN;
DO $checks$
DECLARE
  v_business uuid := 'b2000000-0000-4000-8000-000000000001';
  v_customer uuid := 'b4000000-0000-4000-8000-000000000001';
  v_org uuid := 'b1000000-0000-4000-8000-000000000001';
  v_other_org uuid := 'a1000000-0000-4000-8000-000000000001';
  v_plan uuid;
  v_consent uuid;
  v_payment uuid;
  v_subscription uuid;
  v_other_subscription uuid;
  v_key uuid := gen_random_uuid();
  v_rejected boolean;
BEGIN
  SELECT id INTO STRICT v_plan FROM public.subscription_plans ORDER BY sort_order LIMIT 1;

  INSERT INTO public.customer_consents (business_id,customer_id,channel,purpose,decision,source,disclosure_text,disclosure_version)
  VALUES (v_business,v_customer,'sms','marketing','granted','booking_page','Verification only','v1') RETURNING id INTO v_consent;
  v_rejected := false;
  BEGIN UPDATE public.customer_consents SET decision='revoked' WHERE id=v_consent;
  EXCEPTION WHEN raise_exception THEN v_rejected := true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'consent update was allowed'; END IF;
  v_rejected := false;
  BEGIN DELETE FROM public.customer_consents WHERE id=v_consent;
  EXCEPTION WHEN raise_exception THEN v_rejected := true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'consent deletion was allowed'; END IF;

  INSERT INTO private.webhook_events (provider,provider_account_scope,external_event_id,business_id,event_type,payload,signature_verified_at)
  VALUES ('stripe','phase1-check',v_key::text,v_business,'payment_intent.succeeded','{}',now());
  v_rejected := false;
  BEGIN
    INSERT INTO private.webhook_events (provider,provider_account_scope,external_event_id,business_id,event_type,payload,signature_verified_at)
    VALUES ('stripe','phase1-check',v_key::text,v_business,'payment_intent.succeeded','{}',now());
  EXCEPTION WHEN unique_violation THEN v_rejected := true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'duplicate webhook was allowed'; END IF;

  INSERT INTO private.background_jobs (business_id,job_type,deduplication_key,run_at)
  VALUES (v_business,'expire_holds',v_key::text,now());
  v_rejected := false;
  BEGIN INSERT INTO private.background_jobs (business_id,job_type,deduplication_key,run_at)
    VALUES (v_business,'expire_holds',v_key::text,now());
  EXCEPTION WHEN unique_violation THEN v_rejected := true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'duplicate background job was allowed'; END IF;
  v_rejected := false;
  BEGIN INSERT INTO private.background_jobs (business_id,job_type,deduplication_key,run_at,maximum_attempts)
    VALUES (v_business,'expire_holds',v_key::text || '-invalid',now(),0);
  EXCEPTION WHEN check_violation THEN v_rejected := true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'job with zero maximum attempts was allowed'; END IF;

  INSERT INTO public.payments (business_id,customer_id,provider,amount_minor,currency,method,status,paid_at,idempotency_key)
  VALUES (v_business,v_customer,'manual',100,'USD','cash','succeeded',now(),v_key) RETURNING id INTO v_payment;
  v_rejected := false;
  BEGIN INSERT INTO public.payments (business_id,customer_id,provider,amount_minor,currency,method,status,paid_at,idempotency_key)
    VALUES (v_business,v_customer,'manual',100,'USD','cash','succeeded',now(),v_key);
  EXCEPTION WHEN unique_violation THEN v_rejected := true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'duplicate payment idempotency key was allowed'; END IF;
  INSERT INTO public.refunds (business_id,payment_id,amount_minor,status,idempotency_key)
  VALUES (v_business,v_payment,60,'succeeded',v_key);
  v_rejected := false;
  BEGIN INSERT INTO public.refunds (business_id,payment_id,amount_minor,status,idempotency_key)
    VALUES (v_business,v_payment,50,'succeeded',gen_random_uuid());
  EXCEPTION WHEN raise_exception THEN v_rejected := true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'refunds exceeded the payment amount'; END IF;

  INSERT INTO public.subscriptions (organization_id,plan_id,status)
  VALUES (v_org,v_plan,'trialing') RETURNING id INTO v_subscription;
  INSERT INTO public.usage_events (business_id,subscription_id,metric,quantity,occurred_at,idempotency_key)
  VALUES (v_business,v_subscription,'sms_segments',1,now(),v_key);
  v_rejected := false;
  BEGIN INSERT INTO public.usage_events (business_id,subscription_id,metric,quantity,occurred_at,idempotency_key)
    VALUES (v_business,v_subscription,'sms_segments',1,now(),v_key);
  EXCEPTION WHEN unique_violation THEN v_rejected := true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'duplicate usage event was allowed'; END IF;
  v_rejected := false;
  BEGIN INSERT INTO public.usage_events (business_id,subscription_id,metric,quantity,occurred_at,idempotency_key)
    VALUES (v_business,v_subscription,'sms_segments',-1,now(),gen_random_uuid());
  EXCEPTION WHEN check_violation THEN v_rejected := true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'negative usage was allowed'; END IF;
  INSERT INTO public.subscriptions (organization_id,plan_id,status)
  VALUES (v_other_org,v_plan,'cancelled') RETURNING id INTO v_other_subscription;
  v_rejected := false;
  BEGIN INSERT INTO public.usage_events (business_id,subscription_id,metric,quantity,occurred_at,idempotency_key)
    VALUES (v_business,v_other_subscription,'sms_segments',1,now(),gen_random_uuid());
  EXCEPTION WHEN raise_exception THEN v_rejected := true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'usage attached to another organization'; END IF;
END
$checks$;

SET LOCAL ROLE service_role;
DO $role_checks$
DECLARE v_rejected boolean := false;
BEGIN
  IF current_user <> 'service_role' THEN RAISE EXCEPTION 'service role was not selected'; END IF;
  PERFORM public.get_business_analytics(
    '47fff988-90c4-4129-b072-146f8e35b701',
    'a2000000-0000-4000-8000-000000000001',
    null, '2026-11-01', '2026-11-30');
  BEGIN
    PERFORM public.get_business_analytics(
      '47fff988-90c4-4129-b072-146f8e35b701',
      'b2000000-0000-4000-8000-000000000001',
      null, '2026-11-01', '2026-11-30');
  EXCEPTION WHEN SQLSTATE 'P0403' THEN v_rejected := true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'cross-business analytics was allowed'; END IF;
END
$role_checks$;
RESET ROLE;

SET LOCAL ROLE anon;
DO $anon_checks$
DECLARE v_rejected boolean := false;
BEGIN
  BEGIN
    PERFORM public.get_business_analytics(
      '47fff988-90c4-4129-b072-146f8e35b701',
      'a2000000-0000-4000-8000-000000000001',
      null, '2026-11-01', '2026-11-30');
  EXCEPTION WHEN insufficient_privilege THEN v_rejected := true; END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'anonymous direct RPC execution was allowed'; END IF;
END
$anon_checks$;
RESET ROLE;
ROLLBACK;
