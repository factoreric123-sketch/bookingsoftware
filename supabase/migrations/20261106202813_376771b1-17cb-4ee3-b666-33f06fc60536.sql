-- ============ booking_pages ============
CREATE TABLE public.booking_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  location_id uuid NOT NULL,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  logo_asset_id uuid,
  cover_asset_id uuid,
  accent_color text NOT NULL DEFAULT '#6d5dfc' CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  background_color text NOT NULL DEFAULT '#f4f3f8' CHECK (background_color ~ '^#[0-9A-Fa-f]{6}$'),
  instructions text NOT NULL DEFAULT '',
  terms_text text NOT NULL DEFAULT '',
  cancellation_policy text NOT NULL DEFAULT '',
  required_customer_fields jsonb NOT NULL DEFAULT '{"name":true,"email":true,"phone":false,"address":false}'
    CHECK (jsonb_typeof(required_customer_fields->'name') = 'boolean'
       AND jsonb_typeof(required_customer_fields->'email') = 'boolean'
       AND jsonb_typeof(required_customer_fields->'phone') = 'boolean'
       AND jsonb_typeof(required_customer_fields->'address') = 'boolean'),
  staff_selection_enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','unpublished')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (slug),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, location_id) REFERENCES public.locations (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, logo_asset_id) REFERENCES public.storage_assets (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, cover_asset_id) REFERENCES public.storage_assets (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.booking_pages TO authenticated;
GRANT ALL ON public.booking_pages TO service_role;
ALTER TABLE public.booking_pages ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER booking_pages_set_updated_at BEFORE UPDATE ON public.booking_pages FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ recurrence_rules ============
CREATE TABLE public.recurrence_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  service_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  location_id uuid NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('daily','weekly','monthly')),
  interval_count integer NOT NULL DEFAULT 1 CHECK (interval_count >= 1),
  iso_weekdays smallint[] NOT NULL DEFAULT '{}',
  day_of_month smallint CHECK (day_of_month IS NULL OR day_of_month BETWEEN 1 AND 31),
  local_start_time time NOT NULL,
  timezone text NOT NULL,
  starts_on date NOT NULL,
  ends_on date CHECK (ends_on IS NULL OR ends_on >= starts_on),
  occurrence_limit integer CHECK (occurrence_limit IS NULL OR occurrence_limit BETWEEN 1 AND 366),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, service_id) REFERENCES public.services (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, staff_id) REFERENCES public.staff_profiles (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, location_id) REFERENCES public.locations (business_id, id) ON DELETE RESTRICT,
  CHECK (NOT (ends_on IS NULL AND occurrence_limit IS NULL)),
  CHECK (frequency <> 'weekly' OR cardinality(iso_weekdays) > 0),
  CHECK (frequency <> 'monthly' OR day_of_month IS NOT NULL)
);
GRANT SELECT ON public.recurrence_rules TO authenticated;
GRANT ALL ON public.recurrence_rules TO service_role;
ALTER TABLE public.recurrence_rules ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER recurrence_rules_set_updated_at BEFORE UPDATE ON public.recurrence_rules FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER recurrence_rules_check_timezone BEFORE INSERT OR UPDATE ON public.recurrence_rules FOR EACH ROW EXECUTE FUNCTION private.check_timezone();

-- iso_weekdays: unique integers 1..7
CREATE OR REPLACE FUNCTION private.check_recurrence_weekdays()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM unnest(NEW.iso_weekdays) d
    WHERE d < 1 OR d > 7
  ) THEN
    RAISE EXCEPTION 'iso_weekdays must be between 1 and 7';
  END IF;
  IF (SELECT count(*) FROM unnest(NEW.iso_weekdays) d) <> (SELECT count(DISTINCT d) FROM unnest(NEW.iso_weekdays) d) THEN
    RAISE EXCEPTION 'iso_weekdays must be unique';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER recurrence_rules_check_weekdays BEFORE INSERT OR UPDATE ON public.recurrence_rules FOR EACH ROW EXECUTE FUNCTION private.check_recurrence_weekdays();

