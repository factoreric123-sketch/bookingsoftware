-- ============ forms ============
CREATE TABLE public.forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  location_id uuid,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  active_version_id uuid,
  accent_color text NOT NULL DEFAULT '#6d5dfc' CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  logo_asset_id uuid,
  create_customer boolean NOT NULL DEFAULT true,
  lead_tag_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (slug),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, location_id) REFERENCES public.locations (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, logo_asset_id) REFERENCES public.storage_assets (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, lead_tag_id) REFERENCES public.customer_tags (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.forms TO authenticated;
GRANT ALL ON public.forms TO service_role;
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER forms_set_updated_at BEFORE UPDATE ON public.forms FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ form_versions ============
CREATE TABLE public.form_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  form_id uuid NOT NULL,
  version_number integer NOT NULL CHECK (version_number >= 1),
  published_at timestamptz,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, form_id, version_number),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, form_id) REFERENCES public.forms (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.form_versions TO authenticated;
GRANT ALL ON public.form_versions TO service_role;
ALTER TABLE public.form_versions ENABLE ROW LEVEL SECURITY;

-- Published versions are immutable
CREATE OR REPLACE FUNCTION private.protect_published_form_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.published_at IS NOT NULL THEN
    RAISE EXCEPTION 'published form versions are immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER form_versions_protect_published BEFORE UPDATE ON public.form_versions FOR EACH ROW EXECUTE FUNCTION private.protect_published_form_version();

ALTER TABLE public.forms
  ADD CONSTRAINT forms_active_version_fk
  FOREIGN KEY (business_id, active_version_id) REFERENCES public.form_versions (business_id, id) ON DELETE RESTRICT;

-- ============ form_fields ============
CREATE TABLE public.form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  form_version_id uuid NOT NULL,
  field_key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('name','email','phone','address','text','textarea','select','checkbox','radio','date','time','file','consent')),
  required boolean NOT NULL DEFAULT false,
  placeholder text NOT NULL DEFAULT '',
  help_text text NOT NULL DEFAULT '',
  options jsonb NOT NULL DEFAULT '[]',
  validation jsonb NOT NULL DEFAULT '{}',
  visibility_rule jsonb,
  customer_mapping text CHECK (customer_mapping IS NULL OR customer_mapping IN ('full_name','email','phone_e164','address','company_name')),
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, form_version_id, field_key),
  UNIQUE (business_id, form_version_id, sort_order),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, form_version_id) REFERENCES public.form_versions (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.form_fields TO authenticated;
GRANT ALL ON public.form_fields TO service_role;
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER form_fields_set_updated_at BEFORE UPDATE ON public.form_fields FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- Field shape validation: options/validation/visibility_rule structure
CREATE OR REPLACE FUNCTION private.check_form_field_shape()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF jsonb_typeof(NEW.options) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'options must be an array';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.options) o
    WHERE jsonb_typeof(o) <> 'object'
       OR NOT (o ? 'value' AND o ? 'label')
       OR jsonb_typeof(o->'value') <> 'string'
       OR jsonb_typeof(o->'label') <> 'string'
       OR (SELECT count(*) FROM jsonb_object_keys(o)) <> 2
  ) THEN
    RAISE EXCEPTION 'options must be objects with exactly value and label string keys';
  END IF;
  IF jsonb_typeof(NEW.validation) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'validation must be an object';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(NEW.validation) k
    WHERE k NOT IN ('min_length','max_length','min','max','pattern')
  ) THEN
    RAISE EXCEPTION 'validation permits only min_length, max_length, min, max, pattern';
  END IF;
  IF NEW.visibility_rule IS NOT NULL THEN
    IF jsonb_typeof(NEW.visibility_rule) <> 'object'
       OR jsonb_typeof(NEW.visibility_rule->'field_key') IS DISTINCT FROM 'string'
       OR NEW.visibility_rule->>'operator' NOT IN ('equals','not_equals','contains','is_checked')
       OR jsonb_typeof(NEW.visibility_rule->'value') NOT IN ('string','boolean') THEN
      RAISE EXCEPTION 'visibility_rule must have field_key (string), operator (equals|not_equals|contains|is_checked), value (string|boolean)';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.form_fields ff
      WHERE ff.business_id = NEW.business_id
        AND ff.form_version_id = NEW.form_version_id
        AND ff.field_key = NEW.visibility_rule->>'field_key'
    ) THEN
      RAISE EXCEPTION 'visibility_rule field_key must reference a field in the same version';
    END IF;
    IF NEW.visibility_rule->>'field_key' = NEW.field_key THEN
      RAISE EXCEPTION 'a field cannot control its own visibility';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER form_fields_check_shape BEFORE INSERT OR UPDATE ON public.form_fields FOR EACH ROW EXECUTE FUNCTION private.check_form_field_shape();

-- Fields of a published version are immutable
CREATE OR REPLACE FUNCTION private.protect_published_form_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.form_versions fv
    WHERE fv.id = COALESCE(NEW.form_version_id, OLD.form_version_id)
      AND fv.business_id = COALESCE(NEW.business_id, OLD.business_id)
      AND fv.published_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'fields of a published form version are immutable';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER form_fields_protect_published BEFORE UPDATE OR DELETE ON public.form_fields FOR EACH ROW EXECUTE FUNCTION private.protect_published_form_fields();

