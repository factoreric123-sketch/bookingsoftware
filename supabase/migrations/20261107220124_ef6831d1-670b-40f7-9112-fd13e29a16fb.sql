-- Reproduce the gap using an isolated fixture; roll back every fixture write.
DO $baseline$
DECLARE
  b uuid := 'a2000000-0000-4000-8000-000000000001';
  f uuid := gen_random_uuid();
  v uuid := gen_random_uuid();
BEGIN
  BEGIN
    INSERT INTO public.forms(id,business_id,name,slug) VALUES(f,b,'Immutability baseline','immutability-baseline-'||f::text);
    INSERT INTO public.form_versions(id,business_id,form_id,version_number,published_at) VALUES(v,b,f,1,now());
    INSERT INTO public.form_fields(business_id,form_version_id,field_key,label,field_type,sort_order) VALUES(b,v,'gap','Gap','text',0);
    IF (SELECT count(*) FROM public.form_fields WHERE business_id=b AND form_version_id=v) <> 1 THEN
      RAISE EXCEPTION 'baseline gap was not reproduced';
    END IF;
    RAISE NOTICE 'BASELINE PASS: published-version INSERT succeeded before repair (gap reproduced)';
    RAISE SQLSTATE 'Z0001' USING MESSAGE='rollback baseline fixture';
  EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;
  END;
  IF EXISTS(SELECT 1 FROM public.forms WHERE id=f) THEN RAISE EXCEPTION 'baseline fixture rollback failed'; END IF;
END;
$baseline$;

