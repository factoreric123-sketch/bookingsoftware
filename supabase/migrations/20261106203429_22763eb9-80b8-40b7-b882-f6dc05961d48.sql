-- ============ subscription_plans ============
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  monthly_price_minor bigint CHECK (monthly_price_minor IS NULL OR monthly_price_minor >= 0),
  annual_price_minor bigint CHECK (annual_price_minor IS NULL OR annual_price_minor >= 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  trial_days integer NOT NULL DEFAULT 14 CHECK (trial_days >= 0),
  stripe_monthly_price_id text,
  stripe_annual_price_id text,
  published boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (code)
);
GRANT SELECT ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER subscription_plans_set_updated_at BEFORE UPDATE ON public.subscription_plans FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

INSERT INTO public.subscription_plans (code, name, sort_order) VALUES
  ('starter', 'Starter', 1),
  ('professional', 'Professional', 2),
  ('business', 'Business', 3),
  ('enterprise', 'Enterprise', 4);

-- ============ plan_features ============
CREATE TABLE public.plan_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  feature_key text NOT NULL CHECK (feature_key IN ('businesses','locations','staff','online_booking','crm','basic_reminders','basic_analytics','advanced_analytics','custom_forms','sms','automations','payments','calendar_integrations','advanced_permissions','ai_sms','ai_phone','custom_branding','api_access')),
  enabled boolean NOT NULL DEFAULT false,
  limit_value bigint CHECK (limit_value IS NULL OR limit_value >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (plan_id, feature_key)
);
GRANT SELECT ON public.plan_features TO authenticated;
GRANT ALL ON public.plan_features TO service_role;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER plan_features_set_updated_at BEFORE UPDATE ON public.plan_features FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- Count features may have a limit (NULL = unlimited); boolean features must not
CREATE OR REPLACE FUNCTION private.check_plan_feature_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.feature_key NOT IN ('businesses','locations','staff') AND NEW.limit_value IS NOT NULL THEN
    RAISE EXCEPTION 'boolean features must have a NULL limit_value';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER plan_features_check_limit BEFORE INSERT OR UPDATE ON public.plan_features FOR EACH ROW EXECUTE FUNCTION private.check_plan_feature_limit();

-- Seed Starter allowances; every other feature on every plan starts disabled
INSERT INTO public.plan_features (plan_id, feature_key, enabled, limit_value)
SELECT p.id, f.feature_key,
  (p.code = 'starter' AND f.feature_key IN ('businesses','locations','staff','online_booking','crm','basic_reminders','basic_analytics')),
  CASE WHEN p.code = 'starter' AND f.feature_key IN ('businesses','locations','staff') THEN 1 ELSE NULL END
FROM public.subscription_plans p
CROSS JOIN (VALUES
  ('businesses'),('locations'),('staff'),('online_booking'),('crm'),('basic_reminders'),
  ('basic_analytics'),('advanced_analytics'),('custom_forms'),('sms'),('automations'),
  ('payments'),('calendar_integrations'),('advanced_permissions'),('ai_sms'),('ai_phone'),
  ('custom_branding'),('api_access')
) AS f(feature_key);

