#!/usr/bin/env node
/**
 * Scripted API checks for end-to-end vendor session/combo packages.
 *
 * Verifies:
 *   1. /packages/quote and /customer/pricing/quote return the SAME total
 *      (single-source-of-truth pricing pipeline).
 *   2. /packages/quote rejects creating a Razorpay order without
 *      `policyAccepted` (HTTP 400 with `POLICY_NOT_ACCEPTED`).
 *   3. /packages/:packagePurchaseId/sessions returns `parent_booking_id`
 *      and `package_purchase_id` on every session row.
 *   4. Vendor list /vendor/:vendorId/bookings hides the canonical package
 *      parent (per-session children only) and includes
 *      `progress.completed_sessions` / `total_sessions` for each child.
 *   5. Customer view shows OTP for each child; vendor view does not.
 *
 * Usage:
 *   node scripts/validate-package-flow.js \
 *     --base https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com \
 *     --customer <customerJwt> --vendor <vendorJwt> \
 *     --vendorId <uuid> --vendorServiceId <uuid> [--packagePurchaseId <uuid>]
 *
 * The script is read-only by default. Add `--purchase` to actually create a
 * package purchase (free packages or with `--razorpay-order/--razorpay-payment/
 * --razorpay-signature` proof for paid ones).
 */

/* eslint-disable no-console */

const args = process.argv.slice(2).reduce((acc, arg, i, all) => {
  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    const next = all[i + 1];
    acc[key] = next && !next.startsWith('--') ? next : true;
  }
  return acc;
}, {});

const BASE = String(args.base || process.env.API_BASE || '').replace(/\/$/, '');
if (!BASE) {
  console.error('Missing --base <api-gateway-url>');
  process.exit(2);
}

const CUSTOMER_TOKEN = args.customer || process.env.CUSTOMER_JWT || '';
const VENDOR_TOKEN = args.vendor || process.env.VENDOR_JWT || '';
const VENDOR_ID = String(args.vendorId || '');
const VENDOR_SERVICE_ID = String(args.vendorServiceId || '');
const PACKAGE_PURCHASE_ID = String(args.packagePurchaseId || '');
const CUSTOMER_ID = String(args.customerId || '');

if (!VENDOR_ID || !VENDOR_SERVICE_ID) {
  console.error('Missing --vendorId or --vendorServiceId');
  process.exit(2);
}

const fetch = global.fetch;
if (typeof fetch !== 'function') {
  console.error('Node 18+ required (global fetch missing).');
  process.exit(2);
}

let pass = 0;
let fail = 0;

function ok(label) {
  pass++;
  console.log('\u2713', label);
}
function bad(label, extra) {
  fail++;
  console.log('\u2717', label, extra ? `\n   ${JSON.stringify(extra)}` : '');
}

