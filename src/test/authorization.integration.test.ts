import { describe, expect, it } from "vitest";

const enabled = process.env['AVELLO_AUTHORIZATION_TESTS'] === '1';
const url = 'https://tkjyfyjsbswbhbixvbjj.supabase.co';
const key = 'sb_publishable_DKMUFRnr3mW0ObUrZDyJEw_alakJlP5';
const a = 'a2000000-0000-4000-8000-000000000001';
const b = 'b2000000-0000-4000-8000-000000000001';
const analytics = (business: string) => ({ p_business_id: business, p_location_id: null, p_from_date: '2026-11-01', p_through_date: '2026-11-30' });
async function call(action: string, params: Record<string, unknown>, actor: 'A' | 'B' | null = 'A', direct = false) {
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  if (actor) {
    const token = process.env[`AVELLO_TEST_OWNER_${actor}_TOKEN`];
    if (!token) throw new Error('Supply isolated verification user tokens');
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(`${url}/${direct ? `rest/v1/rpc/${action}` : 'functions/v1/backend-api'}`, {
    method: 'POST', headers, body: JSON.stringify(direct ? params : { action, params }),
  });
  return { status: response.status, body: await response.json() };
}
describe.skipIf(!enabled)('connected explicit-actor authorization', () => {
  it('allows owner A analytics for A', async () => {
    const r = await call('get_business_analytics', analytics(a));
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveProperty('booking_count');
  });
  it('rejects owner A for B even when the submitted actor is forged', async () => {
    const r = await call('get_business_analytics', { ...analytics(b), p_actor_user_id: process.env['AVELLO_TEST_OWNER_B_ID'] });
    expect(r.body.code).toBe('P0403');
  });
  it('allows only the manager enabled analytics flag', async () => {
    expect((await call('get_business_analytics', analytics(a), 'B')).status).toBe(200);
  });
  it('rejects the manager disabled billing flag', async () => {
    const r = await call('create_invoice', { p_business_id: a, p_customer_id: 'a4000000-0000-4000-8000-000000000001', p_appointment_id: null, p_items: [], p_due_date: null, p_notes: '', p_request_key: crypto.randomUUID() }, 'B');
    expect(r.body.code).toBe('P0403');
  });
  it('rejects a customer profile ID from another business before writing tags', async () => {
    const r = await call('save_customer_profile', {
      p_business_id: a,
      p_customer_id: 'b4000000-0000-4000-8000-000000000001',
      p_note: '',
      p_tags: [],
    });
    expect(r.status).toBe(404);
  });
  it('allows the public booking projection without an actor', async () => {
    expect((await call('get_public_booking_page', { p_slug: 'authz-verification-a-20261107' }, null)).status).toBe(200);
  });
  for (const actor of [null, 'A'] as const) {
    it(`denies direct analytics execution for ${actor ? 'authenticated' : 'anon'}`, async () => {
      const r = await call('get_business_analytics', { ...analytics(a), p_actor_user_id: process.env['AVELLO_TEST_OWNER_A_ID'] }, actor, true);
      expect(r.body.code).toBe('42501');
    });
  }
});
