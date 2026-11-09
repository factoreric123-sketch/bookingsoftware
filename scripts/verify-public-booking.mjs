// Run with: node --env-file=.env scripts/verify-public-booking.mjs YYYY-MM-DD
// Uses only isolated authorization-test businesses and cancels its appointment.
const base = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const date = process.argv[2];
if (!base || !key || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
  throw new Error("Provide SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and a future YYYY-MM-DD date");
}

const endpoint = `${base}/functions/v1/backend-api`;
const call = async (action, params) => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ action, params }),
  });
  return { status: response.status, body: await response.json() };
};
const requireOk = (result, action) => {
  if (result.status !== 200) throw new Error(`${action}: ${result.status} ${JSON.stringify(result.body)}`);
  return result.body.data;
};

const a = requireOk(await call("get_public_booking_page", { p_slug: "authz-verification-a-20261107" }), "A page");
const b = requireOk(await call("get_public_booking_page", { p_slug: "authz-verification-b-20261107" }), "B page");
if (a.booking_page_id === b.booking_page_id || b.services.length !== 1) throw new Error("Tenant projections are not isolated");
const unauthenticatedStaffEdit = await call("set_staff_services", { p_business_id: "b2000000-0000-4000-8000-000000000001", p_staff_id: "b5000000-0000-4000-8000-000000000001", p_service_ids: [] });
if (unauthenticatedStaffEdit.status !== 401) throw new Error("Unauthenticated staff assignment edit was not rejected");

const serviceId = b.services[0].service_id;
const availability = { p_booking_page_id: b.booking_page_id, p_service_id: serviceId, p_from_date: date, p_through_date: date, p_staff_id: null, p_addon_quantities: [], p_seat_count: 1 };
const crossTenantAvailability = await call("get_availability", { ...availability, p_booking_page_id: a.booking_page_id });
if (crossTenantAvailability.status === 200) throw new Error("Another business's service was accepted on A's booking page");
const slots = requireOk(await call("get_availability", availability), "B availability");
if (!slots.length) throw new Error("No available slot on the requested date");
const slot = slots[0];
const invalidLink = await call("get_managed_appointment", { p_management_token: crypto.randomUUID() });
if (invalidLink.body.code !== "P0403") throw new Error("An unknown management token was accepted");
const holdInput = { p_booking_page_id: b.booking_page_id, p_service_id: serviceId, p_staff_id: slot.staff_id, p_session_id: slot.session_id, p_starts_at: slot.starts_at, p_addon_quantities: [], p_seat_count: 1 };
let confirmed;
try {
  const results = await Promise.all([
    call("create_booking_hold", { ...holdInput, p_request_key: crypto.randomUUID() }),
    call("create_booking_hold", { ...holdInput, p_request_key: crypto.randomUUID() }),
  ]);
  const winners = results.filter((result) => result.status === 200);
  const conflicts = results.filter((result) => result.status === 409 && result.body.code === "P0409");
  if (winners.length !== 1 || conflicts.length !== 1) throw new Error(`Expected one hold and one conflict: ${results.map((result) => result.status)}`);

  const hold = winners[0].body.data;
  const confirmationInput = {
    p_hold_token: hold.hold_token, p_customer_id: null,
    p_contact: { full_name: "Verification Customer B", email: "verification-b@example.com", phone_e164: null },
    p_customer_notes: "Isolated public booking contract test", p_consent_decisions: [], p_request_key: crypto.randomUUID(),
  };
  confirmed = requireOk(await call("confirm_booking", confirmationInput), "Confirmation");
  const repeat = requireOk(await call("confirm_booking", confirmationInput), "Idempotent confirmation");
  if (repeat.appointment_id !== confirmed.appointment_id) throw new Error("Confirmation replay created another appointment");
  const managed = requireOk(await call("get_managed_appointment", { p_management_token: confirmed.management_token }), "Management link");
  if (managed.appointment_id !== confirmed.appointment_id) throw new Error("Management link opened another appointment");
  console.log(JSON.stringify({ tenantIsolation: true, crossTenantAvailabilityDenied: true, unauthenticatedStaffEditDenied: true, invalidTokenDenied: true, concurrentHold: true, idempotentConfirmation: true, managementLink: true, appointmentId: confirmed.appointment_id }));
} finally {
  if (confirmed) {
    const managed = requireOk(await call("get_managed_appointment", { p_management_token: confirmed.management_token }), "Cleanup lookup");
    requireOk(await call("cancel_appointment", { p_appointment_id: confirmed.appointment_id, p_reason: "Verification cleanup", p_management_token: confirmed.management_token, p_expected_row_version: managed.row_version, p_request_key: crypto.randomUUID() }), "Cleanup cancellation");
    const restored = requireOk(await call("get_availability", availability), "Availability after cancellation");
    if (!restored.some((item) => item.starts_at === slot.starts_at && item.staff_id === slot.staff_id)) throw new Error("Cancellation did not release the time slot");
    console.log("Cancellation and slot release: passed");
  }
}
