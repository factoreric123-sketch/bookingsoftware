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
]);

const authenticatedActions = new Set([
  "provision_business",
  "create_blocked_time",
  "release_blocked_time",
  "merge_customers",
  "create_invoice",
  "record_manual_payment",
  "accept_member_invitation",
  "get_business_analytics",
  "complete_onboarding",
  "get_workspace_snapshot",
  "mutate_workspace",
]);

const actorActions = new Set([
  "provision_business",
  "create_blocked_time",
  "release_blocked_time",
  "merge_customers",
  "create_invoice",
  "record_manual_payment",
  "accept_member_invitation",
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
    let membershipQuery = admin.from("business_members").select("business_id,role,all_locations,can_manage_services,can_manage_staff,can_manage_customers,can_manage_forms,can_manage_automations,can_manage_integrations,can_manage_billing,can_view_analytics").eq("user_id", userId!).eq("active", true);
    if (requestedBusinessId) membershipQuery = membershipQuery.eq("business_id", requestedBusinessId);
    const { data: memberships, error: membershipError } = await membershipQuery.order("created_at").limit(1);
    if (membershipError) return json({ error: membershipError.message, code: membershipError.code }, 400);
    const membership = memberships?.[0];
    if (!membership) return json({ error: "No active business membership", code: "NO_BUSINESS" }, 404);
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
      admin.from("booking_sessions").select("*,appointments(*)").eq("business_id", businessId).order("starts_at", { ascending: false }).limit(500),
      admin.from("blocked_times").select("*").eq("business_id", businessId).is("released_at", null).order("starts_at"),
      admin.from("integrations").select("*").eq("business_id", businessId).order("provider"),
      admin.from("forms").select("*").eq("business_id", businessId).is("archived_at", null).order("created_at", { ascending: false }),
      admin.from("form_submissions").select("*").eq("business_id", businessId).order("submitted_at", { ascending: false }).limit(500),
      admin.from("automation_workflows").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
      admin.from("invoices").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(500),
      admin.from("ai_assistant_settings").select("*").eq("business_id", businessId).maybeSingle(),
      admin.from("calls").select("*").eq("business_id", businessId).order("started_at", { ascending: false }).limit(100),
    ]);
    const firstError = results.find((result) => result.error)?.error;
    if (firstError) return json({ error: firstError.message, code: firstError.code }, 400);
    const [business, settings, locations, businessHours, services, staff, staffServices, customers, sessions, blockedTimes, integrations, forms, formSubmissions, workflows, invoices, aiSettings, calls] = results.map((result) => result.data);
    return json({ data: { membership, business, settings, locations, business_hours: businessHours, services, staff, staff_services: staffServices, customers, sessions, blocked_times: blockedTimes, integrations, forms, form_submissions: formSubmissions, workflows, invoices, ai_settings: aiSettings, calls } });
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
      customer: { table: "customers", permission: "can_manage_customers", columns: ["full_name","email","phone_e164","company_name","address","source","status","active","archived_at"] },
      workflow: { table: "automation_workflows", permission: "can_manage_automations", columns: ["name","trigger_type","conditions","active"] },
      ai_settings: { table: "ai_assistant_settings", permission: "owner", columns: ["assistant_name","greeting","voice","language","transfer_phone_e164","after_hours_behavior","disclosure_enabled","disclosure_text","recording_enabled","recording_consent_required","recording_retention_days","escalation_rules","voice_enabled","sms_enabled","sandbox_enabled"] },
    };
    const rule = rules[entity];
    if (!rule || !["insert","update"].includes(operation)) return json({ error: "Unsupported workspace mutation" }, 400);
    const { data: member } = await admin.from("business_members").select("*").eq("business_id", businessId).eq("user_id", userId!).eq("active", true).maybeSingle();
    const permitted = member && (member.role === "owner" || (rule.permission !== "owner" && (member.role === "manager" || member[rule.permission] === true)));
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
      return json({ data });
    }
    if (!id && entity !== "ai_settings") return json({ error: "Record id is required" }, 400);
    let updateQuery = admin.from(rule.table).update(values).eq("business_id", businessId);
    if (id) updateQuery = updateQuery.eq("id", id);
    const { data, error } = await updateQuery.select().single();
    if (error) return json({ error: error.message, code: error.code }, 400);
    return json({ data });
  }

  const { data, error } = await admin.rpc(action as never, params as never);
  if (error) {
    console.error("backend operation failed", { action, code: error.code });
    const status = error.code === "23505" || error.code === "23P01" ? 409 : 400;
    return json({ error: error.message, code: error.code }, status);
  }

  return json({ data });
});
