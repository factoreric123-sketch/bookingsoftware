-- ============ integrations ============
CREATE TABLE public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  location_id uuid,
  provider text NOT NULL CHECK (provider IN ('google_calendar','outlook_calendar','stripe','twilio','resend','voice','google_booking')),
  status text NOT NULL DEFAULT 'not_configured' CHECK (status IN ('not_configured','connecting','connected','disconnected','error','pending_approval')),
  external_account_id text,
  connected_at timestamptz,
  disconnected_at timestamptz,
  last_verified_at timestamptz,
  last_error_code text,
  last_error_message text,
  public_config jsonb NOT NULL DEFAULT '{}',
  is_sandbox boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, location_id) REFERENCES public.locations (business_id, id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX integrations_business_provider_uidx ON public.integrations (business_id, provider) WHERE location_id IS NULL;
CREATE UNIQUE INDEX integrations_location_provider_uidx ON public.integrations (business_id, location_id, provider) WHERE location_id IS NOT NULL;
GRANT SELECT ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER integrations_set_updated_at BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- public_config must not contain credential-looking keys
CREATE OR REPLACE FUNCTION private.check_integration_public_config()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF jsonb_typeof(NEW.public_config) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'public_config must be an object';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(NEW.public_config) k
    WHERE lower(k) ~ '(secret|token|password|api_?key|credential|bearer|private)'
  ) THEN
    RAISE EXCEPTION 'public_config must not contain credentials, tokens, or API keys';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER integrations_check_public_config BEFORE INSERT OR UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION private.check_integration_public_config();

