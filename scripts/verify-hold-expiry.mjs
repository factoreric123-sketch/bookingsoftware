// Run with: node --env-file=.env scripts/verify-hold-expiry.mjs YYYY-MM-DD
// Uses the isolated B fixture. The unconfirmed hold expires naturally after ten minutes.
const base = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const date = process.argv[2];
if (!base || !key || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
  throw new Error("Provide Supabase configuration and a future open YYYY-MM-DD date");
}

const call = async (action, params) => {
  const response = await fetch(`${base}/functions/v1/backend-api`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ action, params }),
  });
  return { status: response.status, body: await response.json() };
};
const success = (result, action) => {
  if (result.status !== 200)
    throw new Error(`${action}: ${result.status} ${JSON.stringify(result.body)}`);
  return result.body.data;
};

const page = success(
  await call("get_public_booking_page", { p_slug: "authz-verification-b-20261107" }),
  "Booking page",
);
const availability = {
  p_booking_page_id: page.booking_page_id,
  p_service_id: page.services[0].service_id,
  p_from_date: date,
  p_through_date: date,
  p_staff_id: null,
  p_addon_quantities: [],
  p_seat_count: 1,
};
const slots = success(await call("get_availability", availability), "Availability");
if (!slots.length) throw new Error("No test slot is available");
const slot = slots[0];
const hold = success(
  await call("create_booking_hold", {
    p_booking_page_id: page.booking_page_id,
    p_service_id: page.services[0].service_id,
    p_staff_id: slot.staff_id,
    p_session_id: slot.session_id,
    p_starts_at: slot.starts_at,
    p_addon_quantities: [],
    p_seat_count: 1,
    p_request_key: crypto.randomUUID(),
  }),
  "Hold",
);
const remaining = new Date(hold.expires_at).getTime() - Date.now();
if (remaining < 9 * 60_000 || remaining > 11 * 60_000)
  throw new Error(`Unexpected hold lifetime: ${remaining} ms`);
const reserved = success(await call("get_availability", availability), "Availability during hold");
if (reserved.some((item) => item.starts_at === slot.starts_at && item.staff_id === slot.staff_id))
  throw new Error("Active hold did not reserve its slot");
console.log(
  JSON.stringify({
    holdId: hold.hold_id,
    slot: slot.starts_at,
    expiresAt: hold.expires_at,
    waitSeconds: Math.ceil(remaining / 1000),
  }),
);
await new Promise((resolve) => setTimeout(resolve, remaining + 2_000));

const expired = await call("confirm_booking", {
  p_hold_token: hold.hold_token,
  p_customer_id: null,
  p_contact: {
    full_name: "Expired Hold Verification",
    email: "expired-hold@example.com",
    phone_e164: null,
  },
  p_customer_notes: "",
  p_consent_decisions: [],
  p_request_key: crypto.randomUUID(),
});
if (expired.body.code !== "P0403" || expired.status === 200)
  throw new Error(`Expired hold was not denied: ${expired.status} ${JSON.stringify(expired.body)}`);
const restored = success(await call("get_availability", availability), "Availability after expiry");
if (!restored.some((item) => item.starts_at === slot.starts_at && item.staff_id === slot.staff_id))
  throw new Error("Expired hold did not release its slot");
console.log("Expired hold denied and slot available again: passed");
