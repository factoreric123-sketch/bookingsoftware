DO $repair$
DECLARE
  v_function regprocedure := 'public.get_availability(uuid,uuid,date,date,uuid,jsonb,integer)'::regprocedure;
  v_definition text;
  v_old_selection constant text := 'SELECT bh.opens_at AS w_open, bh.closes_at AS w_close';
  v_new_selection constant text := 'SELECT greatest(bh.opens_at, sa.opens_at) AS w_open, least(bh.closes_at, sa.closes_at) AS w_close';
  v_original_acl aclitem[];
BEGIN
  SELECT pg_get_functiondef(oid), proacl INTO v_definition, v_original_acl
  FROM pg_proc WHERE oid = v_function;

  IF (length(v_definition) - length(replace(v_definition, v_old_selection, ''))) / length(v_old_selection) <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one existing availability window selection';
  END IF;

  EXECUTE replace(v_definition, v_old_selection, v_new_selection);

  IF pg_get_functiondef(v_function::oid) IS DISTINCT FROM replace(v_definition, v_old_selection, v_new_selection) THEN
    RAISE EXCEPTION 'Availability function changed beyond the requested window selection';
  END IF;
  IF (SELECT proacl FROM pg_proc WHERE oid = v_function) IS DISTINCT FROM v_original_acl THEN
    RAISE EXCEPTION 'Availability function grants changed unexpectedly';
  END IF;
END
$repair$;