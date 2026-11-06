-- ============ stripe_connect_accounts ============
CREATE TABLE public.stripe_connect_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  stripe_account_id text,
  onboarding_status text NOT NULL DEFAULT 'not_started' CHECK (onboarding_status IN ('not_started','pending','complete','restricted')),
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  details_submitted boolean NOT NULL DEFAULT false,
  last_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id),
  UNIQUE (business_id, id)
);
GRANT SELECT ON public.stripe_connect_accounts TO authenticated;
GRANT ALL ON public.stripe_connect_accounts TO service_role;
ALTER TABLE public.stripe_connect_accounts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER stripe_connect_accounts_set_updated_at BEFORE UPDATE ON public.stripe_connect_accounts FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ invoices ============
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL,
  appointment_id uuid,
  invoice_number text NOT NULL,
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','paid','void','uncollectible')),
  issued_at timestamptz,
  due_date date,
  subtotal_minor bigint NOT NULL DEFAULT 0 CHECK (subtotal_minor >= 0),
  discount_minor bigint NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  tax_minor bigint NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  total_minor bigint NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
  paid_minor bigint NOT NULL DEFAULT 0 CHECK (paid_minor >= 0),
  voided_at timestamptz,
  notes text NOT NULL DEFAULT '',
  provider_invoice_id text,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, invoice_number),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, customer_id) REFERENCES public.customers (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, appointment_id) REFERENCES public.appointments (business_id, id) ON DELETE RESTRICT,
  CHECK (total_minor = subtotal_minor - discount_minor + tax_minor),
  CHECK (discount_minor <= subtotal_minor),
  CHECK (paid_minor <= total_minor)
);
GRANT SELECT ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER invoices_set_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE INDEX invoices_customer_idx ON public.invoices (business_id, customer_id, created_at DESC);
CREATE INDEX invoices_status_due_idx ON public.invoices (business_id, status, due_date);

