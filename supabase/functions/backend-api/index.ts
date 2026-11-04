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

    for (const item of hours) {
      const weekday = Number(item.iso_weekday);
      if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) continue;
      const { error: hoursError } = await admin.from("business_hours").update({
        opens_at: String(item.opens_at ?? "09:00"),
        closes_at: String(item.closes_at ?? "17:00"),
        active: Boolean(item.active),
      }).eq("business_id", businessId).eq("location_id", locationId).eq("iso_weekday", weekday);
      if (hoursError) return json({ error: hoursError.message, code: hoursError.code }, 400);
    }

    if (typeof service.name === "string" && service.name.trim()) {
      const { data: existing } = await admin.from("services").select("id").eq("business_id", businessId).eq("name", service.name.trim()).is("archived_at", null).maybeSingle();
      if (!existing) {
        const { error: serviceError } = await admin.from("services").insert({
          business_id: businessId,
          name: service.name.trim(),
          description: typeof service.description === "string" ? service.description : "",
          duration_minutes: Number(service.duration_minutes),
          price_minor: Number(service.price_minor),
          currency: String(service.currency ?? "USD"),
          color: String(service.color ?? "#6d5dfc"),
        });
        if (serviceError) return json({ error: serviceError.message, code: serviceError.code }, 400);
      }
    }
    return json({ data: { business_id: businessId, location_id: locationId } });
  }

  const { data, error } = await admin.rpc(action as never, params as never);
  if (error) {
    console.error("backend operation failed", { action, code: error.code });
    const status = error.code === "23505" || error.code === "23P01" ? 409 : 400;
    return json({ error: error.message, code: error.code }, status);
  }

  return json({ data });
});