CREATE OR REPLACE FUNCTION private.protect_published_form_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1 FROM public.form_versions fv
      WHERE fv.id = NEW.form_version_id
        AND fv.business_id = NEW.business_id
        AND fv.published_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'fields of a published form version are immutable';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF EXISTS (
      SELECT 1 FROM public.form_versions fv
      WHERE fv.id = OLD.form_version_id
        AND fv.business_id = OLD.business_id
        AND fv.published_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'fields of a published form version are immutable';
    END IF;
    RETURN OLD;
  ELSE
    -- UPDATE checks both the source and destination business/version pairs.
    IF EXISTS (
      SELECT 1 FROM public.form_versions fv
      WHERE ((fv.id = OLD.form_version_id AND fv.business_id = OLD.business_id)
          OR (fv.id = NEW.form_version_id AND fv.business_id = NEW.business_id))
        AND fv.published_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'fields of a published form version are immutable';
    END IF;
    RETURN NEW;
  END IF;
END;
$function$;

DROP TRIGGER form_fields_protect_published ON public.form_fields;
CREATE TRIGGER form_fields_protect_published
BEFORE INSERT OR UPDATE OR DELETE ON public.form_fields
FOR EACH ROW EXECUTE FUNCTION private.protect_published_form_fields();

-- Transactional regression assertions. The nested block rolls back ALL fixtures.
DO $verification$
DECLARE
  b uuid := 'a2000000-0000-4000-8000-000000000001';
  other_b uuid := 'b2000000-0000-4000-8000-000000000001';
  f uuid := gen_random_uuid();
  pub uuid := gen_random_uuid();
  draft uuid := gen_random_uuid();
  next_draft uuid := gen_random_uuid();
  pub_field uuid := gen_random_uuid();
  draft_field uuid := gen_random_uuid();
  blocked boolean;
  affected integer;
  passed integer := 0;
BEGIN
  BEGIN
    INSERT INTO public.forms(id,business_id,name,slug) VALUES(f,b,'Immutability regression','immutability-regression-'||f::text);
    INSERT INTO public.form_versions(id,business_id,form_id,version_number) VALUES(pub,b,f,1),(draft,b,f,2),(next_draft,b,f,3);
    INSERT INTO public.form_fields(id,business_id,form_version_id,field_key,label,field_type,sort_order) VALUES(pub_field,b,pub,'original','Original','text',0);
    UPDATE public.form_versions SET published_at=now() WHERE id=pub AND business_id=b;

    blocked := false;
    BEGIN
      INSERT INTO public.form_fields(business_id,form_version_id,field_key,label,field_type,sort_order) VALUES(b,pub,'late','Late','text',1);
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'fields of a published form version are immutable' THEN RAISE; END IF;
      blocked := true;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'published INSERT was allowed'; END IF;
    passed := passed+1;

    blocked := false;
    BEGIN
      UPDATE public.form_fields SET label='Changed' WHERE id=pub_field;
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'fields of a published form version are immutable' THEN RAISE; END IF;
      blocked := true;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'published UPDATE was allowed'; END IF;
    passed := passed+1;

    blocked := false;
    BEGIN
      DELETE FROM public.form_fields WHERE id=pub_field;
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'fields of a published form version are immutable' THEN RAISE; END IF;
      blocked := true;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'published DELETE was allowed'; END IF;
    passed := passed+1;

    INSERT INTO public.form_fields(id,business_id,form_version_id,field_key,label,field_type,sort_order) VALUES(draft_field,b,draft,'editable','Editable','text',0);
    IF NOT EXISTS(SELECT 1 FROM public.form_fields WHERE id=draft_field AND label='Editable') THEN RAISE EXCEPTION 'draft INSERT failed'; END IF;
    passed := passed+1;
    UPDATE public.form_fields SET label='Edited' WHERE id=draft_field;
    IF NOT EXISTS(SELECT 1 FROM public.form_fields WHERE id=draft_field AND label='Edited') THEN RAISE EXCEPTION 'draft UPDATE failed'; END IF;
    passed := passed+1;

    blocked := false;
    BEGIN
      UPDATE public.form_fields SET form_version_id=draft WHERE id=pub_field;
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'fields of a published form version are immutable' THEN RAISE; END IF;
      blocked := true;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'published field moved to draft'; END IF;
    passed := passed+1;

    blocked := false;
    BEGIN
      UPDATE public.form_fields SET form_version_id=pub,sort_order=2 WHERE id=draft_field;
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'fields of a published form version are immutable' THEN RAISE; END IF;
      blocked := true;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'draft field moved to published'; END IF;
    passed := passed+1;

    DELETE FROM public.form_fields WHERE id=draft_field;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 1 OR EXISTS(SELECT 1 FROM public.form_fields WHERE id=draft_field) THEN RAISE EXCEPTION 'draft DELETE failed'; END IF;
    passed := passed+1;

    INSERT INTO public.form_fields(business_id,form_version_id,field_key,label,field_type,sort_order) VALUES
      (b,next_draft,'name','Name','name',0),
      (b,next_draft,'email','Email','email',1),
      (b,next_draft,'notes','Notes','textarea',2);
    IF (SELECT count(*) FROM public.form_fields WHERE business_id=b AND form_version_id=next_draft) <> 3
      OR (SELECT published_at FROM public.form_versions WHERE id=next_draft) IS NOT NULL THEN
      RAISE EXCEPTION 'new draft did not receive all three fields before publication';
    END IF;
    passed := passed+1;
    UPDATE public.form_versions SET published_at=now() WHERE id=next_draft AND business_id=b;
    IF (SELECT published_at FROM public.form_versions WHERE id=next_draft) IS NULL
      OR (SELECT count(*) FROM public.form_fields WHERE form_version_id=next_draft AND business_id=b) <> 3 THEN
      RAISE EXCEPTION 'new draft publication failed or lost fields';
    END IF;
    passed := passed+1;

    blocked := false;
    BEGIN
      INSERT INTO public.form_fields(business_id,form_version_id,field_key,label,field_type,sort_order) VALUES(b,next_draft,'after','After','text',3);
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'fields of a published form version are immutable' THEN RAISE; END IF;
      blocked := true;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'newly published version accepted a field'; END IF;
    passed := passed+1;

    blocked := false;
    BEGIN
      UPDATE public.form_versions SET version_number=4 WHERE id=pub AND business_id=b;
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'published form versions are immutable' THEN RAISE; END IF;
      blocked := true;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'published-version UPDATE protection changed'; END IF;
    passed := passed+1;

    blocked := false;
    BEGIN
      INSERT INTO public.form_fields(business_id,form_version_id,field_key,label,field_type,sort_order) VALUES(other_b,draft,'mismatch','Mismatch','text',5);
    EXCEPTION WHEN foreign_key_violation THEN blocked := true;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'cross-business version mismatch accepted'; END IF;
    passed := passed+1;

    IF (SELECT count(*) FROM public.form_fields WHERE form_version_id=pub AND business_id=b) <> 1
       OR NOT EXISTS(SELECT 1 FROM public.form_fields WHERE id=pub_field AND label='Original' AND form_version_id=pub) THEN
      RAISE EXCEPTION 'rejected mutations changed published data';
    END IF;
    passed := passed+1;
    IF passed <> 14 THEN RAISE EXCEPTION 'expected 14 checks, got %',passed; END IF;
    RAISE NOTICE 'VERIFICATION PASS: 14/14 transactional field/version checks';
    RAISE SQLSTATE 'Z0002' USING MESSAGE='rollback verification fixtures';
  EXCEPTION WHEN SQLSTATE 'Z0002' THEN NULL;
  END;
  IF EXISTS(SELECT 1 FROM public.forms WHERE id=f) OR EXISTS(SELECT 1 FROM public.form_versions WHERE id IN (pub,draft,next_draft)) THEN
    RAISE EXCEPTION 'verification fixture rollback failed';
  END IF;
  RAISE NOTICE 'VERIFICATION PASS: all regression fixtures rolled back';
END;
$verification$;