-- ============ booking_sessions ============
CREATE TABLE public.booking_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  location_id uuid NOT NULL,
  primary_service_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  recurrence_rule_id uuid,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK (starts_at < ends_at),
  timezone text NOT NULL,
  buffer_before_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_before_minutes >= 0),
  buffer_after_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_after_minutes >= 0),
  capacity integer NOT NULL DEFAULT 1 CHECK (capacity >= 1),
  session_type text NOT NULL CHECK (session_type IN ('individual','group')),
  state text NOT NULL DEFAULT 'holding' CHECK (state IN ('holding','scheduled','completed','cancelled')),
  delivery_mode text NOT NULL CHECK (delivery_mode IN ('business_location','customer_location','online')),
  meeting_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, recurrence_rule_id, starts_at),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, location_id) REFERENCES public.locations (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, primary_service_id) REFERENCES public.services (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, staff_id) REFERENCES public.staff_profiles (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, recurrence_rule_id) REFERENCES public.recurrence_rules (business_id, id) ON DELETE RESTRICT,
  CHECK (session_type = 'group' OR capacity = 1)
);
GRANT SELECT ON public.booking_sessions TO authenticated;
GRANT ALL ON public.booking_sessions TO service_role;
ALTER TABLE public.booking_sessions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER booking_sessions_set_updated_at BEFORE UPDATE ON public.booking_sessions FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER booking_sessions_check_timezone BEFORE INSERT OR UPDATE ON public.booking_sessions FOR EACH ROW EXECUTE FUNCTION private.check_timezone();
CREATE INDEX booking_sessions_starts_idx ON public.booking_sessions (business_id, starts_at);
CREATE INDEX booking_sessions_staff_starts_idx ON public.booking_sessions (business_id, staff_id, starts_at);
CREATE INDEX booking_sessions_location_starts_idx ON public.booking_sessions (business_id, location_id, starts_at);
CREATE INDEX booking_sessions_range_idx ON public.booking_sessions USING gist (business_id, staff_id, tstzrange(starts_at, ends_at, '[)'));

-- Session staff must be active, bookable, assigned to location and primary service
CREATE OR REPLACE FUNCTION private.check_session_staff_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.staff_profiles sp
    WHERE sp.id = NEW.staff_id AND sp.business_id = NEW.business_id AND sp.active AND sp.bookable
  ) THEN
    RAISE EXCEPTION 'session staff must be active and bookable';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.staff_locations sl
    WHERE sl.business_id = NEW.business_id AND sl.staff_id = NEW.staff_id AND sl.location_id = NEW.location_id
  ) THEN
    RAISE EXCEPTION 'session staff must be assigned to the session location';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.staff_services ss
    WHERE ss.business_id = NEW.business_id AND ss.staff_id = NEW.staff_id AND ss.service_id = NEW.primary_service_id AND ss.active
  ) THEN
    RAISE EXCEPTION 'session staff must be assigned to the primary service';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER booking_sessions_check_staff BEFORE INSERT OR UPDATE ON public.booking_sessions FOR EACH ROW EXECUTE FUNCTION private.check_session_staff_eligibility();

-- ============ appointments ============
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  session_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  seat_count integer NOT NULL DEFAULT 1 CHECK (seat_count >= 1),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','checked_in','completed','cancelled','no_show')),
  source text NOT NULL CHECK (source IN ('dashboard','booking_page','ai_phone','ai_sms','api')),
  customer_notes text NOT NULL DEFAULT '',
  customer_address jsonb,
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  subtotal_minor bigint NOT NULL DEFAULT 0 CHECK (subtotal_minor >= 0),
  discount_minor bigint NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  tax_minor bigint NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  tip_minor bigint NOT NULL DEFAULT 0 CHECK (tip_minor >= 0),
  total_minor bigint NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
  amount_due_now_minor bigint NOT NULL DEFAULT 0 CHECK (amount_due_now_minor >= 0),
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('not_required','unpaid','partially_paid','paid','partially_refunded','refunded')),
  cancellation_reason text,
  cancelled_at timestamptz,
  cancelled_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_in_at timestamptz,
  completed_at timestamptz,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_sandbox boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, session_id) REFERENCES public.booking_sessions (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, customer_id) REFERENCES public.customers (business_id, id) ON DELETE RESTRICT,
  CHECK (total_minor = subtotal_minor - discount_minor + tax_minor + tip_minor),
  CHECK (discount_minor <= subtotal_minor),
  CHECK (amount_due_now_minor <= total_minor),
  CHECK (status <> 'cancelled' OR cancelled_at IS NOT NULL),
  CHECK (status <> 'checked_in' OR checked_in_at IS NOT NULL),
  CHECK (status <> 'completed' OR completed_at IS NOT NULL)
);
GRANT SELECT ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER appointments_set_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE INDEX appointments_customer_idx ON public.appointments (business_id, customer_id, created_at DESC);
CREATE INDEX appointments_status_session_idx ON public.appointments (business_id, status, session_id);