-- ============ calendar_connections ============
CREATE TABLE public.calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  integration_id uuid NOT NULL,
  staff_id uuid,
  location_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('google','outlook')),
  external_account_email text,
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected','connected','error')),
  scopes text[] NOT NULL DEFAULT '{}',
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, integration_id) REFERENCES public.integrations (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, staff_id) REFERENCES public.staff_profiles (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, location_id) REFERENCES public.locations (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.calendar_connections TO authenticated;
GRANT ALL ON public.calendar_connections TO service_role;
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER calendar_connections_set_updated_at BEFORE UPDATE ON public.calendar_connections FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ private.integration_secret_refs ============
CREATE TABLE private.integration_secret_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  integration_id uuid NOT NULL,
  calendar_connection_id uuid,
  secret_kind text NOT NULL CHECK (secret_kind IN ('oauth_access_token','oauth_refresh_token','provider_api_key','webhook_signing_secret')),
  vault_secret_id uuid NOT NULL,
  expires_at timestamptz,
  rotated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, integration_id) REFERENCES public.integrations (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, calendar_connection_id) REFERENCES public.calendar_connections (business_id, id) ON DELETE RESTRICT
);
GRANT ALL ON private.integration_secret_refs TO service_role;
ALTER TABLE private.integration_secret_refs ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER integration_secret_refs_set_updated_at BEFORE UPDATE ON private.integration_secret_refs FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ calendar_calendars ============
CREATE TABLE public.calendar_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  connection_id uuid NOT NULL,
  external_calendar_id text NOT NULL,
  name text NOT NULL,
  timezone text NOT NULL,
  use_for_availability boolean NOT NULL DEFAULT true,
  write_appointments boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, connection_id, external_calendar_id),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, connection_id) REFERENCES public.calendar_connections (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.calendar_calendars TO authenticated;
GRANT ALL ON public.calendar_calendars TO service_role;
ALTER TABLE public.calendar_calendars ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER calendar_calendars_set_updated_at BEFORE UPDATE ON public.calendar_calendars FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE TRIGGER calendar_calendars_check_timezone BEFORE INSERT OR UPDATE ON public.calendar_calendars FOR EACH ROW EXECUTE FUNCTION private.check_timezone();

-- ============ calendar_events ============
CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  calendar_id uuid NOT NULL,
  session_id uuid,
  external_event_id text NOT NULL,
  external_etag text,
  external_updated_at timestamptz,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK (starts_at < ends_at),
  busy boolean NOT NULL DEFAULT true,
  cancelled boolean NOT NULL DEFAULT false,
  origin text NOT NULL CHECK (origin IN ('external','avello')),
  sync_status text NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('pending','synced','error')),
  conflicts_with_booking boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, calendar_id, external_event_id),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, calendar_id) REFERENCES public.calendar_calendars (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, session_id) REFERENCES public.booking_sessions (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER calendar_events_set_updated_at BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE INDEX calendar_events_range_idx ON public.calendar_events USING gist (business_id, tstzrange(starts_at, ends_at, '[)')) WHERE busy AND NOT cancelled;

-- ============ calendar_sync_runs ============
CREATE TABLE public.calendar_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  connection_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('pull','push')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','succeeded','failed')),
  records_read integer NOT NULL DEFAULT 0 CHECK (records_read >= 0),
  records_written integer NOT NULL DEFAULT 0 CHECK (records_written >= 0),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, connection_id) REFERENCES public.calendar_connections (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.calendar_sync_runs TO authenticated;
GRANT ALL ON public.calendar_sync_runs TO service_role;
ALTER TABLE public.calendar_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER calendar_sync_runs_set_updated_at BEFORE UPDATE ON public.calendar_sync_runs FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ phone_numbers ============
CREATE TABLE public.phone_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  location_id uuid,
  integration_id uuid NOT NULL,
  phone_e164 text NOT NULL,
  provider_phone_id text,
  status text NOT NULL DEFAULT 'unconfigured' CHECK (status IN ('unconfigured','provisioning','active','suspended','released')),
  registration_status text NOT NULL DEFAULT 'not_started' CHECK (registration_status IN ('not_started','pending','approved','rejected')),
  sms_enabled boolean NOT NULL DEFAULT false,
  voice_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (phone_e164),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, location_id) REFERENCES public.locations (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, integration_id) REFERENCES public.integrations (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.phone_numbers TO authenticated;
GRANT ALL ON public.phone_numbers TO service_role;
ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER phone_numbers_set_updated_at BEFORE UPDATE ON public.phone_numbers FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ conversations ============
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL,
  location_id uuid,
  phone_number_id uuid,
  assigned_staff_id uuid,
  channel text NOT NULL CHECK (channel IN ('sms','email')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  ai_enabled boolean NOT NULL DEFAULT false,
  staff_takeover_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, customer_id, phone_number_id, channel),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, customer_id) REFERENCES public.customers (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, location_id) REFERENCES public.locations (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, phone_number_id) REFERENCES public.phone_numbers (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, assigned_staff_id) REFERENCES public.staff_profiles (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER conversations_set_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE INDEX conversations_last_message_idx ON public.conversations (business_id, last_message_at DESC);

-- ============ messages ============
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  conversation_id uuid NOT NULL,
  integration_id uuid,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  channel text NOT NULL CHECK (channel IN ('sms','email')),
  from_address text NOT NULL,
  to_address text NOT NULL,
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','queued','sent','delivered','failed','received','suppressed')),
  provider_message_id text,
  provider_error_code text,
  provider_error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  received_at timestamptz,
  segment_count integer NOT NULL DEFAULT 0 CHECK (segment_count >= 0),
  is_sandbox boolean NOT NULL DEFAULT false,
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, idempotency_key),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, conversation_id) REFERENCES public.conversations (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, integration_id) REFERENCES public.integrations (business_id, id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX messages_provider_uidx ON public.messages (integration_id, provider_message_id) WHERE provider_message_id IS NOT NULL;
GRANT SELECT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER messages_set_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE INDEX messages_conversation_idx ON public.messages (business_id, conversation_id, created_at);

-- ============ message_attachments ============
CREATE TABLE public.message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  message_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, message_id, asset_id),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, message_id) REFERENCES public.messages (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, asset_id) REFERENCES public.storage_assets (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.message_attachments TO authenticated;
GRANT ALL ON public.message_attachments TO service_role;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

-- ============ message_templates ============
CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('sms','email')),
  subject text,
  body text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('transactional','marketing')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, name, channel),
  UNIQUE (business_id, id)
);
GRANT SELECT ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER message_templates_set_updated_at BEFORE UPDATE ON public.message_templates FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ calls ============
CREATE TABLE public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  customer_id uuid,
  phone_number_id uuid,
  integration_id uuid,
  appointment_id uuid,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  caller_e164 text NOT NULL,
  called_e164 text NOT NULL,
  provider_call_id text,
  started_at timestamptz NOT NULL,
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  status text NOT NULL CHECK (status IN ('simulated','ringing','in_progress','completed','failed','missed')),
  outcome text CHECK (outcome IS NULL OR outcome IN ('booked','rescheduled','cancelled','message','transferred','callback','information','unresolved')),
  summary text NOT NULL DEFAULT '',
  transcript text,
  recording_asset_id uuid,
  recording_consent_id uuid,
  recording_delete_after timestamptz,
  is_sandbox boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, customer_id) REFERENCES public.customers (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, phone_number_id) REFERENCES public.phone_numbers (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, integration_id) REFERENCES public.integrations (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, appointment_id) REFERENCES public.appointments (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, recording_asset_id) REFERENCES public.storage_assets (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, recording_consent_id) REFERENCES public.customer_consents (business_id, id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX calls_provider_uidx ON public.calls (integration_id, provider_call_id) WHERE provider_call_id IS NOT NULL;
GRANT SELECT ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER calls_set_updated_at BEFORE UPDATE ON public.calls FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE INDEX calls_started_idx ON public.calls (business_id, started_at DESC);

-- Recording requires a consent record and a private asset
CREATE OR REPLACE FUNCTION private.check_call_recording()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.recording_asset_id IS NOT NULL THEN
    IF NEW.recording_consent_id IS NULL THEN
      RAISE EXCEPTION 'a recording requires explicit consent';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.storage_assets a
      WHERE a.id = NEW.recording_asset_id AND a.business_id = NEW.business_id AND a.visibility = 'private'
    ) THEN
      RAISE EXCEPTION 'recordings must be stored as private assets';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER calls_check_recording BEFORE INSERT OR UPDATE ON public.calls FOR EACH ROW EXECUTE FUNCTION private.check_call_recording();

