-- ============ customers ============
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  full_name text NOT NULL,
  email text,
  normalized_email text GENERATED ALWAYS AS (nullif(lower(btrim(email)), '')) STORED,
  phone_e164 text,
  company_name text,
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country_code text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','booking_page','form','sms','ai_phone','import')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','merged')),
  merged_into_customer_id uuid,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, merged_into_customer_id) REFERENCES public.customers (business_id, id) ON DELETE RESTRICT,
  CHECK (merged_into_customer_id IS NULL OR merged_into_customer_id <> id)
);
CREATE UNIQUE INDEX customers_active_email_uidx ON public.customers (business_id, normalized_email)
  WHERE normalized_email IS NOT NULL AND status = 'active';
CREATE INDEX customers_phone_idx ON public.customers (business_id, phone_e164);
CREATE INDEX customers_email_idx ON public.customers (business_id, normalized_email);
CREATE INDEX customers_created_idx ON public.customers (business_id, created_at DESC);
GRANT SELECT ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER customers_set_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- Reject merge cycles (merged chain must terminate)
CREATE OR REPLACE FUNCTION private.check_customer_merge_cycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  cursor_id uuid;
  seen uuid[] := ARRAY[]::uuid[];
BEGIN
  IF NEW.merged_into_customer_id IS NULL THEN
    RETURN NEW;
  END IF;
  cursor_id := NEW.merged_into_customer_id;
  WHILE cursor_id IS NOT NULL LOOP
    IF cursor_id = NEW.id OR cursor_id = ANY(seen) THEN
      RAISE EXCEPTION 'customer merge cycle detected';
    END IF;
    seen := seen || cursor_id;
    SELECT c.merged_into_customer_id INTO cursor_id
    FROM public.customers c
    WHERE c.id = cursor_id AND c.business_id = NEW.business_id;
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER customers_check_merge_cycle BEFORE INSERT OR UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION private.check_customer_merge_cycle();

