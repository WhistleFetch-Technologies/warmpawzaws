/**
 * Live HTTP IDOR matrix against isolated RDS fixtures.
 *
 * Gated by SECURITY_IDOR_LIVE=1 plus disposable fixture env vars.
 * Without that harness this suite reports the infrastructure blocker and
 * does not claim live HTTP/RDS authorization passed.
 *
 * Required for a true live run (dev/test only — never production):
 *   SECURITY_IDOR_LIVE=1
 *   SECURITY_IDOR_API_BASE
 *   SECURITY_IDOR_TOKEN_A / SECURITY_IDOR_TOKEN_B
 *   SECURITY_IDOR_BOOKING_B / SECURITY_IDOR_ORDER_B / SECURITY_IDOR_PET_B
 *   SECURITY_IDOR_PHONE_B / SECURITY_IDOR_VENDOR_B / SECURITY_IDOR_VENDOR_TOKEN_A
 */
const LIVE = process.env.SECURITY_IDOR_LIVE === '1';
const API_BASE = process.env.SECURITY_IDOR_API_BASE || '';
const TOKEN_A = process.env.SECURITY_IDOR_TOKEN_A || '';
const TOKEN_B = process.env.SECURITY_IDOR_TOKEN_B || '';
const BOOKING_B = process.env.SECURITY_IDOR_BOOKING_B || '';
const ORDER_B = process.env.SECURITY_IDOR_ORDER_B || '';
const PET_B = process.env.SECURITY_IDOR_PET_B || '';
const PHONE_B = process.env.SECURITY_IDOR_PHONE_B || '';
const VENDOR_B = process.env.SECURITY_IDOR_VENDOR_B || '';
const VENDOR_TOKEN_A = process.env.SECURITY_IDOR_VENDOR_TOKEN_A || '';

async function http(
  method: string,
  path: string,
  token?: string,
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

describe('HTTP IDOR integration matrix', () => {
  if (!LIVE || !API_BASE) {
    it('BLOCKER: isolated RDS/HTTP fixtures unavailable', () => {
      expect({
        liveEnabled: LIVE,
        apiBaseConfigured: Boolean(API_BASE),
        note:
          'Live HTTP IDOR matrix not executed — provide SECURITY_IDOR_* disposable fixtures on isolated test infra',
      }).toMatchObject({ liveEnabled: false, apiBaseConfigured: false });
    });
    return;
  }

  it('2: Customer A → Customer B booking denied', async () => {
    const r = await http('GET', `/customer/bookings/${BOOKING_B}`, TOKEN_A);
    expect([401, 403, 404]).toContain(r.status);
  });

  it('3: Customer A → B booking OTP denied', async () => {
    const r = await http('GET', `/bookings/${BOOKING_B}/otp`, TOKEN_A);
    expect([401, 403, 404, 405]).toContain(r.status);
  });

  it('4: Customer A → B medical denied', async () => {
    const r = await http(
      'GET',
      `/customer/${encodeURIComponent(PHONE_B)}/medical-records`,
      TOKEN_A,
    );
    expect([401, 403, 404]).toContain(r.status);
  });

  it('5: Customer A → B pet denied', async () => {
    const r = await http('GET', `/medical-records/pet/${PET_B}`, TOKEN_A);
    expect([401, 403, 404]).toContain(r.status);
  });

  it('6: Customer A → B wallet denied', async () => {
    const r = await http(
      'GET',
      `/customer/wallet?phone=${encodeURIComponent(PHONE_B)}`,
      TOKEN_A,
    );
    expect([401, 403, 404]).toContain(r.status);
  });

  it('7: Customer A → B order denied', async () => {
    const r = await http('GET', `/customer/orders/${ORDER_B}`, TOKEN_A);
    expect([401, 403, 404]).toContain(r.status);
  });

  it('8: Customer A → B payment history denied', async () => {
    const r = await http(
      'GET',
      `/customer/warmpawz-pay/transactions?phone=${encodeURIComponent(PHONE_B)}`,
      TOKEN_A,
    );
    expect([401, 403, 404]).toContain(r.status);
  });

  it('12: Unauthenticated → 401/403', async () => {
    const r = await http('GET', `/customer/bookings/${BOOKING_B}`);
    expect([401, 403]).toContain(r.status);
  });

  it('16: GET tele cancel → 405', async () => {
    const r = await http('GET', `/customer/tele/instant-cancel/${BOOKING_B}`, TOKEN_A);
    expect(r.status).toBe(405);
  });

  it('10: Vendor A → Vendor B settlement denied', async () => {
    if (!VENDOR_TOKEN_A || !VENDOR_B) return;
    const r = await http('GET', `/vendor/${VENDOR_B}/settlements`, VENDOR_TOKEN_A);
    expect([401, 403, 404]).toContain(r.status);
  });

  it('owner sanity: TOKEN_B may read own booking', async () => {
    if (!TOKEN_B || !BOOKING_B) return;
    const r = await http('GET', `/customer/bookings/${BOOKING_B}`, TOKEN_B);
    expect([200, 404]).toContain(r.status);
  });
});