-- customer_address shape: only the six documented keys
CREATE OR REPLACE FUNCTION private.check_appointment_address()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.customer_address IS NOT NULL THEN
    IF jsonb_typeof(NEW.customer_address) <> 'object' THEN
      RAISE EXCEPTION 'customer_address must be an object';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_object_keys(NEW.customer_address) k
      WHERE k NOT IN ('line1','line2','city','region','postal_code','country_code')
    ) THEN
      RAISE EXCEPTION 'customer_address contains unsupported keys';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER appointments_check_address BEFORE INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION private.check_appointment_address();

-- custom_field_values.appointment_id FK now that appointments exists
ALTER TABLE public.custom_field_values
  ADD CONSTRAINT custom_field_values_appointment_fk
  FOREIGN KEY (business_id, appointment_id) REFERENCES public.appointments (business_id, id) ON DELETE RESTRICT;

-- ============ appointment_services ============
CREATE TABLE public.appointment_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  appointment_id uuid NOT NULL,
  service_id uuid NOT NULL,
  sequence integer NOT NULL,
  service_name text NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  unit_price_minor bigint NOT NULL CHECK (unit_price_minor >= 0),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  line_total_minor bigint NOT NULL CHECK (line_total_minor >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, appointment_id, sequence),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, appointment_id) REFERENCES public.appointments (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, service_id) REFERENCES public.services (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.appointment_services TO authenticated;
GRANT ALL ON public.appointment_services TO service_role;
ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;

-- ============ appointment_addons ============
CREATE TABLE public.appointment_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  appointment_id uuid NOT NULL,
  service_addon_id uuid NOT NULL,
  addon_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  unit_price_minor bigint NOT NULL CHECK (unit_price_minor >= 0),
  additional_duration_minutes integer NOT NULL DEFAULT 0 CHECK (additional_duration_minutes >= 0),
  line_total_minor bigint NOT NULL CHECK (line_total_minor >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, appointment_id) REFERENCES public.appointments (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, service_addon_id) REFERENCES public.service_addons (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.appointment_addons TO authenticated;
GRANT ALL ON public.appointment_addons TO service_role;
ALTER TABLE public.appointment_addons ENABLE ROW LEVEL SECURITY;

-- ============ appointment_holds ============
CREATE TABLE public.appointment_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  session_id uuid NOT NULL,
  seat_count integer NOT NULL DEFAULT 1 CHECK (seat_count >= 1),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','consumed','expired','released')),
  consumed_appointment_id uuid,
  checkout_reference text,
  price_snapshot jsonb NOT NULL,
  request_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, session_id) REFERENCES public.booking_sessions (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, consumed_appointment_id) REFERENCES public.appointments (business_id, id) ON DELETE RESTRICT,
  CHECK (expires_at > created_at),
  CHECK (status <> 'consumed' OR consumed_appointment_id IS NOT NULL)
);
GRANT SELECT ON public.appointment_holds TO authenticated;
GRANT ALL ON public.appointment_holds TO service_role;
ALTER TABLE public.appointment_holds ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER appointment_holds_set_updated_at BEFORE UPDATE ON public.appointment_holds FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE INDEX appointment_holds_status_expires_idx ON public.appointment_holds (status, expires_at);

-- Hold lifetime is exactly 10 minutes
CREATE OR REPLACE FUNCTION private.check_hold_lifetime()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.expires_at <> NEW.created_at + interval '10 minutes' THEN
    RAISE EXCEPTION 'hold lifetime must be exactly 10 minutes';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER appointment_holds_check_lifetime BEFORE INSERT ON public.appointment_holds FOR EACH ROW EXECUTE FUNCTION private.check_hold_lifetime();

