import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const publicActions = new Set([
  "get_public_booking_page",
  "get_availability",
  "create_booking_hold",
  "confirm_booking",
  "get_managed_appointment",
  "reschedule_appointment",
  "cancel_appointment",
  "submit_public_form",
  "get_public_form",
]);

const authenticatedActions = new Set([
  "provision_business",
  "create_blocked_time",
  "release_blocked_time",
  "merge_customers",
  "create_invoice",
  "record_manual_payment",
  "accept_member_invitation",
  "create_member_invitation",
  "get_business_analytics",
  "complete_onboarding",
  "get_workspace_snapshot",
  "mutate_workspace",
  "create_dashboard_booking",
  "save_form",
  "save_customer_profile",
  "save_sandbox_call",
  "set_appointment_status",
  "create_business_blocked_time",
]);

const actorActions = new Set([
  "provision_business",
  "create_blocked_time",
  "release_blocked_time",
  "merge_customers",
  "create_invoice",
  "record_manual_payment",
  "accept_member_invitation",
  "create_member_invitation",
  "get_business_analytics",
]);

const subjectActions = new Set([
  "create_booking_hold",
  "confirm_booking",
  "get_managed_appointment",
  "reschedule_appointment",
  "cancel_appointment",
  "submit_public_form",
  "accept_member_invitation",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function subjectHash(req: Request, secret: string) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const agent = req.headers.get("user-agent") ?? "unknown";
  const bytes = new TextEncoder().encode(`${secret}:${forwarded}:${agent}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function localDateTimeToIso(date: unknown, time: unknown, timeZone: string) {
  const local = `${String(date ?? "")}T${String(time ?? "")}:00`;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/.test(local)) throw new Error("A valid local date and time are required");
  const target = new Date(`${local}Z`);
  let candidate = target.getTime();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(candidate));
    const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    const rendered = Date.parse(`${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}Z`);
    candidate += target.getTime() - rendered;
  }
  const check = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(candidate));
  const value = (type: string) => check.find((part) => part.type === type)?.value ?? "";
  if (`${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}:00` !== local) throw new Error("That local time does not exist in the business timezone");
  return new Date(candidate).toISOString();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Backend configuration is unavailable" }, 503);

  let payload: { action?: string; params?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Request body must be valid JSON" }, 400);
  }

  const action = payload.action ?? "";
  if (!publicActions.has(action) && !authenticatedActions.has(action)) {
    return json({ error: "Unsupported backend operation" }, 404);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const params = { ...(payload.params ?? {}) };
  delete params.p_actor_user_id;
  delete params.p_subject_hash;

  const authorization = req.headers.get("authorization");
  let userId: string | null = null;
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice(7);
    const { data, error } = await admin.auth.getUser(token);
    if (!error && data.user) userId = data.user.id;
  }

  if (authenticatedActions.has(action) && !userId) {
    return json({ error: "Authentication required" }, 401);
  }
  if (actorActions.has(action)) params.p_actor_user_id = userId;

  if (subjectActions.has(action)) {
    params.p_subject_hash = await subjectHash(req, serviceKey);
  }
  if (publicActions.has(action)) {
    if (action === "confirm_booking" || action === "reschedule_appointment" || action === "cancel_appointment") {
      params.p_actor_user_id = userId;
    }
  }

  if (action === "get_public_form") {
    const identifier = String(params.p_identifier ?? "");
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    if (!isUuid && !/^[a-z0-9-]{1,100}$/.test(identifier)) return json({ error: "Invalid form identifier" }, 400);
    const query = admin.from("forms").select("id,business_id,name,description,slug,active_version_id,accent_color,create_customer").eq("status", "published");
    const { data: form, error: formError } = await (isUuid ? query.eq("id", identifier) : query.eq("slug", identifier)).maybeSingle();
    if (formError) return json({ error: formError.message, code: formError.code }, 400);
    if (!form || !form.active_version_id) return json({ error: "Form not found or not published", code: "P0404" }, 404);
    const [{ data: fields, error: fieldsError }, { data: business, error: businessError }] = await Promise.all([
      admin.from("form_fields").select("id,field_key,label,field_type,required,placeholder,help_text,options,validation,visibility_rule,customer_mapping,sort_order").eq("business_id", form.business_id).eq("form_version_id", form.active_version_id).order("sort_order"),
      admin.from("businesses").select("name,accent_color").eq("id", form.business_id).single(),
    ]);
    if (fieldsError || businessError) return json({ error: fieldsError?.message ?? businessError?.message ?? "Form unavailable" }, 400);
    return json({ data: { form_id: form.id, version_id: form.active_version_id, name: form.name, description: form.description, slug: form.slug, accent_color: form.accent_color, create_customer: form.create_customer, business, fields: fields ?? [] } });
  }

  if (action === "complete_onboarding") {
    const businessId = String(params.p_business_id ?? "");
    const locationId = String(params.p_location_id ?? "");
    const staffId = String(params.p_staff_id ?? "");
    const business = (params.p_business ?? {}) as Record<string, unknown>;
    const service = (params.p_service ?? {}) as Record<string, unknown>;
    const hours = Array.isArray(params.p_hours) ? params.p_hours as Array<Record<string, unknown>> : [];
    const { data: membership } = await admin.from("business_members").select("role,active").eq("business_id", businessId).eq("user_id", userId!).eq("active", true).maybeSingle();
    if (!membership || membership.role !== "owner") return json({ error: "Owner access required" }, 403);

    const { error: businessError } = await admin.from("businesses").update({
      email: typeof business.email === "string" && business.email ? business.email : null,
      phone_e164: typeof business.phone === "string" && business.phone ? business.phone : null,
      accent_color: typeof business.accent === "string" ? business.accent : "#6d5dfc",
      status: "active",
      onboarding_step: 6,
      setup_completed_at: new Date().toISOString(),
    }).eq("id", businessId);
    if (businessError) return json({ error: businessError.message, code: businessError.code }, 400);

    const { error: locationError } = await admin.from("locations").update({
      address_line1: typeof business.address === "string" ? business.address : "",
      email: typeof business.email === "string" && business.email ? business.email : null,
      phone_e164: typeof business.phone === "string" && business.phone ? business.phone : null,
    }).eq("id", locationId).eq("business_id", businessId);
    if (locationError) return json({ error: locationError.message, code: locationError.code }, 400);

    const { data: existingHours } = await admin.from("business_hours").select("id,iso_weekday").eq("business_id", businessId).eq("location_id", locationId);
    const { data: existingAvailability } = await admin.from("staff_availability").select("id,iso_weekday").eq("business_id", businessId).eq("location_id", locationId).eq("staff_id", staffId);
    for (const item of hours) {
      const weekday = Number(item.iso_weekday);
      if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) continue;
      const hourValues = {
        opens_at: String(item.opens_at ?? "09:00"),
        closes_at: String(item.closes_at ?? "17:00"),
        active: Boolean(item.active),
      };
      const hourRow = existingHours?.find((row) => row.iso_weekday === weekday);
      const hourMutation = hourRow
        ? admin.from("business_hours").update(hourValues).eq("id", hourRow.id)
        : admin.from("business_hours").insert({ business_id: businessId, location_id: locationId, iso_weekday: weekday, ...hourValues });
      const { error: hoursError } = await hourMutation;
      if (hoursError) return json({ error: hoursError.message, code: hoursError.code }, 400);

      const availabilityRow = existingAvailability?.find((row) => row.iso_weekday === weekday);
      const availabilityValues = { opens_at: hourValues.opens_at, closes_at: hourValues.closes_at, active: hourValues.active };
      const availabilityMutation = availabilityRow
        ? admin.from("staff_availability").update(availabilityValues).eq("id", availabilityRow.id)
        : admin.from("staff_availability").insert({ business_id: businessId, staff_id: staffId, location_id: locationId, iso_weekday: weekday, ...availabilityValues });
      const { error: availabilityError } = await availabilityMutation;
      if (availabilityError) return json({ error: availabilityError.message, code: availabilityError.code }, 400);
    }

    if (typeof service.name === "string" && service.name.trim()) {
      const { data: existing } = await admin.from("services").select("id").eq("business_id", businessId).eq("name", service.name.trim()).is("archived_at", null).maybeSingle();
      let serviceId = existing?.id as string | undefined;
      if (!existing) {
        const { data: createdService, error: serviceError } = await admin.from("services").insert({
          business_id: businessId,
          name: service.name.trim(),
          description: typeof service.description === "string" ? service.description : "",
          duration_minutes: Number(service.duration_minutes),
          price_minor: Number(service.price_minor),
          currency: String(service.currency ?? "USD"),
          color: String(service.color ?? "#6d5dfc"),
        }).select("id").single();
        if (serviceError) return json({ error: serviceError.message, code: serviceError.code }, 400);
        serviceId = createdService.id;
      }
      if (serviceId) {
        const { data: locationLink } = await admin.from("service_locations").select("id").eq("business_id", businessId).eq("service_id", serviceId).eq("location_id", locationId).maybeSingle();
        if (!locationLink) await admin.from("service_locations").insert({ business_id: businessId, service_id: serviceId, location_id: locationId });
        const { data: staffLink } = await admin.from("staff_services").select("id").eq("business_id", businessId).eq("service_id", serviceId).eq("staff_id", staffId).maybeSingle();
        if (!staffLink) await admin.from("staff_services").insert({ business_id: businessId, service_id: serviceId, staff_id: staffId });
      }
    }
    const { error: pageError } = await admin.from("booking_pages").update({ status: "published", published_at: new Date().toISOString() }).eq("business_id", businessId).eq("location_id", locationId);
    if (pageError) return json({ error: pageError.message, code: pageError.code }, 400);
    return json({ data: { business_id: businessId, location_id: locationId } });
  }

  if (action === "get_workspace_snapshot") {
    const requestedBusinessId = typeof params.p_business_id === "string" ? params.p_business_id : null;
    let membershipQuery = admin.from("business_members").select("business_id,role,all_locations,can_manage_services,can_manage_staff,can_manage_customers,can_manage_forms,can_manage_automations,can_manage_billing,can_view_analytics").eq("user_id", userId!).eq("active", true);
    if (requestedBusinessId) membershipQuery = membershipQuery.eq("business_id", requestedBusinessId);
    const { data: memberships, error: membershipError } = await membershipQuery.order("created_at").limit(1);
    if (membershipError) return json({ error: membershipError.message, code: membershipError.code }, 400);
    const membership = memberships?.[0];
    if (!membership) return json({ error: "No active business membership", code: "NO_BUSINESS" }, 404);
    if (membership.role === "staff" || (membership.role === "manager" && !membership.all_locations)) return json({ error: "This workspace view requires a manager with access to all locations", code: "P0403" }, 403);
    const businessId = membership.business_id;

    const results = await Promise.all([
      admin.from("businesses").select("*").eq("id", businessId).single(),
      admin.from("business_settings").select("*").eq("business_id", businessId).maybeSingle(),
      admin.from("locations").select("*").eq("business_id", businessId).is("archived_at", null).order("created_at"),
      admin.from("business_hours").select("*").eq("business_id", businessId).order("iso_weekday"),
      admin.from("services").select("*").eq("business_id", businessId).is("archived_at", null).order("sort_order"),
      admin.from("staff_profiles").select("*").eq("business_id", businessId).is("archived_at", null).order("created_at"),
      admin.from("staff_services").select("*").eq("business_id", businessId).eq("active", true),
      admin.from("customers").select("*").eq("business_id", businessId).is("archived_at", null).order("created_at", { ascending: false }).limit(500),
      admin.from("customer_notes").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(2000),
      admin.from("customer_tags").select("*").eq("business_id", businessId).order("name"),
      admin.from("customer_tag_assignments").select("*").eq("business_id", businessId).limit(5000),
      admin.from("booking_sessions").select("*,appointments(*)").eq("business_id", businessId).order("starts_at", { ascending: false }).limit(500),
      admin.from("blocked_times").select("*").eq("business_id", businessId).is("released_at", null).order("starts_at"),
      admin.from("integrations").select("*").eq("business_id", businessId).order("provider"),
      admin.from("forms").select("*").eq("business_id", businessId).is("archived_at", null).order("created_at", { ascending: false }),
      admin.from("form_fields").select("*").eq("business_id", businessId).order("sort_order"),
      admin.from("form_submissions").select("*").eq("business_id", businessId).order("submitted_at", { ascending: false }).limit(500),
      admin.from("form_submission_answers").select("*").eq("business_id", businessId).limit(5000),
      admin.from("automation_workflows").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
      admin.from("automation_steps").select("workflow_id,action_type,task_title,step_order").eq("business_id", businessId).order("step_order"),
      admin.from("invoices").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(500),
      admin.from("ai_assistant_settings").select("*").eq("business_id", businessId).maybeSingle(),
      admin.from("calls").select("*").eq("business_id", businessId).order("started_at", { ascending: false }).limit(100),
    ]);
    const firstError = results.find((result) => result.error)?.error;
    if (firstError) return json({ error: firstError.message, code: firstError.code }, 400);
    const [business, settings, locations, businessHours, services, staff, staffServices, customers, customerNotes, customerTags, customerTagAssignments, sessions, blockedTimes, integrations, forms, formFields, formSubmissions, formSubmissionAnswers, workflows, workflowSteps, invoices, aiSettings, calls] = results.map((result) => result.data);
    const owner = membership.role === "owner";
    const canCustomers = owner || membership.can_manage_customers;
    const canForms = owner || membership.can_manage_forms;
    return json({ data: { membership, business, settings, locations, business_hours: businessHours, services, staff, staff_services: staffServices, customers: canCustomers ? customers : [], customer_notes: canCustomers ? customerNotes : [], customer_tags: canCustomers ? customerTags : [], customer_tag_assignments: canCustomers ? customerTagAssignments : [], sessions: canCustomers ? sessions : [], blocked_times: blockedTimes, integrations: owner ? integrations : [], forms: canForms ? forms : [], form_fields: canForms ? formFields : [], form_submissions: canForms ? formSubmissions : [], form_submission_answers: canForms ? formSubmissionAnswers : [], workflows: owner || membership.can_manage_automations ? workflows : [], workflow_steps: owner || membership.can_manage_automations ? workflowSteps : [], invoices: owner || membership.can_manage_billing ? invoices : [], ai_settings: owner ? aiSettings : null, calls: owner ? calls : [] } });
  }

  if (action === "mutate_workspace") {
    const businessId = String(params.p_business_id ?? "");
    const entity = String(params.p_entity ?? "");
    const operation = String(params.p_operation ?? "");
    const id = typeof params.p_id === "string" ? params.p_id : null;
    const incoming = (params.p_values ?? {}) as Record<string, unknown>;
    const rules: Record<string, { table: string; permission: string; columns: string[] }> = {
      business: { table: "businesses", permission: "owner", columns: ["name","slug","industry","description","email","phone_e164","website_url","timezone","currency","accent_color"] },
      service: { table: "services", permission: "can_manage_services", columns: ["name","description","duration_minutes","price_minor","currency","buffer_before_minutes","buffer_after_minutes","appointment_type","capacity","delivery_mode","payment_requirement","deposit_type","deposit_value","color","active","sort_order","archived_at"] },
      staff_profile: { table: "staff_profiles", permission: "can_manage_staff", columns: ["display_name","email","phone_e164","bio","color","active","bookable","weekly_capacity_minutes"] },
      customer: { table: "customers", permission: "can_manage_customers", columns: ["full_name","email","phone_e164","company_name","address","source","status","active","archived_at"] },
      workflow: { table: "automation_workflows", permission: "can_manage_automations", columns: ["name","trigger_type","conditions","active"] },
      ai_settings: { table: "ai_assistant_settings", permission: "owner", columns: ["assistant_name","greeting","voice","language","transfer_phone_e164","after_hours_behavior","disclosure_enabled","disclosure_text","recording_enabled","recording_consent_required","recording_retention_days","escalation_rules","voice_enabled","sms_enabled","sandbox_enabled"] },
    };
    const rule = rules[entity];
    if (!rule || !["insert","update"].includes(operation)) return json({ error: "Unsupported workspace mutation" }, 400);
    const { data: member } = await admin.from("business_members").select("*").eq("business_id", businessId).eq("user_id", userId!).eq("active", true).maybeSingle();
    const permitted = member && (member.role === "owner" || (member.role === "manager" && rule.permission !== "owner" && member[rule.permission] === true));
    if (!permitted) return json({ error: "Permission denied" }, 403);
    const values = Object.fromEntries(Object.entries(incoming).filter(([key]) => rule.columns.includes(key)));
    if (!Object.keys(values).length) return json({ error: "No supported values supplied" }, 400);
    if (entity === "ai_settings") {
      const { data: existingSettings } = await admin.from(rule.table).select("id").eq("business_id", businessId).maybeSingle();
      const settingsMutation = existingSettings
        ? admin.from(rule.table).update(values).eq("business_id", businessId).eq("id", existingSettings.id)
        : admin.from(rule.table).insert({ ...values, business_id: businessId });
      const { data, error } = await settingsMutation.select().single();
      if (error) return json({ error: error.message, code: error.code }, 400);
      return json({ data });
    }
    if (operation === "insert") {
      const { data, error } = await admin.from(rule.table).insert({ ...values, business_id: businessId, ...(id ? { id } : {}) }).select().single();
      if (error) return json({ error: error.message, code: error.code }, 400);
      if (entity === "staff_profile") {
        const locationId = typeof incoming.location_id === "string" ? incoming.location_id : null;
        const serviceIds = Array.isArray(incoming.service_ids) ? incoming.service_ids.filter((value): value is string => typeof value === "string") : [];
        if (locationId) {
          const { error: linkError } = await admin.from("staff_locations").insert({ business_id: businessId, staff_id: data.id, location_id: locationId });
          if (linkError) {
            await admin.from("staff_profiles").delete().eq("business_id", businessId).eq("id", data.id);
            return json({ error: linkError.message, code: linkError.code }, 400);
          }
        }
        if (serviceIds.length) {
          const { error: serviceError } = await admin.from("staff_services").insert(serviceIds.map((serviceId) => ({ business_id: businessId, staff_id: data.id, service_id: serviceId })));
          if (serviceError) {
            await admin.from("staff_locations").delete().eq("business_id", businessId).eq("staff_id", data.id);
            await admin.from("staff_profiles").delete().eq("business_id", businessId).eq("id", data.id);
            return json({ error: serviceError.message, code: serviceError.code }, 400);
          }
        }
      }
      if (entity === "service") {
        const locationId = typeof incoming.location_id === "string" ? incoming.location_id : null;
        const staffIds = Array.isArray(incoming.staff_ids) ? incoming.staff_ids.filter((value): value is string => typeof value === "string") : [];
        if (!locationId) {
          await admin.from("services").delete().eq("business_id", businessId).eq("id", data.id);
          return json({ error: "A location is required for a new service" }, 400);
        }
        const { error: locationLinkError } = await admin.from("service_locations").insert({ business_id: businessId, service_id: data.id, location_id: locationId });
        if (locationLinkError) {
          await admin.from("services").delete().eq("business_id", businessId).eq("id", data.id);
          return json({ error: locationLinkError.message, code: locationLinkError.code }, 400);
        }
        if (staffIds.length) {
          const { error: staffLinkError } = await admin.from("staff_services").insert(staffIds.map((staffId) => ({ business_id: businessId, staff_id: staffId, service_id: data.id })));
          if (staffLinkError) {
            await admin.from("service_locations").delete().eq("business_id", businessId).eq("service_id", data.id);
            await admin.from("services").delete().eq("business_id", businessId).eq("id", data.id);
            return json({ error: staffLinkError.message, code: staffLinkError.code }, 400);
          }
        }
      }
      if (entity === "workflow") {
        const actionType = incoming.action_type;
        if (actionType !== "create_task") {
          await admin.from("automation_workflows").delete().eq("business_id", businessId).eq("id", data.id);
          return json({ error: "Only create-task workflow drafts are available before the job runner is connected" }, 400);
        }
        const { error: stepError } = await admin.from("automation_steps").insert({ business_id: businessId, workflow_id: data.id, step_order: 1, action_type: "create_task", task_title: String(incoming.task_title ?? `Follow up: ${values.name ?? "Booking"}`) });
        if (stepError) {
          await admin.from("automation_workflows").delete().eq("business_id", businessId).eq("id", data.id);
          return json({ error: stepError.message, code: stepError.code }, 400);
        }
      }
      return json({ data });
    }
    if (!id && entity !== "ai_settings") return json({ error: "Record id is required" }, 400);
    let updateQuery = admin.from(rule.table).update(values).eq("business_id", businessId);
    if (id) updateQuery = updateQuery.eq("id", id);
    const { data, error } = await updateQuery.select().single();
    if (error) return json({ error: error.message, code: error.code }, 400);
    return json({ data });
  }

  if (action === "create_dashboard_booking") {
    const businessId = String(params.p_business_id ?? "");
    const { data: member } = await admin.from("business_members").select("role,can_manage_customers").eq("business_id", businessId).eq("user_id", userId!).eq("active", true).maybeSingle();
    if (!member || (member.role !== "owner" && (member.role !== "manager" || !member.can_manage_customers))) return json({ error: "Permission denied" }, 403);
    const { data: page } = await admin.from("booking_pages").select("id").eq("business_id", businessId).eq("status", "published").limit(1).maybeSingle();
    if (!page) return json({ error: "Publish a booking page before creating appointments" }, 409);
    const { data: business } = await admin.from("businesses").select("timezone").eq("id", businessId).single();
    let startsAt: string;
    try { startsAt = localDateTimeToIso(params.p_local_date, params.p_local_time, business?.timezone ?? "UTC"); }
    catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid appointment time" }, 400); }
    const requestKey = String(params.p_request_key ?? crypto.randomUUID());
    const subject = await subjectHash(req, serviceKey);
    const { data: hold, error: holdError } = await admin.rpc("create_booking_hold", {
      p_subject_hash: subject,
      p_booking_page_id: page.id,
      p_service_id: params.p_service_id,
      p_staff_id: params.p_staff_id ?? null,
      p_session_id: null,
      p_starts_at: startsAt,
      p_addon_quantities: {},
      p_seat_count: 1,
      p_request_key: requestKey,
    });
    if (holdError) return json({ error: holdError.message, code: holdError.code }, holdError.code === "P0409" ? 409 : 400);
    const { data: confirmed, error: confirmError } = await admin.rpc("confirm_booking", {
      p_subject_hash: subject,
      p_hold_token: hold.hold_token,
      p_actor_user_id: userId,
      p_customer_id: params.p_customer_id,
      p_contact: {},
      p_customer_notes: params.p_notes ?? "",
      p_consent_decisions: [],
      p_request_key: crypto.randomUUID(),
    });
    if (confirmError) return json({ error: confirmError.message, code: confirmError.code }, 400);
    return json({ data: confirmed });
  }

  if (action === "create_business_blocked_time") {
    const businessId = String(params.p_business_id ?? "");
    const { data: business } = await admin.from("businesses").select("timezone").eq("id", businessId).single();
    if (!business) return json({ error: "Business not found" }, 404);
    let startsAt: string;
    let endsAt: string;
    try {
      startsAt = localDateTimeToIso(params.p_local_date, params.p_local_start, business.timezone);
      endsAt = localDateTimeToIso(params.p_local_date, params.p_local_end, business.timezone);
    } catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid blocked time" }, 400); }
    if (Date.parse(endsAt) <= Date.parse(startsAt)) return json({ error: "End time must be after start time" }, 400);
    const { data, error } = await admin.rpc("create_blocked_time", { p_actor_user_id: userId, p_business_id: businessId, p_location_id: params.p_location_id, p_staff_id: params.p_staff_id ?? null, p_starts_at: startsAt, p_ends_at: endsAt, p_reason: params.p_reason ?? "" });
    if (error) return json({ error: error.message, code: error.code }, 400);
    return json({ data });
  }

  if (action === "set_appointment_status") {
    const businessId = String(params.p_business_id ?? "");
    const appointmentId = String(params.p_appointment_id ?? "");
    const nextStatus = String(params.p_status ?? "").replace("no-show", "no_show");
    if (!["pending","confirmed","completed","cancelled","no_show"].includes(nextStatus)) return json({ error: "Unsupported appointment status" }, 400);
    const { data: member } = await admin.from("business_members").select("role,can_manage_customers").eq("business_id", businessId).eq("user_id", userId!).eq("active", true).maybeSingle();
    if (!member || (member.role !== "owner" && (member.role !== "manager" || !member.can_manage_customers))) return json({ error: "Permission denied" }, 403);
    const { data: appointment } = await admin.from("appointments").select("status,session_id").eq("business_id", businessId).eq("id", appointmentId).single();
    if (!appointment) return json({ error: "Appointment not found" }, 404);
    if (appointment.status === nextStatus) return json({ data: { appointment_id: appointmentId, status: nextStatus } });
    if (appointment.status === "cancelled") return json({ error: "Cancelled appointments cannot be changed" }, 409);
    if (nextStatus === "cancelled") {
      const { count, error: countError } = await admin.from("appointments").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("session_id", appointment.session_id).neq("status", "cancelled");
      if (countError) return json({ error: countError.message, code: countError.code }, 400);
      if ((count ?? 0) > 1) return json({ error: "Group bookings must be cancelled through the attendee management flow" }, 409);
    }
    const values: Record<string, unknown> = { status: nextStatus };
    if (nextStatus === "cancelled") Object.assign(values, { cancelled_at: new Date().toISOString(), cancelled_by_user_id: userId, cancellation_reason: String(params.p_reason ?? "Cancelled by staff") });
    const { error: updateError } = await admin.from("appointments").update(values).eq("business_id", businessId).eq("id", appointmentId);
    if (updateError) return json({ error: updateError.message, code: updateError.code }, 400);
    if (nextStatus === "cancelled") await admin.from("resource_reservations").update({ active: false }).eq("business_id", businessId).eq("session_id", appointment.session_id);
    const { error: historyError } = await admin.from("appointment_status_history").insert({ business_id: businessId, appointment_id: appointmentId, from_status: appointment.status, to_status: nextStatus, actor_user_id: userId, actor_type: "user", reason: String(params.p_reason ?? "") });
    if (historyError) return json({ error: historyError.message, code: historyError.code }, 400);
    return json({ data: { appointment_id: appointmentId, status: nextStatus } });
  }

  if (action === "save_sandbox_call") {
    const businessId = String(params.p_business_id ?? "");
    const { data: member } = await admin.from("business_members").select("role").eq("business_id", businessId).eq("user_id", userId!).eq("active", true).maybeSingle();
    if (!member || member.role !== "owner") return json({ error: "Permission denied" }, 403);
    const now = new Date();
    const duration = Math.max(0, Math.min(7200, Number(params.p_duration_seconds ?? 0)));
    const { data, error } = await admin.from("calls").insert({ business_id: businessId, customer_id: params.p_customer_id ?? null, direction: "inbound", caller_e164: String(params.p_caller_e164 ?? "sandbox"), called_e164: "sandbox", started_at: new Date(now.getTime() - duration * 1000).toISOString(), answered_at: new Date(now.getTime() - duration * 1000).toISOString(), ended_at: now.toISOString(), duration_seconds: duration, status: "simulated", outcome: params.p_outcome ?? "information", summary: String(params.p_summary ?? ""), is_sandbox: true }).select().single();
    if (error) return json({ error: error.message, code: error.code }, 400);
    return json({ data });
  }

  if (action === "save_form") {
    const businessId = String(params.p_business_id ?? "");
    const formId = String(params.p_form_id ?? crypto.randomUUID());
    const { data: member } = await admin.from("business_members").select("role,can_manage_forms").eq("business_id", businessId).eq("user_id", userId!).eq("active", true).maybeSingle();
    if (!member || (member.role !== "owner" && (member.role !== "manager" || !member.can_manage_forms))) return json({ error: "Permission denied" }, 403);
    const { data: existing } = await admin.from("forms").select("id,active_version_id").eq("business_id", businessId).eq("id", formId).maybeSingle();
    if (existing && Array.isArray(params.p_fields)) {
      const { data: latest } = await admin.from("form_versions").select("version_number").eq("business_id", businessId).eq("form_id", formId).order("version_number", { ascending: false }).limit(1).maybeSingle();
      const versionId = crypto.randomUUID();
      const { error: versionError } = await admin.from("form_versions").insert({ id: versionId, business_id: businessId, form_id: formId, version_number: Number(latest?.version_number ?? 0) + 1, published_at: null, created_by_user_id: userId });
      if (versionError) return json({ error: versionError.message, code: versionError.code }, 400);
      const fields = params.p_fields as Array<Record<string, unknown>>;
      if (fields.length) {
        const rows = fields.map((field, index) => ({ id: crypto.randomUUID(), business_id: businessId, form_version_id: versionId, field_key: String(field.field_key ?? `field_${index + 1}`), label: String(field.label ?? "Question"), field_type: String(field.field_type ?? "text"), required: Boolean(field.required), options: Array.isArray(field.options) ? field.options : [], validation: {}, customer_mapping: field.customer_mapping ?? null, sort_order: index }));
        const { error: fieldError } = await admin.from("form_fields").insert(rows);
        if (fieldError) { await admin.from("form_versions").delete().eq("id", versionId); return json({ error: fieldError.message, code: fieldError.code }, 400); }
      }
      if (params.p_active) {
        const { error: publishError } = await admin.from("form_versions").update({ published_at: new Date().toISOString() }).eq("business_id", businessId).eq("id", versionId);
        if (publishError) return json({ error: publishError.message, code: publishError.code }, 400);
      }
      const { data, error } = await admin.from("forms").update({ name: String(params.p_name ?? "Untitled form").trim(), description: String(params.p_description ?? ""), active_version_id: versionId, status: params.p_active ? "published" : "draft" }).eq("business_id", businessId).eq("id", formId).select().single();
      if (error) return json({ error: error.message, code: error.code }, 400);
      return json({ data: { ...data, version_id: versionId } });
    }
    if (existing) {
      if (params.p_active && existing.active_version_id) {
        const { data: version } = await admin.from("form_versions").select("published_at").eq("business_id", businessId).eq("id", existing.active_version_id).single();
        if (version && !version.published_at) await admin.from("form_versions").update({ published_at: new Date().toISOString() }).eq("business_id", businessId).eq("id", existing.active_version_id);
      }
      const { data, error } = await admin.from("forms").update({ status: params.p_active ? "published" : "draft" }).eq("business_id", businessId).eq("id", formId).select().single();
      if (error) return json({ error: error.message, code: error.code }, 400);
      return json({ data });
    }
    const name = String(params.p_name ?? "Untitled form").trim();
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 70) || "form";
    const slug = `${baseSlug}-${formId.slice(0, 8)}`;
    const { error: formError } = await admin.from("forms").insert({ id: formId, business_id: businessId, name, description: String(params.p_description ?? ""), slug, status: "draft" });
    if (formError) return json({ error: formError.message, code: formError.code }, 400);
    const versionId = crypto.randomUUID();
    const { error: versionError } = await admin.from("form_versions").insert({ id: versionId, business_id: businessId, form_id: formId, version_number: 1, published_at: null, created_by_user_id: userId });
    if (versionError) return json({ error: versionError.message, code: versionError.code }, 400);
    const fields = Array.isArray(params.p_fields) ? params.p_fields as Array<Record<string, unknown>> : [];
    if (fields.length) {
      const rows = fields.map((field, index) => ({ id: typeof field.id === "string" && /^[0-9a-f-]{36}$/i.test(field.id) ? field.id : crypto.randomUUID(), business_id: businessId, form_version_id: versionId, field_key: String(field.field_key ?? `field_${index + 1}`), label: String(field.label ?? "Question"), field_type: String(field.field_type ?? "text"), required: Boolean(field.required), options: Array.isArray(field.options) ? field.options : [], validation: {}, customer_mapping: field.customer_mapping ?? null, sort_order: index }));
      const { error: fieldError } = await admin.from("form_fields").insert(rows);
      if (fieldError) { await admin.from("form_versions").delete().eq("id", versionId); await admin.from("forms").delete().eq("id", formId); return json({ error: fieldError.message, code: fieldError.code }, 400); }
    }
    if (params.p_active) {
      const { error: publishError } = await admin.from("form_versions").update({ published_at: new Date().toISOString() }).eq("business_id", businessId).eq("id", versionId);
      if (publishError) return json({ error: publishError.message, code: publishError.code }, 400);
    }
    const { data, error } = await admin.from("forms").update({ active_version_id: versionId, status: params.p_active ? "published" : "draft" }).eq("business_id", businessId).eq("id", formId).select().single();
    if (error) return json({ error: error.message, code: error.code }, 400);
    return json({ data: { ...data, version_id: versionId } });
  }

  if (action === "save_customer_profile") {
    const businessId = String(params.p_business_id ?? "");
    const customerId = String(params.p_customer_id ?? "");
    const { data: member } = await admin.from("business_members").select("role,can_manage_customers").eq("business_id", businessId).eq("user_id", userId!).eq("active", true).maybeSingle();
    if (!member || (member.role !== "owner" && (member.role !== "manager" || !member.can_manage_customers))) return json({ error: "Permission denied" }, 403);
    const note = typeof params.p_note === "string" ? params.p_note.trim() : "";
    if (note) {
      const { data: latest } = await admin.from("customer_notes").select("body").eq("business_id", businessId).eq("customer_id", customerId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (latest?.body !== note) {
        const { error: noteError } = await admin.from("customer_notes").insert({ business_id: businessId, customer_id: customerId, author_user_id: userId, body: note });
        if (noteError) return json({ error: noteError.message, code: noteError.code }, 400);
      }
    }
    const tagNames = Array.isArray(params.p_tags) ? [...new Set(params.p_tags.map((value) => String(value).trim()).filter(Boolean))].slice(0, 25) : [];
    const tagIds: string[] = [];
    for (const name of tagNames) {
      const { data: tag, error } = await admin.from("customer_tags").upsert({ business_id: businessId, name }, { onConflict: "business_id,name" }).select("id").single();
      if (error) return json({ error: error.message, code: error.code }, 400);
      tagIds.push(tag.id);
    }
    const { data: oldAssignments, error: readError } = await admin.from("customer_tag_assignments").select("id,tag_id").eq("business_id", businessId).eq("customer_id", customerId);
    if (readError) return json({ error: readError.message, code: readError.code }, 400);
    const existingTagIds = new Set((oldAssignments ?? []).map((assignment) => assignment.tag_id));
    const newTagIds = tagIds.filter((tagId) => !existingTagIds.has(tagId));
    if (newTagIds.length) {
      const { error: insertError } = await admin.from("customer_tag_assignments").insert(newTagIds.map((tagId) => ({ business_id: businessId, customer_id: customerId, tag_id: tagId })));
      if (insertError) return json({ error: insertError.message, code: insertError.code }, 400);
    }
    const removedIds = (oldAssignments ?? []).filter((assignment) => !tagIds.includes(assignment.tag_id)).map((assignment) => assignment.id);
    if (removedIds.length) {
      const { error: deleteError } = await admin.from("customer_tag_assignments").delete().eq("business_id", businessId).eq("customer_id", customerId).in("id", removedIds);
      if (deleteError) return json({ error: deleteError.message, code: deleteError.code }, 400);
    }
    return json({ data: { customer_id: customerId, tags: tagNames } });
  }

  if (action === "reschedule_appointment" && typeof params.p_local_date === "string" && typeof params.p_local_time === "string") {
    const { data: managed, error: managedError } = await admin.rpc("get_managed_appointment", {
      p_subject_hash: params.p_subject_hash,
      p_token: params.p_management_token,
    });
    if (managedError || !managed || managed.appointment_id !== params.p_appointment_id) {
      return json({ error: managedError?.message ?? "Management link does not match this appointment", code: managedError?.code ?? "P0403" }, 403);
    }
    try {
      params.p_new_starts_at = localDateTimeToIso(params.p_local_date, params.p_local_time, managed.timezone);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Invalid appointment time" }, 400);
    }
    delete params.p_local_date;
    delete params.p_local_time;
  }

  const { data, error } = await admin.rpc(action as never, params as never);
  if (error) {
    console.error("backend operation failed", { action, code: error.code });
    const status = error.code === "23505" || error.code === "23P01" ? 409 : 400;
    return json({ error: error.message, code: error.code }, status);
  }

  return json({ data });
});
