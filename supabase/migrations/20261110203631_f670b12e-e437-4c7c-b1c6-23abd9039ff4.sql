ALTER TABLE public.booking_sessions ADD COLUMN IF NOT EXISTS created_from_hold boolean NOT NULL DEFAULT false;

DO $repair$
DECLARE
  v_old text; v_new text;
BEGIN
  -- create_booking_hold: mark brand-new group sessions
  v_old := pg_get_functiondef('public.create_booking_hold(text,uuid,uuid,uuid,uuid,timestamptz,jsonb,integer,uuid)'::regprocedure);
  v_new := regexp_replace(v_old,
    '(session_type, state, delivery_mode)(\)\s+VALUES \([^\n]*''group'', ''holding'', v_service\.delivery_mode)\)',
    '\1, created_from_hold\2, true)');
  IF v_new = v_old OR v_new NOT LIKE '%''group'', ''holding'', v_service.delivery_mode, true)%' THEN
    RAISE EXCEPTION 'create_booking_hold patch did not apply';
  END IF;
  EXECUTE v_new;

  -- cancel_appointment: release empty hold-created group sessions; real from_status
  v_old := pg_get_functiondef('public.cancel_appointment(text,uuid,text,text,uuid,bigint,uuid)'::regprocedure);
  v_new := replace(v_old,
    '  -- Group sessions stay reserved; only the attendee''s seats are released.',
'  -- Group sessions stay reserved unless an ad-hoc (hold-created) session is now empty.
  IF v_session.session_type = ''group'' AND v_session.created_from_hold
     AND NOT EXISTS (
       SELECT 1 FROM appointments ap
       WHERE ap.business_id = v_ap.business_id AND ap.session_id = v_session.id
         AND ap.status IN (''pending'',''confirmed'',''checked_in''))
     AND NOT EXISTS (
       SELECT 1 FROM appointment_holds h
       WHERE h.business_id = v_ap.business_id AND h.session_id = v_session.id
         AND h.status = ''active'' AND h.expires_at > now()) THEN
    UPDATE booking_sessions SET state = ''cancelled'' WHERE id = v_session.id AND business_id = v_ap.business_id;
    UPDATE resource_reservations SET active = false
    WHERE business_id = v_ap.business_id AND session_id = v_session.id AND active;
  END IF;');
  v_new := replace(v_new,
    'VALUES (v_ap.business_id, v_ap.id, ''confirmed'', ''cancelled'', p_actor_user_id,',
    'VALUES (v_ap.business_id, v_ap.id, v_ap.status, ''cancelled'', p_actor_user_id,');
  IF v_new NOT LIKE '%v_session.created_from_hold%' OR v_new NOT LIKE '%v_ap.id, v_ap.status, ''cancelled''%' THEN
    RAISE EXCEPTION 'cancel_appointment patch did not apply';
  END IF;
  EXECUTE v_new;

  -- expire_holds: also release empty holding group sessions and empty hold-created scheduled group sessions
  v_old := pg_get_functiondef('public.expire_holds()'::regprocedure);
  v_new := replace(v_old,
    'AND bs.state = ''holding'' AND bs.session_type = ''individual''',
    'AND (bs.state = ''holding''
           OR (bs.state = ''scheduled'' AND bs.session_type = ''group'' AND bs.created_from_hold))');
  IF v_new = v_old THEN RAISE EXCEPTION 'expire_holds patch did not apply'; END IF;
  EXECUTE v_new;
END
$repair$;

REVOKE EXECUTE ON FUNCTION public.create_booking_hold(text,uuid,uuid,uuid,uuid,timestamptz,jsonb,integer,uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_appointment(text,uuid,text,text,uuid,bigint,uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_holds() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_hold(text,uuid,uuid,uuid,uuid,timestamptz,jsonb,integer,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_appointment(text,uuid,text,text,uuid,bigint,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_holds() TO service_role;