-- ============ customer_users ============
CREATE TABLE public.customer_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verified_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, customer_id, user_id),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, customer_id) REFERENCES public.customers (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.customer_users TO authenticated;
GRANT ALL ON public.customer_users TO service_role;
ALTER TABLE public.customer_users ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER customer_users_set_updated_at BEFORE UPDATE ON public.customer_users FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ customer_notes ============
CREATE TABLE public.customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL,
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, customer_id) REFERENCES public.customers (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.customer_notes TO authenticated;
GRANT ALL ON public.customer_notes TO service_role;
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX customer_notes_customer_idx ON public.customer_notes (business_id, customer_id, created_at DESC);

-- ============ customer_tags ============
CREATE TABLE public.customer_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6d5dfc' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, name),
  UNIQUE (business_id, id)
);
GRANT SELECT ON public.customer_tags TO authenticated;
GRANT ALL ON public.customer_tags TO service_role;
ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER customer_tags_set_updated_at BEFORE UPDATE ON public.customer_tags FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ customer_tag_assignments ============
CREATE TABLE public.customer_tag_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, customer_id, tag_id),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, customer_id) REFERENCES public.customers (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, tag_id) REFERENCES public.customer_tags (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.customer_tag_assignments TO authenticated;
GRANT ALL ON public.customer_tag_assignments TO service_role;
ALTER TABLE public.customer_tag_assignments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER customer_tag_assignments_set_updated_at BEFORE UPDATE ON public.customer_tag_assignments FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ customer_groups ============
CREATE TABLE public.customer_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, name),
  UNIQUE (business_id, id)
);
GRANT SELECT ON public.customer_groups TO authenticated;
GRANT ALL ON public.customer_groups TO service_role;
ALTER TABLE public.customer_groups ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER customer_groups_set_updated_at BEFORE UPDATE ON public.customer_groups FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ customer_group_members ============
CREATE TABLE public.customer_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL,
  group_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, customer_id, group_id),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, customer_id) REFERENCES public.customers (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, group_id) REFERENCES public.customer_groups (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.customer_group_members TO authenticated;
GRANT ALL ON public.customer_group_members TO service_role;
ALTER TABLE public.customer_group_members ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER customer_group_members_set_updated_at BEFORE UPDATE ON public.customer_group_members FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ custom_fields ============
CREATE TABLE public.custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  entity_type text NOT NULL CHECK (entity_type IN ('customer','appointment')),
  field_key text NOT NULL,
  label text NOT NULL,
  value_type text NOT NULL CHECK (value_type IN ('text','number','boolean','date','select')),
  options jsonb NOT NULL DEFAULT '[]',
  required boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, entity_type, field_key),
  UNIQUE (business_id, id)
);
GRANT SELECT ON public.custom_fields TO authenticated;
GRANT ALL ON public.custom_fields TO service_role;
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER custom_fields_set_updated_at BEFORE UPDATE ON public.custom_fields FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- options: array of unique strings; empty for non-select fields
CREATE OR REPLACE FUNCTION private.check_custom_field_options()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF jsonb_typeof(NEW.options) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'options must be an array';
  END IF;
  IF NEW.value_type <> 'select' AND NEW.options <> '[]'::jsonb THEN
    RAISE EXCEPTION 'non-select fields must have an empty options array';
  END IF;
  IF NEW.value_type = 'select' THEN
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.options) o WHERE jsonb_typeof(o) <> 'string') THEN
      RAISE EXCEPTION 'select options must be strings';
    END IF;
    IF (SELECT count(*) FROM jsonb_array_elements(NEW.options) o)
       <> (SELECT count(DISTINCT o #>> '{}') FROM jsonb_array_elements(NEW.options) o) THEN
      RAISE EXCEPTION 'select options must be unique';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER custom_fields_check_options BEFORE INSERT OR UPDATE ON public.custom_fields FOR EACH ROW EXECUTE FUNCTION private.check_custom_field_options();

-- ============ custom_field_values ============
CREATE TABLE public.custom_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  custom_field_id uuid NOT NULL,
  customer_id uuid,
  appointment_id uuid,
  value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, custom_field_id) REFERENCES public.custom_fields (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, customer_id) REFERENCES public.customers (business_id, id) ON DELETE RESTRICT,
  CHECK (num_nonnulls(customer_id, appointment_id) = 1)
);
CREATE UNIQUE INDEX custom_field_values_customer_uidx ON public.custom_field_values (business_id, custom_field_id, customer_id) WHERE customer_id IS NOT NULL;
CREATE UNIQUE INDEX custom_field_values_appointment_uidx ON public.custom_field_values (business_id, custom_field_id, appointment_id) WHERE appointment_id IS NOT NULL;
GRANT SELECT ON public.custom_field_values TO authenticated;
GRANT ALL ON public.custom_field_values TO service_role;
ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER custom_field_values_set_updated_at BEFORE UPDATE ON public.custom_field_values FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- entity_type must match target; value must match value_type
CREATE OR REPLACE FUNCTION private.check_custom_field_value()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  f public.custom_fields%ROWTYPE;
BEGIN
  SELECT * INTO f FROM public.custom_fields WHERE id = NEW.custom_field_id AND business_id = NEW.business_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'custom field not found in this business';
  END IF;
  IF f.entity_type = 'customer' AND NEW.customer_id IS NULL THEN
    RAISE EXCEPTION 'customer field requires customer_id';
  END IF;
  IF f.entity_type = 'appointment' AND NEW.appointment_id IS NULL THEN
    RAISE EXCEPTION 'appointment field requires appointment_id';
  END IF;
  IF f.value_type = 'text' AND jsonb_typeof(NEW.value) <> 'string' THEN
    RAISE EXCEPTION 'value must be a string';
  ELSIF f.value_type = 'number' AND jsonb_typeof(NEW.value) <> 'number' THEN
    RAISE EXCEPTION 'value must be a number';
  ELSIF f.value_type = 'boolean' AND jsonb_typeof(NEW.value) <> 'boolean' THEN
    RAISE EXCEPTION 'value must be a boolean';
  ELSIF f.value_type = 'date' AND (jsonb_typeof(NEW.value) <> 'string' OR NOT (NEW.value #>> '{}' ~ '^\d{4}-\d{2}-\d{2}$')) THEN
    RAISE EXCEPTION 'value must be an ISO date string';
  ELSIF f.value_type = 'select' AND (jsonb_typeof(NEW.value) <> 'string' OR NOT (f.options @> to_jsonb(NEW.value #>> '{}'))) THEN
    RAISE EXCEPTION 'value must be one of the field options';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER custom_field_values_check BEFORE INSERT OR UPDATE ON public.custom_field_values FOR EACH ROW EXECUTE FUNCTION private.check_custom_field_value();