async function http(method, path, body, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

(async function main() {
  console.log('-> /packages/quote vs /customer/pricing/quote parity');
  const pkgQuote = await http(
    'POST',
    '/packages/quote',
    {
      customerId: CUSTOMER_ID || undefined,
      vendorId: VENDOR_ID,
      vendorServiceId: VENDOR_SERVICE_ID,
    },
    CUSTOMER_TOKEN
  );
  if (pkgQuote.status !== 200 || !pkgQuote.json?.success) {
    bad('packages/quote returned 200', pkgQuote);
  } else {
    ok(`packages/quote total = ${pkgQuote.json.totalAmount}`);
  }

  const pricingQuote = await http(
    'POST',
    '/customer/pricing/quote',
    { serviceId: VENDOR_SERVICE_ID, vendorId: VENDOR_ID, customerId: CUSTOMER_ID || undefined },
    CUSTOMER_TOKEN
  );
  if (pricingQuote.status !== 200 || !pricingQuote.json?.success) {
    bad('/customer/pricing/quote returned 200', pricingQuote);
  } else if (pkgQuote.json?.totalAmount && pricingQuote.json.totalAmount) {
    if (Math.abs(pkgQuote.json.totalAmount - pricingQuote.json.totalAmount) > 0.02) {
      bad('packages/quote total === customer/pricing/quote total', {
        pkg: pkgQuote.json.totalAmount,
        pricing: pricingQuote.json.totalAmount,
      });
    } else {
      ok('quote totals match (single pricing pipeline)');
    }
  }

  console.log('\n-> Razorpay order creation gated on policyAccepted');
  const orderNoPolicy = await http(
    'POST',
    '/packages/purchase-from-vendor-service',
    {
      customerId: CUSTOMER_ID,
      vendorId: VENDOR_ID,
      vendorServiceId: VENDOR_SERVICE_ID,
      sessionSchedule: [{ sessionNumber: 1, date: new Date().toISOString().slice(0, 10), time: '10:00' }],
    },
    CUSTOMER_TOKEN
  );
  if (orderNoPolicy.status !== 400 || orderNoPolicy.json?.error !== 'POLICY_NOT_ACCEPTED') {
    bad('purchase without policyAccepted should be 400 POLICY_NOT_ACCEPTED', orderNoPolicy);
  } else {
    ok('policy gate enforced');
  }

  if (PACKAGE_PURCHASE_ID) {
    console.log('\n-> /packages/:id/sessions surfaces parent_booking_id + package_purchase_id');
    const sessions = await http(
      'GET',
      `/packages/${encodeURIComponent(PACKAGE_PURCHASE_ID)}/sessions`,
      undefined,
      CUSTOMER_TOKEN
    );
    if (sessions.status !== 200) {
      bad('packages/:id/sessions returned 200', sessions);
    } else {
      const rows = Array.isArray(sessions.json?.sessions) ? sessions.json.sessions : [];
      const allHaveParent = rows.every(
        (s) => s.parent_booking_id || s.parentBookingId
      );
      const allHavePurchase = rows.every(
        (s) => s.package_purchase_id || s.packagePurchaseId
      );
      if (!rows.length) bad('sessions list non-empty');
      else if (!allHaveParent) bad('every session has parent_booking_id');
      else if (!allHavePurchase) bad('every session has package_purchase_id');
      else ok(`sessions list shape OK (${rows.length} rows)`);

      // Customer must see at least one OTP for non-tele.
      const styleSample = String(rows[0]?.serviceStyle || rows[0]?.service_style || '').toLowerCase();
      const expectsOtp = styleSample === 'at_center' || styleSample === 'at_home';
      const customerHasOtp = rows.some((r) => r.otpCode || r.otp_code || r.startOTP || r.start_otp);
      if (expectsOtp && !customerHasOtp) {
        bad('customer view shows session OTP for non-tele packages');
      } else {
        ok('customer OTP exposure consistent with package style');
      }
    }

    if (VENDOR_TOKEN) {
      console.log('\n-> Vendor view: per-session bookings + progress, no OTP');
      const vbk = await http(
        'GET',
        `/vendor/${encodeURIComponent(VENDOR_ID)}/bookings`,
        undefined,
        VENDOR_TOKEN
      );
      if (vbk.status !== 200) {
        bad('vendor bookings list 200', vbk);
      } else {
        const rows = Array.isArray(vbk.json?.bookings) ? vbk.json.bookings : [];
        const sessionRows = rows.filter(
          (r) =>
            r.isPackageSession === true ||
            r.is_package_session === true
        );
        if (!sessionRows.length) {
          bad('vendor list contains per-session children');
        } else {
          ok(`vendor list returns ${sessionRows.length} session row(s)`);
        }
        const haveProgress = sessionRows.every(
          (r) => r.progress && r.progress.total_sessions != null
        );
        if (sessionRows.length && !haveProgress) {
          bad('every session row has progress aggregation');
        } else if (sessionRows.length) {
          ok('progress aggregated by backend');
        }
        const leakedOtp = sessionRows.some(
          (r) => r.otpCode || r.otp_code || r.startOTP || r.completionOTP
        );
        if (leakedOtp) bad('vendor list does NOT leak OTP');
        else ok('OTP stripped from vendor list');

        const parentLeaks = rows.some(
          (r) =>
            (r.package_purchase_id || r.packagePurchaseId) &&
            !(r.is_package_session ?? r.isPackageSession)
        );
        if (parentLeaks) bad('vendor list hides canonical parent');
        else ok('vendor calendar hides canonical parent');
      }
    } else {
      console.log('\n(skipping vendor view tests; pass --vendor <jwt> to enable)');
    }
  } else {
    console.log('\n(skipping session/vendor checks; pass --packagePurchaseId <uuid> to enable)');
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((err) => {
  console.error('FATAL', err);
  process.exit(2);
});
