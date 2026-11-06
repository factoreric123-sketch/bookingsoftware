-- ============ storage_assets ============
CREATE TABLE public.storage_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  bucket_name text NOT NULL CHECK (bucket_name IN ('business-branding','business-files')),
  object_path text NOT NULL,
  original_filename text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('image/png','image/jpeg','image/webp','application/pdf','text/plain')),
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0 AND size_bytes <= 10485760),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('public','private')),
  uploaded_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  scan_status text NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending','clean','rejected')),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (bucket_name, object_path),
  UNIQUE (business_id, id),
  CHECK (object_path LIKE business_id::text || '/%')
);
GRANT SELECT ON public.storage_assets TO authenticated;
GRANT ALL ON public.storage_assets TO service_role;
ALTER TABLE public.storage_assets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER storage_assets_set_updated_at BEFORE UPDATE ON public.storage_assets FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- Circular FKs on businesses now that storage_assets and locations exist
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_logo_asset_fk FOREIGN KEY (logo_asset_id) REFERENCES public.storage_assets(id) ON DELETE RESTRICT,
  ADD CONSTRAINT businesses_cover_asset_fk FOREIGN KEY (cover_asset_id) REFERENCES public.storage_assets(id) ON DELETE RESTRICT,
  ADD CONSTRAINT businesses_default_location_fk FOREIGN KEY (default_location_id) REFERENCES public.locations(id) ON DELETE RESTRICT;

-- Asset/location references on businesses must belong to the same business
CREATE OR REPLACE FUNCTION private.check_business_asset_location_refs()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.logo_asset_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.storage_assets a WHERE a.id = NEW.logo_asset_id AND a.business_id = NEW.id
  ) THEN RAISE EXCEPTION 'logo_asset_id must belong to this business'; END IF;
  IF NEW.cover_asset_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.storage_assets a WHERE a.id = NEW.cover_asset_id AND a.business_id = NEW.id
  ) THEN RAISE EXCEPTION 'cover_asset_id must belong to this business'; END IF;
  IF NEW.default_location_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.locations l WHERE l.id = NEW.default_location_id AND l.business_id = NEW.id
  ) THEN RAISE EXCEPTION 'default_location_id must belong to this business'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER businesses_check_refs BEFORE INSERT OR UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION private.check_business_asset_location_refs();

-- ============ business_hours ============
CREATE TABLE public.business_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  location_id uuid NOT NULL,
  iso_weekday smallint NOT NULL CHECK (iso_weekday BETWEEN 1 AND 7),
  opens_at time NOT NULL,
  closes_at time NOT NULL CHECK (opens_at < closes_at),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, location_id) REFERENCES public.locations (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.business_hours TO authenticated;
GRANT ALL ON public.business_hours TO service_role;
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER business_hours_set_updated_at BEFORE UPDATE ON public.business_hours FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE INDEX business_hours_location_day_idx ON public.business_hours (business_id, location_id, iso_weekday) WHERE active;

-- No overlapping active intervals for the same location and weekday
CREATE OR REPLACE FUNCTION private.check_business_hours_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.active AND EXISTS (
    SELECT 1 FROM public.business_hours bh
    WHERE bh.business_id = NEW.business_id
      AND bh.location_id = NEW.location_id
      AND bh.iso_weekday = NEW.iso_weekday
      AND bh.active
      AND bh.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND bh.opens_at < NEW.closes_at AND NEW.opens_at < bh.closes_at
  ) THEN
    RAISE EXCEPTION 'overlapping active business hours for this location and weekday';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER business_hours_no_overlap BEFORE INSERT OR UPDATE ON public.business_hours FOR EACH ROW EXECUTE FUNCTION private.check_business_hours_overlap();

-- ============ staff_profiles ============
CREATE TABLE public.staff_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  email text,
  phone_e164 text,
  bio text NOT NULL DEFAULT '',
  avatar_asset_id uuid,
  color text NOT NULL DEFAULT '#6d5dfc' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  active boolean NOT NULL DEFAULT true,
  bookable boolean NOT NULL DEFAULT true,
  weekly_capacity_minutes integer NOT NULL DEFAULT 2400 CHECK (weekly_capacity_minutes >= 0),
  buffer_before_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_before_minutes >= 0),
  buffer_after_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_after_minutes >= 0),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, avatar_asset_id) REFERENCES public.storage_assets (business_id, id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX staff_profiles_user_uidx ON public.staff_profiles (business_id, user_id) WHERE user_id IS NOT NULL;
GRANT SELECT ON public.staff_profiles TO authenticated;
GRANT ALL ON public.staff_profiles TO service_role;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER staff_profiles_set_updated_at BEFORE UPDATE ON public.staff_profiles FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE INDEX staff_profiles_bookable_idx ON public.staff_profiles (business_id, active, bookable);

-- Linking a staff profile to a user requires active membership in the same business
CREATE OR REPLACE FUNCTION private.check_staff_user_membership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = NEW.business_id AND bm.user_id = NEW.user_id AND bm.active
  ) THEN
    RAISE EXCEPTION 'staff profile user must be an active member of the same business';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER staff_profiles_check_user BEFORE INSERT OR UPDATE ON public.staff_profiles FOR EACH ROW EXECUTE FUNCTION private.check_staff_user_membership();

