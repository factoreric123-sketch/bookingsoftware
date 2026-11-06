CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

-- Generic M-table trigger: updated_at, row_version, immutable identity columns
CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  old_j jsonb := to_jsonb(OLD);
  new_j jsonb := to_jsonb(NEW);
BEGIN
  IF (new_j ->> 'id') IS DISTINCT FROM (old_j ->> 'id') THEN
    RAISE EXCEPTION 'id is immutable';
  END IF;
  IF old_j ? 'business_id' AND (new_j ->> 'business_id') IS DISTINCT FROM (old_j ->> 'business_id') THEN
    RAISE EXCEPTION 'business_id is immutable';
  END IF;
  IF old_j ? 'organization_id' AND (new_j ->> 'organization_id') IS DISTINCT FROM (old_j ->> 'organization_id') THEN
    RAISE EXCEPTION 'organization_id is immutable';
  END IF;
  IF (new_j ->> 'created_at') IS DISTINCT FROM (old_j ->> 'created_at') THEN
    RAISE EXCEPTION 'created_at is immutable';
  END IF;
  NEW.updated_at := now();
  NEW.row_version := OLD.row_version + 1;
  RETURN NEW;
END;
$$;

-- IANA timezone validation trigger
CREATE OR REPLACE FUNCTION private.check_timezone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.timezone IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW.timezone) THEN
    RAISE EXCEPTION 'invalid IANA timezone identifier: %', NEW.timezone;
  END IF;
  RETURN NEW;
END;
$$;

-- ============ profiles ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  avatar_url text,
  preferred_timezone text NOT NULL DEFAULT 'America/New_York',
  locale text NOT NULL DEFAULT 'en-US',
  last_active_business_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();

-- Backfill profiles for existing auth users
INSERT INTO public.profiles (id)
SELECT id FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ============ private.platform_admins ============
CREATE TABLE private.platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'super_admin' CHECK (role = 'super_admin'),
  active boolean NOT NULL DEFAULT true,
  granted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (user_id)
);
GRANT ALL ON private.platform_admins TO service_role;
ALTER TABLE private.platform_admins ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER platform_admins_set_updated_at BEFORE UPDATE ON private.platform_admins FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ organizations ============
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  billing_email text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','archived')),
  default_currency text NOT NULL DEFAULT 'USD' CHECK (default_currency ~ '^[A-Z]{3}$'),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (slug),
  UNIQUE (id) -- implied; kept explicit for composite FK targets
);
GRANT SELECT ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER organizations_set_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ organization_members ============
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (organization_id, user_id),
  UNIQUE (organization_id, id)
);
GRANT SELECT ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER organization_members_set_updated_at BEFORE UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE INDEX organization_members_user_active_idx ON public.organization_members (user_id, organization_id) WHERE active;

-- Prevent removal of the last active organization owner
CREATE OR REPLACE FUNCTION private.protect_last_org_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (TG_OP = 'DELETE' AND OLD.role = 'owner' AND OLD.active)
     OR (TG_OP = 'UPDATE' AND OLD.role = 'owner' AND OLD.active AND (NEW.role <> 'owner' OR NOT NEW.active)) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = OLD.organization_id
        AND om.role = 'owner' AND om.active AND om.id <> OLD.id
    ) THEN
      RAISE EXCEPTION 'cannot remove the last active organization owner';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER organization_members_protect_owner BEFORE UPDATE OR DELETE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION private.protect_last_org_owner();

-- ============ businesses ============
CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  name text NOT NULL,
  slug text NOT NULL,
  industry text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  email text,
  phone_e164 text,
  website_url text,
  timezone text NOT NULL DEFAULT 'America/New_York',
  currency text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  accent_color text NOT NULL DEFAULT '#6d5dfc' CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  logo_asset_id uuid,
  cover_asset_id uuid,
  default_location_id uuid,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','suspended','archived')),
  onboarding_step smallint NOT NULL DEFAULT 1 CHECK (onboarding_step BETWEEN 1 AND 6),
  setup_completed_at timestamptz,
  published_at timestamptz,
  archived_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (slug),
  UNIQUE (organization_id, id),
  CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
GRANT SELECT ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER businesses_set_updated_at BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER businesses_check_timezone BEFORE INSERT OR UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION private.check_timezone();

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_last_active_business_fk
  FOREIGN KEY (last_active_business_id) REFERENCES public.businesses(id) ON DELETE SET NULL;

