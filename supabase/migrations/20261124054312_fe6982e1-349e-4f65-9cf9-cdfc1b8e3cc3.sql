DO $audit$
DECLARE sig regprocedure; src text; patched text; acl aclitem[];
BEGIN
 FOREACH sig IN ARRAY ARRAY['public.save_booking_page_draft(uuid,uuid,bigint,text,text,boolean,uuid[])'::regprocedure,'public.set_booking_page_publication(uuid,uuid,bigint,boolean)'::regprocedure] LOOP
 SELECT proacl INTO acl FROM pg_proc WHERE oid=sig;
 src:=pg_get_functiondef(sig);
 patched:=replace(src,'entity_type,entity_id,changes)','entity_type,entity_id,request_id,changes)');
 patched:=replace(patched,'''booking_page'',page.id,jsonb_build_object(','''booking_page'',page.id,gen_random_uuid(),jsonb_build_object(');
 IF patched=src OR position('entity_id,request_id,changes)' IN patched)=0 OR position('page.id,gen_random_uuid(),jsonb_build_object(' IN patched)=0 THEN RAISE EXCEPTION 'audit source mismatch'; END IF;
 EXECUTE patched;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid=sig AND proacl IS DISTINCT FROM acl) THEN RAISE EXCEPTION 'audit repair changed grants'; END IF;
 END LOOP;
END; $audit$;
CREATE INDEX booking_page_drafts_location_idx ON private.booking_page_drafts(business_id,location_id);
CREATE INDEX booking_page_draft_services_page_idx ON private.booking_page_draft_services(business_id,page_id,location_id);
CREATE INDEX booking_page_draft_services_assignment_idx ON private.booking_page_draft_services(business_id,service_id,location_id);
CREATE INDEX booking_page_publication_states_location_idx ON private.booking_page_publication_states(business_id,location_id);
CREATE INDEX booking_page_live_services_page_idx ON private.booking_page_live_services(business_id,page_id,location_id);
CREATE INDEX booking_page_live_services_assignment_idx ON private.booking_page_live_services(business_id,service_id,location_id);