-- ============ invoice_items ============
CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  invoice_id uuid NOT NULL,
  service_id uuid,
  description text NOT NULL,
  quantity numeric(12,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_minor bigint NOT NULL CHECK (unit_price_minor >= 0),
  discount_minor bigint NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  tax_rate_bps integer NOT NULL DEFAULT 0 CHECK (tax_rate_bps BETWEEN 0 AND 10000),
  line_total_minor bigint NOT NULL CHECK (line_total_minor >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, invoice_id) REFERENCES public.invoices (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, service_id) REFERENCES public.services (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.invoice_items TO authenticated;
GRANT ALL ON public.invoice_items TO service_role;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER invoice_items_set_updated_at BEFORE UPDATE ON public.invoice_items FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE INDEX invoice_items_invoice_idx ON public.invoice_items (business_id, invoice_id, sort_order);

-- ============ payments ============
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL,
  appointment_id uuid,
  integration_id uuid,
  stripe_connect_account_id uuid,
  provider text NOT NULL CHECK (provider IN ('manual','stripe')),
  provider_payment_id text,
  provider_charge_id text,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  refunded_minor bigint NOT NULL DEFAULT 0 CHECK (refunded_minor >= 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  method text NOT NULL CHECK (method IN ('cash','bank_transfer','external_terminal','card','other')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','requires_action','processing','succeeded','failed','cancelled')),
  paid_at timestamptz,
  recorded_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  idempotency_key uuid NOT NULL,
  is_sandbox boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, idempotency_key),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, customer_id) REFERENCES public.customers (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, appointment_id) REFERENCES public.appointments (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, integration_id) REFERENCES public.integrations (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, stripe_connect_account_id) REFERENCES public.stripe_connect_accounts (business_id, id) ON DELETE RESTRICT,
  CHECK (refunded_minor <= amount_minor),
  CHECK (status <> 'succeeded' OR paid_at IS NOT NULL)
);
CREATE UNIQUE INDEX payments_provider_uidx ON public.payments (stripe_connect_account_id, provider_payment_id) WHERE provider_payment_id IS NOT NULL;
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER payments_set_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE INDEX payments_status_paid_idx ON public.payments (business_id, status, paid_at);

-- ============ payment_allocations ============
CREATE TABLE public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  payment_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, payment_id, invoice_id),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, payment_id) REFERENCES public.payments (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, invoice_id) REFERENCES public.invoices (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.payment_allocations TO authenticated;
GRANT ALL ON public.payment_allocations TO service_role;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

-- Allocations cannot exceed the successful payment amount, the invoice balance, or cross currencies
CREATE OR REPLACE FUNCTION private.check_payment_allocation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  p public.payments%ROWTYPE;
  i public.invoices%ROWTYPE;
  allocated bigint;
  invoice_allocated bigint;
BEGIN
  SELECT * INTO p FROM public.payments WHERE id = NEW.payment_id AND business_id = NEW.business_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment not found in this business'; END IF;
  SELECT * INTO i FROM public.invoices WHERE id = NEW.invoice_id AND business_id = NEW.business_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invoice not found in this business'; END IF;
  IF p.currency <> i.currency THEN
    RAISE EXCEPTION 'payment and invoice currencies must match';
  END IF;
  IF p.status <> 'succeeded' THEN
    RAISE EXCEPTION 'allocations require a successful payment';
  END IF;
  SELECT COALESCE(sum(a.amount_minor), 0) INTO allocated
  FROM public.payment_allocations a
  WHERE a.payment_id = NEW.payment_id AND a.business_id = NEW.business_id
    AND a.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  IF allocated + NEW.amount_minor > p.amount_minor - p.refunded_minor THEN
    RAISE EXCEPTION 'total allocations cannot exceed the successful payment amount';
  END IF;
  SELECT COALESCE(sum(a.amount_minor), 0) INTO invoice_allocated
  FROM public.payment_allocations a
  WHERE a.invoice_id = NEW.invoice_id AND a.business_id = NEW.business_id
    AND a.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  IF invoice_allocated + NEW.amount_minor > i.total_minor THEN
    RAISE EXCEPTION 'invoice allocations cannot exceed the invoice balance';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER payment_allocations_check BEFORE INSERT OR UPDATE ON public.payment_allocations FOR EACH ROW EXECUTE FUNCTION private.check_payment_allocation();

-- ============ refunds ============
CREATE TABLE public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  payment_id uuid NOT NULL,
  provider_refund_id text,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed')),
  requested_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, idempotency_key),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, payment_id) REFERENCES public.payments (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.refunds TO authenticated;
GRANT ALL ON public.refunds TO service_role;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER refunds_set_updated_at BEFORE UPDATE ON public.refunds FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- Successful refunds cannot exceed the remaining refundable amount
CREATE OR REPLACE FUNCTION private.check_refund_capacity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  p public.payments%ROWTYPE;
  refunded bigint;
BEGIN
  IF NEW.status <> 'succeeded' THEN
    RETURN NEW;
  END IF;
  SELECT * INTO p FROM public.payments WHERE id = NEW.payment_id AND business_id = NEW.business_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment not found in this business'; END IF;
  SELECT COALESCE(sum(r.amount_minor), 0) INTO refunded
  FROM public.refunds r
  WHERE r.payment_id = NEW.payment_id AND r.business_id = NEW.business_id
    AND r.status = 'succeeded'
    AND r.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  IF refunded + NEW.amount_minor > p.amount_minor THEN
    RAISE EXCEPTION 'successful refunds cannot exceed the remaining refundable amount';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER refunds_check_capacity BEFORE INSERT OR UPDATE ON public.refunds FOR EACH ROW EXECUTE FUNCTION private.check_refund_capacity();

-- ============ coupons ============
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  code text NOT NULL CHECK (code = upper(code)),
  discount_type text NOT NULL CHECK (discount_type IN ('fixed','percentage')),
  value bigint NOT NULL CHECK (value >= 0),
  currency text CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  valid_from timestamptz,
  valid_until timestamptz,
  maximum_redemptions integer CHECK (maximum_redemptions IS NULL OR maximum_redemptions >= 1),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, code),
  UNIQUE (business_id, id),
  CHECK (discount_type <> 'percentage' OR (currency IS NULL AND value BETWEEN 0 AND 10000)),
  CHECK (discount_type <> 'fixed' OR currency IS NOT NULL),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until > valid_from)
);
GRANT SELECT ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER coupons_set_updated_at BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ coupon_redemptions ============
CREATE TABLE public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  coupon_id uuid NOT NULL,
  appointment_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  discount_minor bigint NOT NULL CHECK (discount_minor >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, coupon_id, appointment_id),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, coupon_id) REFERENCES public.coupons (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, appointment_id) REFERENCES public.appointments (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, customer_id) REFERENCES public.customers (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.coupon_redemptions TO authenticated;
GRANT ALL ON public.coupon_redemptions TO service_role;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;