-- ============ staff_locations ============
CREATE TABLE public.staff_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  staff_id uuid NOT NULL,
  location_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, staff_id, location_id),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, staff_id) REFERENCES public.staff_profiles (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, location_id) REFERENCES public.locations (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.staff_locations TO authenticated;
GRANT ALL ON public.staff_locations TO service_role;
ALTER TABLE public.staff_locations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER staff_locations_set_updated_at BEFORE UPDATE ON public.staff_locations FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ staff_availability ============
CREATE TABLE public.staff_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  staff_id uuid NOT NULL,
  location_id uuid NOT NULL,
  iso_weekday smallint NOT NULL CHECK (iso_weekday BETWEEN 1 AND 7),
  opens_at time NOT NULL,
  closes_at time NOT NULL CHECK (opens_at < closes_at),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_until date CHECK (effective_until IS NULL OR effective_until >= effective_from),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, staff_id) REFERENCES public.staff_profiles (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, location_id) REFERENCES public.locations (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.staff_availability TO authenticated;
GRANT ALL ON public.staff_availability TO service_role;
ALTER TABLE public.staff_availability ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER staff_availability_set_updated_at BEFORE UPDATE ON public.staff_availability FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE INDEX staff_availability_lookup_idx ON public.staff_availability (business_id, staff_id, location_id, iso_weekday) WHERE active;

-- Staff must be assigned to the location; reject overlapping effective intervals
CREATE OR REPLACE FUNCTION private.check_staff_availability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.staff_locations sl
    WHERE sl.business_id = NEW.business_id AND sl.staff_id = NEW.staff_id AND sl.location_id = NEW.location_id
  ) THEN
    RAISE EXCEPTION 'staff must be assigned to the location before availability can be set';
  END IF;
  IF NEW.active AND EXISTS (
    SELECT 1 FROM public.staff_availability sa
    WHERE sa.business_id = NEW.business_id
      AND sa.staff_id = NEW.staff_id
      AND sa.location_id = NEW.location_id
      AND sa.iso_weekday = NEW.iso_weekday
      AND sa.active
      AND sa.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND sa.opens_at < NEW.closes_at AND NEW.opens_at < sa.closes_at
      AND sa.effective_from <= COALESCE(NEW.effective_until, DATE '9999-12-31')
      AND NEW.effective_from <= COALESCE(sa.effective_until, DATE '9999-12-31')
  ) THEN
    RAISE EXCEPTION 'overlapping effective availability intervals for this staff/location/day';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER staff_availability_check BEFORE INSERT OR UPDATE ON public.staff_availability FOR EACH ROW EXECUTE FUNCTION private.check_staff_availability();

-- ============ staff_time_off ============
CREATE TABLE public.staff_time_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  staff_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK (starts_at < ends_at),
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','rejected','cancelled')),
  requested_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, staff_id) REFERENCES public.staff_profiles (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.staff_time_off TO authenticated;
GRANT ALL ON public.staff_time_off TO service_role;
ALTER TABLE public.staff_time_off ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER staff_time_off_set_updated_at BEFORE UPDATE ON public.staff_time_off FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE INDEX staff_time_off_range_idx ON public.staff_time_off USING gist (business_id, staff_id, tstzrange(starts_at, ends_at, '[)'));

-- ============ service_categories ============
CREATE TABLE public.service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, name),
  UNIQUE (business_id, id)
);
GRANT SELECT ON public.service_categories TO authenticated;
GRANT ALL ON public.service_categories TO service_role;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER service_categories_set_updated_at BEFORE UPDATE ON public.service_categories FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ services ============
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  category_id uuid,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 5 AND 1440),
  price_minor bigint NOT NULL DEFAULT 0 CHECK (price_minor >= 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  buffer_before_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_before_minutes >= 0),
  buffer_after_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_after_minutes >= 0),
  appointment_type text NOT NULL DEFAULT 'individual' CHECK (appointment_type IN ('individual','group')),
  capacity integer NOT NULL DEFAULT 1 CHECK (capacity >= 1),
  delivery_mode text NOT NULL DEFAULT 'business_location' CHECK (delivery_mode IN ('business_location','customer_location','online')),
  payment_requirement text NOT NULL DEFAULT 'pay_later' CHECK (payment_requirement IN ('pay_later','deposit','full')),
  deposit_type text CHECK (deposit_type IN ('fixed','percentage')),
  deposit_value bigint CHECK (deposit_value IS NULL OR deposit_value >= 0),
  color text NOT NULL DEFAULT '#6d5dfc' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, category_id) REFERENCES public.service_categories (business_id, id) ON DELETE RESTRICT,
  CHECK (appointment_type = 'group' OR capacity = 1),
  CHECK (
    (payment_requirement = 'pay_later' AND deposit_type IS NULL AND deposit_value IS NULL)
    OR (payment_requirement = 'full' AND deposit_type IS NULL AND deposit_value IS NULL)
    OR (payment_requirement = 'deposit' AND deposit_type IS NOT NULL AND deposit_value IS NOT NULL)
  ),
  CHECK (deposit_type IS DISTINCT FROM 'percentage' OR deposit_value BETWEEN 0 AND 10000),
  CHECK (deposit_type IS DISTINCT FROM 'fixed' OR deposit_value <= price_minor)
);
GRANT SELECT ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER services_set_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE INDEX services_active_idx ON public.services (business_id, active, sort_order);

