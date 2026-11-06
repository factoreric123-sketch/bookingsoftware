-- ============ private.domain_events ============
CREATE TABLE private.domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}',
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, idempotency_key),
  UNIQUE (business_id, id)
);
GRANT ALL ON private.domain_events TO service_role;
ALTER TABLE private.domain_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX domain_events_type_idx ON private.domain_events (business_id, event_type, occurred_at);

-- ============ automation_workflows ============
CREATE TABLE public.automation_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  name text NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('booking_created','booking_cancelled','booking_rescheduled','appointment_approaching','appointment_completed','appointment_no_show','customer_created','form_submitted','lead_created','call_missed','payment_failed')),
  conditions jsonb NOT NULL DEFAULT '[]',
  active boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, id)
);
GRANT SELECT ON public.automation_workflows TO authenticated;
GRANT ALL ON public.automation_workflows TO service_role;
ALTER TABLE public.automation_workflows ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER automation_workflows_set_updated_at BEFORE UPDATE ON public.automation_workflows FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- conditions: array of {field, operator, value} with documented values
CREATE OR REPLACE FUNCTION private.check_workflow_conditions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF jsonb_typeof(NEW.conditions) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'conditions must be an array';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.conditions) c
    WHERE jsonb_typeof(c) <> 'object'
       OR c->>'field' NOT IN ('service_id','location_id','staff_id','customer_tag_id','appointment_source')
       OR c->>'operator' NOT IN ('equals','not_equals','contains')
       OR jsonb_typeof(c->'value') IS DISTINCT FROM 'string'
  ) THEN
    RAISE EXCEPTION 'conditions must be objects with field, operator, and string value from the documented sets';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER automation_workflows_check_conditions BEFORE INSERT OR UPDATE ON public.automation_workflows FOR EACH ROW EXECUTE FUNCTION private.check_workflow_conditions();

-- ============ tasks ============
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  customer_id uuid,
  appointment_id uuid,
  assigned_staff_id uuid,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  due_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','cancelled')),
  source text NOT NULL CHECK (source IN ('manual','automation','ai_phone','ai_sms')),
  completed_at timestamptz,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, customer_id) REFERENCES public.customers (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, appointment_id) REFERENCES public.appointments (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, assigned_staff_id) REFERENCES public.staff_profiles (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tasks_set_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ automation_steps ============
CREATE TABLE public.automation_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  workflow_id uuid NOT NULL,
  step_order integer NOT NULL,
  delay_minutes integer NOT NULL DEFAULT 0 CHECK (delay_minutes >= 0),
  action_type text NOT NULL CHECK (action_type IN ('send_email','send_sms','create_task','add_customer_tag','notify_owner','notify_staff','send_review_request','send_payment_reminder','send_intake_form')),
  template_id uuid,
  tag_id uuid,
  form_id uuid,
  assigned_staff_id uuid,
  task_title text,
  task_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, workflow_id, step_order),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, workflow_id) REFERENCES public.automation_workflows (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, template_id) REFERENCES public.message_templates (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, tag_id) REFERENCES public.customer_tags (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, form_id) REFERENCES public.forms (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, assigned_staff_id) REFERENCES public.staff_profiles (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.automation_steps TO authenticated;
GRANT ALL ON public.automation_steps TO service_role;
ALTER TABLE public.automation_steps ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER automation_steps_set_updated_at BEFORE UPDATE ON public.automation_steps FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- Action-specific required columns
CREATE OR REPLACE FUNCTION private.check_automation_step_requirements()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.action_type IN ('send_email','send_sms','send_review_request','send_payment_reminder') AND NEW.template_id IS NULL THEN
    RAISE EXCEPTION '% requires a message template', NEW.action_type;
  END IF;
  IF NEW.action_type = 'add_customer_tag' AND NEW.tag_id IS NULL THEN
    RAISE EXCEPTION 'add_customer_tag requires a tag';
  END IF;
  IF NEW.action_type = 'send_intake_form' AND NEW.form_id IS NULL THEN
    RAISE EXCEPTION 'send_intake_form requires a form';
  END IF;
  IF NEW.action_type = 'create_task' AND NEW.task_title IS NULL THEN
    RAISE EXCEPTION 'create_task requires a task title';
  END IF;
  IF NEW.action_type = 'notify_staff' AND NEW.assigned_staff_id IS NULL THEN
    RAISE EXCEPTION 'notify_staff requires an assigned staff member';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER automation_steps_check_requirements BEFORE INSERT OR UPDATE ON public.automation_steps FOR EACH ROW EXECUTE FUNCTION private.check_automation_step_requirements();

-- ============ automation_runs ============
CREATE TABLE public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  workflow_id uuid NOT NULL,
  event_id uuid NOT NULL,
  workflow_version integer NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','cancelled','suppressed')),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, workflow_id, event_id),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, workflow_id) REFERENCES public.automation_workflows (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, event_id) REFERENCES private.domain_events (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.automation_runs TO authenticated;
GRANT ALL ON public.automation_runs TO service_role;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER automation_runs_set_updated_at BEFORE UPDATE ON public.automation_runs FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

-- ============ automation_step_runs ============
CREATE TABLE public.automation_step_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  automation_run_id uuid NOT NULL,
  step_order integer NOT NULL,
  step_snapshot jsonb NOT NULL,
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','retrying','failed','suppressed')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz,
  completed_at timestamptz,
  message_id uuid,
  task_id uuid,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  UNIQUE (business_id, automation_run_id, step_order),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, automation_run_id) REFERENCES public.automation_runs (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, message_id) REFERENCES public.messages (business_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (business_id, task_id) REFERENCES public.tasks (business_id, id) ON DELETE RESTRICT
);
GRANT SELECT ON public.automation_step_runs TO authenticated;
GRANT ALL ON public.automation_step_runs TO service_role;
ALTER TABLE public.automation_step_runs ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER automation_step_runs_set_updated_at BEFORE UPDATE ON public.automation_step_runs FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();
CREATE INDEX automation_step_runs_due_idx ON public.automation_step_runs (status, due_at) WHERE status IN ('queued','retrying');