-- ============ form_service_links ============
CREATE TABLE public.form_service_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  form_id uuid NOT NULL,
  service_id uuid NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('lead_capture','pre_appointment','post_appointment')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, form_id, service_id, purpose),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, form_id) REFERENCES public.forms (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, service_id) REFERENCES public.services (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.form_service_links TO authenticated;
GRANT ALL ON public.form_service_links TO service_role;
ALTER TABLE public.form_service_links ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER form_service_links_set_updated_at BEFORE UPDATE ON public.form_service_links FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ form_submissions ============
CREATE TABLE public.form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  form_id uuid NOT NULL,
  form_version_id uuid NOT NULL,
  customer_id uuid,
  appointment_id uuid,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'public_form' CHECK (source IN ('public_form','booking','dashboard')),
  spam_status text NOT NULL DEFAULT 'accepted' CHECK (spam_status IN ('accepted','quarantined','rejected')),
  submitter_subject_hash text,
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, form_id, idempotency_key),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, form_id) REFERENCES public.forms (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, form_version_id) REFERENCES public.form_versions (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, customer_id) REFERENCES public.customers (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, appointment_id) REFERENCES public.appointments (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.form_submissions TO authenticated;
GRANT ALL ON public.form_submissions TO service_role;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
CREATE INDEX form_submissions_form_idx ON public.form_submissions (business_id, form_id, submitted_at DESC);

-- Submission version must belong to the submission form
CREATE OR REPLACE FUNCTION private.check_submission_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.form_versions fv
    WHERE fv.id = NEW.form_version_id AND fv.business_id = NEW.business_id AND fv.form_id = NEW.form_id
  ) THEN
    RAISE EXCEPTION 'form_version_id must belong to the submission form';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER form_submissions_check_version BEFORE INSERT OR UPDATE ON public.form_submissions FOR EACH ROW EXECUTE FUNCTION private.check_submission_version();

-- ============ form_submission_answers ============
CREATE TABLE public.form_submission_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  submission_id uuid NOT NULL,
  form_field_id uuid NOT NULL,
  value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, submission_id, form_field_id),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, submission_id) REFERENCES public.form_submissions (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, form_field_id) REFERENCES public.form_fields (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.form_submission_answers TO authenticated;
GRANT ALL ON public.form_submission_answers TO service_role;
ALTER TABLE public.form_submission_answers ENABLE ROW LEVEL SECURITY;

-- Answer field must belong to the submitted version; value must match field type
CREATE OR REPLACE FUNCTION private.check_submission_answer()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  s public.form_submissions%ROWTYPE;
  f public.form_fields%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.form_submissions WHERE id = NEW.submission_id AND business_id = NEW.business_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'submission not found in this business';
  END IF;
  SELECT * INTO f FROM public.form_fields WHERE id = NEW.form_field_id AND business_id = NEW.business_id;
  IF NOT FOUND OR f.form_version_id <> s.form_version_id THEN
    RAISE EXCEPTION 'answer field must belong to the submitted form version';
  END IF;
  IF f.field_type IN ('checkbox','consent') AND jsonb_typeof(NEW.value) <> 'boolean' THEN
    RAISE EXCEPTION 'checkbox/consent answers must be booleans';
  ELSIF f.field_type = 'date' AND (jsonb_typeof(NEW.value) <> 'string' OR NOT (NEW.value #>> '{}' ~ '^\d{4}-\d{2}-\d{2}$')) THEN
    RAISE EXCEPTION 'date answers must be ISO date strings';
  ELSIF f.field_type = 'time' AND (jsonb_typeof(NEW.value) <> 'string' OR NOT (NEW.value #>> '{}' ~ '^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$')) THEN
    RAISE EXCEPTION 'time answers must be 24-hour time strings';
  ELSIF f.field_type = 'file' THEN
    IF jsonb_typeof(NEW.value) <> 'array' THEN
      RAISE EXCEPTION 'file answers must be an array of storage asset IDs';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(NEW.value) v
      WHERE NOT EXISTS (
        SELECT 1 FROM public.storage_assets a
        WHERE a.id = v::uuid AND a.business_id = NEW.business_id
      )
    ) THEN
      RAISE EXCEPTION 'file answers must reference storage assets from this business';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER form_submission_answers_check BEFORE INSERT OR UPDATE ON public.form_submission_answers FOR EACH ROW EXECUTE FUNCTION private.check_submission_answer();

-- ============ customer_consents (append-only) ============
CREATE TABLE public.customer_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('sms','email','call_recording')),
  purpose text NOT NULL CHECK (purpose IN ('transactional','marketing','recording')),
  decision text NOT NULL CHECK (decision IN ('granted','revoked')),
  source text NOT NULL CHECK (source IN ('booking_page','form','staff','sms_keyword','provider')),
  disclosure_text text NOT NULL,
  disclosure_version text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  evidence_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, customer_id) REFERENCES public.customers (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.customer_consents TO authenticated;
GRANT ALL ON public.customer_consents TO service_role;
ALTER TABLE public.customer_consents ENABLE ROW LEVEL SECURITY;
CREATE INDEX customer_consents_customer_idx ON public.customer_consents (business_id, customer_id, channel, purpose, recorded_at DESC);

-- Consent history is append-only
CREATE OR REPLACE FUNCTION private.protect_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;
CREATE TRIGGER customer_consents_no_update BEFORE UPDATE OR DELETE ON public.customer_consents FOR EACH ROW EXECUTE FUNCTION private.protect_append_only();