-- ============ subscriptions ============
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  billing_interval text NOT NULL DEFAULT 'monthly' CHECK (billing_interval IN ('monthly','annual')),
  status text NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing','active','past_due','unpaid','cancelled','expired')),
  stripe_customer_id text,
  stripe_subscription_id text,
  trial_starts_at timestamptz,
  trial_ends_at timestamptz,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  cancelled_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (organization_id, id)
);
CREATE UNIQUE INDEX subscriptions_current_uidx ON public.subscriptions (organization_id)
  WHERE status IN ('trialing','active','past_due','unpaid');
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER subscriptions_set_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ subscription_billing_documents ============
CREATE TABLE public.subscription_billing_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  subscription_id uuid NOT NULL,
  provider_invoice_id text NOT NULL,
  invoice_number text,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL CHECK (status IN ('draft','open','paid','void','uncollectible')),
  issued_at timestamptz NOT NULL,
  paid_at timestamptz,
  hosted_invoice_url text,
  pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (provider_invoice_id),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, subscription_id) REFERENCES public.subscriptions (organization_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.subscription_billing_documents TO authenticated;
GRANT ALL ON public.subscription_billing_documents TO service_role;
ALTER TABLE public.subscription_billing_documents ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER subscription_billing_documents_set_updated_at BEFORE UPDATE ON public.subscription_billing_documents FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ entitlement_overrides ============
CREATE TABLE public.entitlement_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  feature_key text NOT NULL CHECK (feature_key IN ('businesses','locations','staff','online_booking','crm','basic_reminders','basic_analytics','advanced_analytics','custom_forms','sms','automations','payments','calendar_integrations','advanced_permissions','ai_sms','ai_phone','custom_branding','api_access')),
  enabled boolean NOT NULL,
  limit_value bigint CHECK (limit_value IS NULL OR limit_value >= 0),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz CHECK (valid_until IS NULL OR valid_until > valid_from),
  reason text NOT NULL,
  granted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (organization_id, id)
);
GRANT SELECT ON public.entitlement_overrides TO authenticated;
GRANT ALL ON public.entitlement_overrides TO service_role;
ALTER TABLE public.entitlement_overrides ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER entitlement_overrides_set_updated_at BEFORE UPDATE ON public.entitlement_overrides FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- Reject overlapping active override periods for the same organization and feature
CREATE OR REPLACE FUNCTION private.check_override_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.entitlement_overrides eo
    WHERE eo.organization_id = NEW.organization_id
      AND eo.feature_key = NEW.feature_key
      AND eo.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND eo.valid_from < COALESCE(NEW.valid_until, TIMESTAMPTZ '9999-12-31')
      AND NEW.valid_from < COALESCE(eo.valid_until, TIMESTAMPTZ '9999-12-31')
  ) THEN
    RAISE EXCEPTION 'overlapping entitlement override periods for this organization and feature';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER entitlement_overrides_no_overlap BEFORE INSERT OR UPDATE ON public.entitlement_overrides FOR EACH ROW EXECUTE FUNCTION private.check_override_overlap();

-- ============ usage_events ============
CREATE TABLE public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  subscription_id uuid NOT NULL,
  integration_id uuid,
  metric text NOT NULL CHECK (metric IN ('sms_segments','voice_seconds','ai_tokens')),
  quantity numeric(20,6) NOT NULL CHECK (quantity >= 0),
  provider_usage_id text,
  occurred_at timestamptz NOT NULL,
  provider_cost_microunits bigint CHECK (provider_cost_microunits IS NULL OR provider_cost_microunits >= 0),
  cost_currency text CHECK (cost_currency IS NULL OR cost_currency ~ '^[A-Z]{3}$'),
  idempotency_key uuid NOT NULL,
  is_sandbox boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, idempotency_key),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, integration_id) REFERENCES public.integrations (business_id, id) ON DELETE RESTRICT,
  CHECK (provider_cost_microunits IS NULL OR cost_currency IS NOT NULL)
);
CREATE UNIQUE INDEX usage_events_provider_uidx ON public.usage_events (integration_id, provider_usage_id) WHERE provider_usage_id IS NOT NULL;
GRANT SELECT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX usage_events_metric_idx ON public.usage_events (business_id, metric, occurred_at);

-- Usage must be billed to the subscription of the business's own organization
CREATE OR REPLACE FUNCTION private.check_usage_subscription_org()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.businesses b
    JOIN public.subscriptions s ON s.organization_id = b.organization_id
    WHERE b.id = NEW.business_id AND s.id = NEW.subscription_id
  ) THEN
    RAISE EXCEPTION 'subscription must belong to the business''s organization';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER usage_events_check_subscription BEFORE INSERT OR UPDATE ON public.usage_events FOR EACH ROW EXECUTE FUNCTION private.check_usage_subscription_org();

-- ============ usage_limits ============
CREATE TABLE public.usage_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  metric text NOT NULL CHECK (metric IN ('sms_segments','voice_seconds','ai_tokens')),
  monthly_limit numeric(20,6) NOT NULL CHECK (monthly_limit >= 0),
  overage_enabled boolean NOT NULL DEFAULT false,
  monthly_spend_cap_minor bigint CHECK (monthly_spend_cap_minor IS NULL OR monthly_spend_cap_minor >= 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  warning_threshold_bps integer NOT NULL DEFAULT 8000 CHECK (warning_threshold_bps BETWEEN 0 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (organization_id, metric),
  UNIQUE (organization_id, id)
);
GRANT SELECT ON public.usage_limits TO authenticated;
GRANT ALL ON public.usage_limits TO service_role;
ALTER TABLE public.usage_limits ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER usage_limits_set_updated_at BEFORE UPDATE ON public.usage_limits FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();