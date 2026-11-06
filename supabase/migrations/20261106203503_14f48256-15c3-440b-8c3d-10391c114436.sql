-- ============ notifications ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('booking','payment','message','call','integration','task','system')),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, id)
);
GRANT SELECT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER notifications_set_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE INDEX notifications_recipient_unread_idx ON public.notifications (recipient_user_id, created_at DESC) WHERE read_at IS NULL;

-- ============ private.webhook_events ============
CREATE TABLE private.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('stripe','twilio','resend','google','outlook','voice')),
  provider_account_scope text NOT NULL,
  external_event_id text NOT NULL,
  business_id uuid REFERENCES public.businesses(id) ON DELETE RESTRICT,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  signature_verified_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','processing','processed','failed','ignored')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (provider, provider_account_scope, external_event_id)
);
GRANT ALL ON private.webhook_events TO service_role;
ALTER TABLE private.webhook_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER webhook_events_set_updated_at BEFORE UPDATE ON private.webhook_events FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE INDEX webhook_events_status_idx ON private.webhook_events (status, next_attempt_at);

-- ============ private.idempotency_records ============
CREATE TABLE private.idempotency_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE RESTRICT,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  scope text NOT NULL,
  subject_hash text NOT NULL,
  request_key uuid NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('processing','completed','failed')),
  response_status integer,
  response_body jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (scope, subject_hash, request_key)
);
GRANT ALL ON private.idempotency_records TO service_role;
ALTER TABLE private.idempotency_records ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER idempotency_records_set_updated_at BEFORE UPDATE ON private.idempotency_records FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ private.background_jobs ============
CREATE TABLE private.background_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE RESTRICT,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  job_type text NOT NULL CHECK (job_type IN ('expire_holds','automation_step','calendar_pull','calendar_push','provider_delivery','retention_cleanup','privacy_export','privacy_delete','recurrence_materialize')),
  payload jsonb NOT NULL DEFAULT '{}',
  deduplication_key text NOT NULL,
  run_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','retrying','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  maximum_attempts integer NOT NULL DEFAULT 5 CHECK (maximum_attempts >= 1),
  locked_at timestamptz,
  locked_by text,
  lock_expires_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (deduplication_key)
);
GRANT ALL ON private.background_jobs TO service_role;
ALTER TABLE private.background_jobs ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER background_jobs_set_updated_at BEFORE UPDATE ON private.background_jobs FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE INDEX background_jobs_status_run_idx ON private.background_jobs (status, run_at);

-- ============ private.rate_limit_buckets ============
CREATE TABLE private.rate_limit_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  subject_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  window_seconds integer NOT NULL CHECK (window_seconds > 0),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (scope, subject_hash, window_start)
);
GRANT ALL ON private.rate_limit_buckets TO service_role;
ALTER TABLE private.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER rate_limit_buckets_set_updated_at BEFORE UPDATE ON private.rate_limit_buckets FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ private.audit_logs (append-only) ============
CREATE TABLE private.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  business_id uuid REFERENCES public.businesses(id) ON DELETE RESTRICT,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('user','customer_token','system','provider','platform_admin')),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  request_id uuid NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON private.audit_logs TO service_role;
ALTER TABLE private.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX audit_logs_business_idx ON private.audit_logs (business_id, created_at DESC);
CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON private.audit_logs FOR EACH ROW EXECUTE FUNCTION private.protect_append_only();

-- ============ privacy_requests ============
CREATE TABLE public.privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('export','delete')),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','identity_verified','processing','completed','rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  completed_at timestamptz,
  export_asset_id uuid,
  requested_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, customer_id) REFERENCES public.customers (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, export_asset_id) REFERENCES public.storage_assets (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.privacy_requests TO authenticated;
GRANT ALL ON public.privacy_requests TO service_role;
ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER privacy_requests_set_updated_at BEFORE UPDATE ON public.privacy_requests FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ private.system_errors ============
CREATE TABLE private.system_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE RESTRICT,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  component text NOT NULL,
  error_code text NOT NULL,
  message text NOT NULL,
  stack text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON private.system_errors TO service_role;
ALTER TABLE private.system_errors ENABLE ROW LEVEL SECURITY;
CREATE INDEX system_errors_component_idx ON private.system_errors (component, created_at DESC);

-- Only resolved_at may ever change, and only by the service role
CREATE OR REPLACE FUNCTION private.protect_system_errors()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'system_errors is append-only';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.business_id IS DISTINCT FROM OLD.business_id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.request_id IS DISTINCT FROM OLD.request_id
     OR NEW.component IS DISTINCT FROM OLD.component
     OR NEW.error_code IS DISTINCT FROM OLD.error_code
     OR NEW.message IS DISTINCT FROM OLD.message
     OR NEW.stack IS DISTINCT FROM OLD.stack
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'only resolved_at may be updated on system_errors';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER system_errors_protect BEFORE UPDATE OR DELETE ON private.system_errors FOR EACH ROW EXECUTE FUNCTION private.protect_system_errors();