-- ============ ai_assistant_settings ============
CREATE TABLE public.ai_assistant_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  location_id uuid NOT NULL,
  assistant_name text NOT NULL DEFAULT 'Ava',
  greeting text NOT NULL DEFAULT '',
  voice_identifier text,
  language_code text NOT NULL DEFAULT 'en-US',
  transfer_phone_e164 text,
  after_hours_behavior text NOT NULL DEFAULT 'take_message' CHECK (after_hours_behavior IN ('take_message','offer_callback','transfer')),
  disclosure_enabled boolean NOT NULL DEFAULT true,
  recording_enabled boolean NOT NULL DEFAULT false,
  recording_consent_text text NOT NULL DEFAULT '',
  recording_retention_days integer NOT NULL DEFAULT 30 CHECK (recording_retention_days >= 1),
  escalation_conditions jsonb NOT NULL DEFAULT '[]',
  voice_enabled boolean NOT NULL DEFAULT false,
  sms_enabled boolean NOT NULL DEFAULT false,
  sandbox_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, location_id),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, location_id) REFERENCES public.locations (business_id, id) ON DELETE RESTRICT,
  CHECK (after_hours_behavior <> 'transfer' OR transfer_phone_e164 IS NOT NULL),
  CHECK (NOT recording_enabled OR length(recording_consent_text) > 0)
);
GRANT SELECT ON public.ai_assistant_settings TO authenticated;
GRANT ALL ON public.ai_assistant_settings TO service_role;
ALTER TABLE public.ai_assistant_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER ai_assistant_settings_set_updated_at BEFORE UPDATE ON public.ai_assistant_settings FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- escalation_conditions: array drawn only from the documented values
CREATE OR REPLACE FUNCTION private.check_escalation_conditions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF jsonb_typeof(NEW.escalation_conditions) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'escalation_conditions must be an array';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(NEW.escalation_conditions) c
    WHERE c NOT IN ('caller_requests_human','identity_unverified','ambiguous_request','payment_issue','repeated_failure','emergency_language')
  ) THEN
    RAISE EXCEPTION 'escalation_conditions contains an unsupported value';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER ai_assistant_settings_check_escalations BEFORE INSERT OR UPDATE ON public.ai_assistant_settings FOR EACH ROW EXECUTE FUNCTION private.check_escalation_conditions();

-- ============ ai_allowed_services ============
CREATE TABLE public.ai_allowed_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  ai_settings_id uuid NOT NULL,
  service_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, ai_settings_id, service_id),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, ai_settings_id) REFERENCES public.ai_assistant_settings (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, service_id) REFERENCES public.services (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.ai_allowed_services TO authenticated;
GRANT ALL ON public.ai_allowed_services TO service_role;
ALTER TABLE public.ai_allowed_services ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER ai_allowed_services_set_updated_at BEFORE UPDATE ON public.ai_allowed_services FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ ai_knowledge_items ============
CREATE TABLE public.ai_knowledge_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  ai_settings_id uuid NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, ai_settings_id) REFERENCES public.ai_assistant_settings (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.ai_knowledge_items TO authenticated;
GRANT ALL ON public.ai_knowledge_items TO service_role;
ALTER TABLE public.ai_knowledge_items ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER ai_knowledge_items_set_updated_at BEFORE UPDATE ON public.ai_knowledge_items FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();