-- ============ service_locations ============
CREATE TABLE public.service_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  service_id uuid NOT NULL,
  location_id uuid NOT NULL,
  price_override_minor bigint CHECK (price_override_minor IS NULL OR price_override_minor >= 0),
  duration_override_minutes integer CHECK (duration_override_minutes IS NULL OR duration_override_minutes BETWEEN 5 AND 1440),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, service_id, location_id),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, service_id) REFERENCES public.services (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, location_id) REFERENCES public.locations (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.service_locations TO authenticated;
GRANT ALL ON public.service_locations TO service_role;
ALTER TABLE public.service_locations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER service_locations_set_updated_at BEFORE UPDATE ON public.service_locations FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ staff_services ============
CREATE TABLE public.staff_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  staff_id uuid NOT NULL,
  service_id uuid NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, staff_id, service_id),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, staff_id) REFERENCES public.staff_profiles (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, service_id) REFERENCES public.services (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.staff_services TO authenticated;
GRANT ALL ON public.staff_services TO service_role;
ALTER TABLE public.staff_services ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER staff_services_set_updated_at BEFORE UPDATE ON public.staff_services FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ service_addons ============
CREATE TABLE public.service_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  service_id uuid NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price_minor bigint NOT NULL DEFAULT 0 CHECK (price_minor >= 0),
  additional_duration_minutes integer NOT NULL DEFAULT 0 CHECK (additional_duration_minutes >= 0),
  maximum_quantity integer NOT NULL DEFAULT 1 CHECK (maximum_quantity >= 1),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, service_id) REFERENCES public.services (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.service_addons TO authenticated;
GRANT ALL ON public.service_addons TO service_role;
ALTER TABLE public.service_addons ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER service_addons_set_updated_at BEFORE UPDATE ON public.service_addons FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- Group services cannot have duration-changing add-ons
CREATE OR REPLACE FUNCTION private.check_addon_group_duration()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.additional_duration_minutes <> 0 AND EXISTS (
    SELECT 1 FROM public.services s
    WHERE s.id = NEW.service_id AND s.business_id = NEW.business_id AND s.appointment_type = 'group'
  ) THEN
    RAISE EXCEPTION 'group services cannot have add-ons that change duration';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER service_addons_check_group BEFORE INSERT OR UPDATE ON public.service_addons FOR EACH ROW EXECUTE FUNCTION private.check_addon_group_duration();

-- ============ storage.objects RLS for the two buckets ============
-- Businesses can only touch objects inside their own folder: <business_id>/...
CREATE POLICY storage_business_objects_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('business-branding','business-files')
    AND EXISTS (
      SELECT 1 FROM public.business_members bm
      WHERE bm.business_id = (string_to_array(name, '/'))[1]::uuid
        AND bm.user_id = auth.uid() AND bm.active
    )
  );
CREATE POLICY storage_business_objects_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('business-branding','business-files')
    AND EXISTS (
      SELECT 1 FROM public.business_members bm
      WHERE bm.business_id = (string_to_array(name, '/'))[1]::uuid
        AND bm.user_id = auth.uid() AND bm.active
        AND bm.role IN ('owner','manager')
    )
  );
CREATE POLICY storage_business_objects_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('business-branding','business-files')
    AND EXISTS (
      SELECT 1 FROM public.business_members bm
      WHERE bm.business_id = (string_to_array(name, '/'))[1]::uuid
        AND bm.user_id = auth.uid() AND bm.active
        AND bm.role IN ('owner','manager')
    )
  );