-- ============ business_settings ============
CREATE TABLE public.business_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  slot_interval_minutes integer NOT NULL DEFAULT 30 CHECK (slot_interval_minutes BETWEEN 5 AND 120),
  minimum_notice_minutes integer NOT NULL DEFAULT 60 CHECK (minimum_notice_minutes >= 0),
  maximum_advance_days integer NOT NULL DEFAULT 90 CHECK (maximum_advance_days BETWEEN 1 AND 730),
  cancellation_notice_minutes integer NOT NULL DEFAULT 1440 CHECK (cancellation_notice_minutes >= 0),
  reschedule_notice_minutes integer NOT NULL DEFAULT 1440 CHECK (reschedule_notice_minutes >= 0),
  maximum_appointments_per_day integer CHECK (maximum_appointments_per_day IS NULL OR maximum_appointments_per_day >= 1),
  manual_approval_required boolean NOT NULL DEFAULT false,
  allow_guest_booking boolean NOT NULL DEFAULT true,
  allow_staff_selection boolean NOT NULL DEFAULT true,
  cancellation_policy text NOT NULL DEFAULT '',
  booking_instructions text NOT NULL DEFAULT '',
  customer_fields jsonb NOT NULL DEFAULT '{"name":true,"email":true,"phone":false,"address":false}'
    CHECK (jsonb_typeof(customer_fields->'name') = 'boolean'
       AND jsonb_typeof(customer_fields->'email') = 'boolean'
       AND jsonb_typeof(customer_fields->'phone') = 'boolean'
       AND jsonb_typeof(customer_fields->'address') = 'boolean'),
  message_retention_days integer NOT NULL DEFAULT 365 CHECK (message_retention_days >= 1),
  recording_retention_days integer NOT NULL DEFAULT 30 CHECK (recording_retention_days >= 1),
  form_retention_days integer NOT NULL DEFAULT 730 CHECK (form_retention_days >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id),
  UNIQUE (business_id, id)
);
GRANT SELECT ON public.business_settings TO authenticated;
GRANT ALL ON public.business_settings TO service_role;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER business_settings_set_updated_at BEFORE UPDATE ON public.business_settings FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- customer_fields must contain exactly the four documented boolean keys
CREATE OR REPLACE FUNCTION private.check_customer_fields_shape()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (SELECT count(*) FROM jsonb_object_keys(NEW.customer_fields)) <> 4
     OR NOT (NEW.customer_fields ?& ARRAY['name','email','phone','address']) THEN
    RAISE EXCEPTION 'customer_fields must contain exactly the keys: name, email, phone, address';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER business_settings_check_customer_fields BEFORE INSERT OR UPDATE ON public.business_settings FOR EACH ROW EXECUTE FUNCTION private.check_customer_fields_shape();

-- ============ business_members ============
CREATE TABLE public.business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','manager','staff')),
  active boolean NOT NULL DEFAULT true,
  all_locations boolean NOT NULL DEFAULT false,
  can_manage_customers boolean NOT NULL DEFAULT false,
  can_manage_services boolean NOT NULL DEFAULT false,
  can_manage_staff boolean NOT NULL DEFAULT false,
  can_manage_forms boolean NOT NULL DEFAULT false,
  can_manage_messages boolean NOT NULL DEFAULT false,
  can_manage_automations boolean NOT NULL DEFAULT false,
  can_view_analytics boolean NOT NULL DEFAULT false,
  can_manage_billing boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, user_id),
  UNIQUE (business_id, id)
);
GRANT SELECT ON public.business_members TO authenticated;
GRANT ALL ON public.business_members TO service_role;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER business_members_set_updated_at BEFORE UPDATE ON public.business_members FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE INDEX business_members_user_active_idx ON public.business_members (user_id, business_id) WHERE active;

-- Prevent removal of the last active business owner
CREATE OR REPLACE FUNCTION private.protect_last_business_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (TG_OP = 'DELETE' AND OLD.role = 'owner' AND OLD.active)
     OR (TG_OP = 'UPDATE' AND OLD.role = 'owner' AND OLD.active AND (NEW.role <> 'owner' OR NOT NEW.active)) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.business_members bm
      WHERE bm.business_id = OLD.business_id
        AND bm.role = 'owner' AND bm.active AND bm.id <> OLD.id
    ) THEN
      RAISE EXCEPTION 'cannot remove the last active business owner';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER business_members_protect_owner BEFORE UPDATE OR DELETE ON public.business_members FOR EACH ROW EXECUTE FUNCTION private.protect_last_business_owner();

-- ============ locations ============
CREATE TABLE public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  name text NOT NULL,
  slug text NOT NULL,
  address_line1 text NOT NULL DEFAULT '',
  address_line2 text,
  city text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  postal_code text NOT NULL DEFAULT '',
  country_code text NOT NULL DEFAULT 'US',
  timezone text NOT NULL DEFAULT 'America/New_York',
  phone_e164 text,
  email text,
  active boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, slug),
  UNIQUE (business_id, id)
);
GRANT SELECT ON public.locations TO authenticated;
GRANT ALL ON public.locations TO service_role;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER locations_set_updated_at BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER locations_check_timezone BEFORE INSERT OR UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION private.check_timezone();

-- ============ member_locations ============
CREATE TABLE public.member_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  business_member_id uuid NOT NULL,
  location_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, business_member_id, location_id),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, business_member_id) REFERENCES public.business_members (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, location_id) REFERENCES public.locations (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.member_locations TO authenticated;
GRANT ALL ON public.member_locations TO service_role;
ALTER TABLE public.member_locations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER member_locations_set_updated_at BEFORE UPDATE ON public.member_locations FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ member_invitations ============
CREATE TABLE public.member_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  email text NOT NULL CHECK (email = lower(email)),
  role text NOT NULL CHECK (role IN ('manager','staff')),
  location_ids uuid[] NOT NULL DEFAULT '{}',
  permissions jsonb NOT NULL DEFAULT '{}',
  invited_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, id)
);
GRANT SELECT ON public.member_invitations TO authenticated;
GRANT ALL ON public.member_invitations TO service_role;
ALTER TABLE public.member_invitations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER member_invitations_set_updated_at BEFORE UPDATE ON public.member_invitations FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- Validate invitation location IDs belong to the same business
CREATE OR REPLACE FUNCTION private.check_invitation_locations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM unnest(NEW.location_ids) AS loc(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.locations l WHERE l.id = loc.id AND l.business_id = NEW.business_id
    )
  ) THEN
    RAISE EXCEPTION 'invitation location_ids must belong to the same business';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER member_invitations_check_locations BEFORE INSERT OR UPDATE ON public.member_invitations FOR EACH ROW EXECUTE FUNCTION private.check_invitation_locations();