-- ============ blocked_times ============
CREATE TABLE public.blocked_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  location_id uuid,
  staff_id uuid,
  staff_time_off_id uuid,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK (starts_at < ends_at),
  reason text NOT NULL DEFAULT '',
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, location_id) REFERENCES public.locations (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, staff_id) REFERENCES public.staff_profiles (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, staff_time_off_id) REFERENCES public.staff_time_off (business_id, id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX blocked_times_time_off_uidx ON public.blocked_times (staff_time_off_id) WHERE staff_time_off_id IS NOT NULL;
GRANT SELECT ON public.blocked_times TO authenticated;
GRANT ALL ON public.blocked_times TO service_role;
ALTER TABLE public.blocked_times ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER blocked_times_set_updated_at BEFORE UPDATE ON public.blocked_times FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE INDEX blocked_times_active_range_idx ON public.blocked_times (business_id, starts_at, ends_at) WHERE released_at IS NULL;
CREATE INDEX blocked_times_range_gist_idx ON public.blocked_times USING gist (business_id, tstzrange(starts_at, ends_at, '[)'));

-- ============ resource_reservations ============
CREATE TABLE public.resource_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  staff_id uuid NOT NULL,
  session_id uuid,
  blocked_time_id uuid,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK (starts_at < ends_at),
  occupied_range tstzrange GENERATED ALWAYS AS (tstzrange(starts_at, ends_at, '[)')) STORED,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, staff_id) REFERENCES public.staff_profiles (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, session_id) REFERENCES public.booking_sessions (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, blocked_time_id) REFERENCES public.blocked_times (business_id, id) ON DELETE RESTRICT,
  CHECK (num_nonnulls(session_id, blocked_time_id) = 1)
);
CREATE UNIQUE INDEX resource_reservations_session_uidx ON public.resource_reservations (business_id, session_id, staff_id) WHERE session_id IS NOT NULL;
CREATE UNIQUE INDEX resource_reservations_block_uidx ON public.resource_reservations (business_id, blocked_time_id, staff_id) WHERE blocked_time_id IS NOT NULL;
ALTER TABLE public.resource_reservations
  ADD CONSTRAINT resource_reservations_no_overlap
  EXCLUDE USING gist (
    business_id WITH =,
    staff_id WITH =,
    occupied_range WITH &&
  ) WHERE (active);
-- No direct client writes: reads only for authenticated; service_role manages rows
GRANT SELECT ON public.resource_reservations TO authenticated;
GRANT ALL ON public.resource_reservations TO service_role;
ALTER TABLE public.resource_reservations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER resource_reservations_set_updated_at BEFORE UPDATE ON public.resource_reservations FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ appointment_status_history ============
CREATE TABLE public.appointment_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  appointment_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('user','customer_token','system','provider')),
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, appointment_id) REFERENCES public.appointments (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.appointment_status_history TO authenticated;
GRANT ALL ON public.appointment_status_history TO service_role;
ALTER TABLE public.appointment_status_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX appointment_status_history_appt_idx ON public.appointment_status_history (business_id, appointment_id, created_at);

-- ============ private.capability_tokens ============
CREATE TABLE private.capability_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('appointment_manage','booking_hold','member_invitation')),
  appointment_id uuid,
  hold_id uuid,
  invitation_id uuid,
  token_hash bytea NOT NULL CHECK (octet_length(token_hash) = 32),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (token_hash),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, appointment_id) REFERENCES public.appointments (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, hold_id) REFERENCES public.appointment_holds (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, invitation_id) REFERENCES public.member_invitations (business_id, id) ON DELETE RESTRICT,
  CHECK (num_nonnulls(appointment_id, hold_id, invitation_id) = 1),
  CHECK (kind <> 'appointment_manage' OR appointment_id IS NOT NULL),
  CHECK (kind <> 'booking_hold' OR hold_id IS NOT NULL),
  CHECK (kind <> 'member_invitation' OR invitation_id IS NOT NULL)
);
GRANT ALL ON private.capability_tokens TO service_role;
ALTER TABLE private.capability_tokens ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER capability_tokens_set_updated_at BEFORE UPDATE ON private.capability_tokens FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();