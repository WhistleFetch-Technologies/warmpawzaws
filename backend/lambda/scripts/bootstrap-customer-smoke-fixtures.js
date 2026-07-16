#!/usr/bin/env node
/**
 * Bootstrap smoke fixtures from dev RDS (read-only SELECTs) + optional UAT auth.
 * Output: scripts/_customer-smoke-fixtures.json (do not commit)
 *
 * Required env (typical Gate 2 run from RDS-capable host):
 *   SMOKE_BASE_URL=https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com
 *   ENVIRONMENT=dev
 *
 * DB (one of):
 *   DATABASE_URL=postgresql://...
 *   or DB_HOST + DB_USER + DB_PASSWORD (+ DB_NAME)
 *   or AWS credentials + Secrets Manager (dev RDS master secret default)
 *
 * Optional:
 *   SMOKE_CUSTOMER_PHONE=9845299005
 *   SMOKE_CUSTOMER_ID / SMOKE_BOOKING_ID / SMOKE_ORDER_ID / SMOKE_VENDOR_ID / ...
 *   SMOKE_REQUIRE_RDS=1  — exit 1 if RDS unavailable or customer not found
 *
 * Usage:
 *   ENVIRONMENT=dev SMOKE_BASE_URL=https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com \
 *     node scripts/bootstrap-customer-smoke-fixtures.js
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const OUT = path.join(__dirname, '_customer-smoke-fixtures.json');
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const SMOKE_PHONE = process.env.SMOKE_CUSTOMER_PHONE || '9845299005';
const API_BASE =
  process.env.SMOKE_BASE_URL ||
  'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const REQUIRE_RDS = process.env.SMOKE_REQUIRE_RDS === '1' || process.env.SMOKE_REQUIRE_RDS === 'true';

const PLACEHOLDER = {
  bookingId: '00000000-0000-0000-0000-000000000001',
  orderId: '00000000-0000-0000-0000-000000000002',
  vendorId: '00000000-0000-0000-0000-000000000004',
  addressId: '00000000-0000-0000-0000-000000000005',
  petId: '00000000-0000-0000-0000-000000000006',
  itemId: '00000000-0000-0000-0000-000000000007',
  paymentId: '00000000-0000-0000-0000-000000000008',
  requestId: '00000000-0000-0000-0000-000000000009',
  quoteId: '00000000-0000-0000-0000-00000000000a',
  applicationId: '00000000-0000-0000-0000-00000000000b',
  serviceId: '00000000-0000-0000-0000-000000000099',
};

const ARTICLE_CATEGORIES = [
  'marketing',
  'tips',
  'article',
  'nutrition',
  'health',
  'grooming',
  'insurance',
  'behavior',
  'legal',
  'help',
  'other',
  'general',
];

async function getPool() {
  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 2,
    });
  }

  if (process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD) {
    return new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'warmpawz',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
      max: 2,
    });
  }

  try {
    const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
    const SECRET_ARN =
      process.env.DB_SECRET_ARN ||
      'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI';
    const DB_HOST =
      process.env.DB_HOST || 'warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com';
    const DB_NAME = process.env.DB_NAME || 'warmpawz';
    const sm = new SecretsManagerClient({ region: REGION });
    const sec = await sm.send(new GetSecretValueCommand({ SecretId: SECRET_ARN }));
    const creds = JSON.parse(sec.SecretString);
    return new Pool({
      host: DB_HOST,
      port: 5432,
      database: DB_NAME,
      user: creds.username || creds.user,
      password: creds.password,
      ssl: { rejectUnauthorized: false },
      max: 2,
    });
  } catch (e) {
    console.warn('DB connection unavailable:', e.message);
    return null;
  }
}

async function q(client, sql, params = []) {
  try {
    return await client.query(sql, params);
  } catch (e) {
    console.warn(`  query skipped: ${e.message.split('\n')[0]}`);
    return { rows: [] };
  }
}

async function fetchAuthToken(phone) {
  try {
    await fetch(`${API_BASE}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, role: 'customer' }),
    });
    const verify = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp: '123456', role: 'customer' }),
    });
    if (!verify.ok) return { token: null, customerId: null };
    const data = await verify.json();
    const token =
      data?.data?.data?.token?.access_token ||
      data?.data?.token?.access_token ||
      data.access_token ||
      data.accessToken ||
      data.token?.access_token ||
      data.data?.access_token ||
      null;
    const customerId =
      data?.data?.data?.profile?.id ||
      data?.data?.data?.user?.id ||
      data?.data?.profile?.id ||
      null;
    return { token, customerId };
  } catch {
    return { token: null, customerId: null };
  }
}

function firstId(rows, ...keys) {
  if (!rows?.length) return null;
  const row = rows[0];
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim()) return String(row[k]);
  }
  return null;
}

async function loadFromRds(pool, phone) {
  const out = {
    rdsOk: false,
    customerId: null,
    customerPhone: phone,
    bookingId: null,
    orderId: null,
    appointmentId: null,
    vendorId: null,
    addressId: null,
    petId: null,
    adoptionPetId: null,
    itemId: null,
    paymentId: null,
    requestId: null,
    quoteId: null,
    applicationId: null,
    serviceId: null,
    slug: null,
    articleSlug: null,
    sources: {},
  };

  const client = await pool.connect();
  try {
    out.rdsOk = true;

    const cust = await q(
      client,
      `SELECT id::text AS id, phone FROM customers
       WHERE regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') LIKE $1
       ORDER BY created_at DESC NULLS LAST LIMIT 1`,
      [`%${phone}%`]
    );
    out.customerId = firstId(cust.rows, 'id') || process.env.SMOKE_CUSTOMER_ID || null;
    out.customerPhone = cust.rows[0]?.phone || phone;
    out.sources.customer = !!out.customerId;

    if (out.customerId) {
      const booking = await q(
        client,
        `SELECT id::text AS id FROM bookings
         WHERE customer_id = $1::uuid
         ORDER BY created_at DESC NULLS LAST LIMIT 1`,
        [out.customerId]
      );
      out.bookingId = firstId(booking.rows, 'id');
      out.sources.booking = !!out.bookingId;

      // Appointments routes use bookings table (appointmentId = booking id)
      out.appointmentId = out.bookingId;
      out.sources.appointment = !!out.appointmentId;

      const order = await q(
        client,
        `SELECT id::text AS id FROM orders
         WHERE customer_id = $1::uuid
         ORDER BY created_at DESC NULLS LAST LIMIT 1`,
        [out.customerId]
      );
      out.orderId = firstId(order.rows, 'id');
      out.sources.order = !!out.orderId;

      const address = await q(
        client,
        `SELECT id::text AS id FROM customer_addresses
         WHERE customer_id = $1::uuid
         ORDER BY created_at DESC NULLS LAST LIMIT 1`,
        [out.customerId]
      );
      out.addressId = firstId(address.rows, 'id');
      out.sources.address = !!out.addressId;

      const pet = await q(
        client,
        `SELECT id::text AS id FROM pets
         WHERE customer_id = $1::uuid
         ORDER BY created_at DESC NULLS LAST LIMIT 1`,
        [out.customerId]
      );
      out.petId = firstId(pet.rows, 'id');
      out.sources.pet = !!out.petId;

      const cart = await q(
        client,
        `SELECT id::text AS id FROM cart_items
         WHERE customer_id = $1::uuid
         ORDER BY created_at DESC NULLS LAST LIMIT 1`,
        [out.customerId]
      );
      out.itemId = firstId(cart.rows, 'id');
      out.sources.cartItem = !!out.itemId;

      if (!out.itemId) {
        const wish = await q(
          client,
          `SELECT id::text AS id FROM customer_wishlist
           WHERE customer_id = $1::uuid
           ORDER BY created_at DESC NULLS LAST LIMIT 1`,
          [out.customerId]
        );
        out.itemId = firstId(wish.rows, 'id');
        out.sources.wishlistItem = !!out.itemId;
      }

      const pay = await q(
        client,
        `SELECT id::text AS id FROM customer_payment_methods
         WHERE customer_id = $1::uuid
         ORDER BY created_at DESC NULLS LAST LIMIT 1`,
        [out.customerId]
      );
      out.paymentId = firstId(pay.rows, 'id');
      out.sources.payment = !!out.paymentId;

      const matchReq = await q(
        client,
        `SELECT id::text AS id FROM mating_requests
         WHERE from_customer_id = $1::uuid OR to_customer_id = $1::uuid
         ORDER BY created_at DESC NULLS LAST LIMIT 1`,
        [out.customerId]
      );
      out.requestId = firstId(matchReq.rows, 'id');
      out.sources.matingRequest = !!out.requestId;
    }

    // Vendor with at least one discoverable service (for slots / facility / search)
    const vendor = await q(
      client,
      `SELECT v.id::text AS id
       FROM vendors v
       WHERE COALESCE(v.is_active, true) = true
         AND (
           LOWER(TRIM(COALESCE(v.status::text, ''))) IN ('approved', 'active', 'activated')
           OR (LOWER(TRIM(COALESCE(v.status::text, ''))) = 'pending'
               AND LOWER(TRIM(COALESCE(v.vendor_type::text, ''))) = 'solo')
         )
         AND EXISTS (
           SELECT 1 FROM vendor_services vs
           WHERE vs.vendor_id = v.id
             AND COALESCE(vs.is_enabled, true) = true
             AND (
               vs.publish_status IN ('published', 'auto_published')
               OR vs.publish_status IS NULL
             )
         )
       ORDER BY v.created_at DESC NULLS LAST
       LIMIT 1`
    );
    out.vendorId = firstId(vendor.rows, 'id');
    out.sources.vendorWithServices = !!out.vendorId;

    if (!out.vendorId) {
      const anyVendor = await q(
        client,
        `SELECT id::text AS id FROM vendors
         WHERE COALESCE(is_active, true) = true
         ORDER BY created_at DESC NULLS LAST LIMIT 1`
      );
      out.vendorId = firstId(anyVendor.rows, 'id');
      out.sources.vendorFallback = !!out.vendorId;
    }

    if (out.vendorId) {
      const svc = await q(
        client,
        `SELECT id::text AS id FROM vendor_services
         WHERE vendor_id = $1::uuid
           AND COALESCE(is_enabled, true) = true
         ORDER BY created_at DESC NULLS LAST LIMIT 1`,
        [out.vendorId]
      );
      out.serviceId = firstId(svc.rows, 'id');
      out.sources.service = !!out.serviceId;
    }

    // Adoption / shelter pet (vendor-owned, available)
    const adoptionPet = await q(
      client,
      `SELECT p.id::text AS id, p.vendor_id::text AS vendor_id
       FROM pets p
       WHERE p.vendor_id IS NOT NULL
         AND (
           LOWER(TRIM(COALESCE(p.status::text, ''))) IN ('available', 'active')
           OR LOWER(TRIM(COALESCE(p.adoption_status::text, ''))) IN ('available', 'active')
         )
       ORDER BY p.created_at DESC NULLS LAST
       LIMIT 1`
    );
    out.adoptionPetId = firstId(adoptionPet.rows, 'id');
    out.sources.adoptionPet = !!out.adoptionPetId;
    // :petId smoke param: customer pet first; fall back to shelter/adoption listing
    if (!out.petId && out.adoptionPetId) {
      out.petId = out.adoptionPetId;
    }

    // Content page slug (any published) — used by /customer/content/pages/:slug
    const pageSlug = await q(
      client,
      `SELECT slug FROM content_pages
       WHERE is_published = true
         AND TRIM(COALESCE(slug, '')) <> ''
       ORDER BY updated_at DESC NULLS LAST
       LIMIT 1`
    );
    out.slug = pageSlug.rows[0]?.slug ? String(pageSlug.rows[0].slug) : null;
    out.sources.contentSlug = !!out.slug;

    // Article-visible category slug — preferred for /customer/articles/:slug when available
    const articleSlug = await q(
      client,
      `SELECT slug FROM content_pages
       WHERE is_published = true
         AND TRIM(COALESCE(slug, '')) <> ''
         AND LOWER(TRIM(COALESCE(category, ''))) = ANY($1::text[])
       ORDER BY updated_at DESC NULLS LAST
       LIMIT 1`,
      [ARTICLE_CATEGORIES]
    );
    out.articleSlug = articleSlug.rows[0]?.slug ? String(articleSlug.rows[0].slug) : null;
    out.sources.articleSlug = !!out.articleSlug;
    if (out.articleSlug) {
      // Smoke harness has a single :slug param — prefer article-visible slug when present
      out.slug = out.articleSlug;
    }

    const quote = await q(
      client,
      `SELECT id::text AS id FROM relocation_quotes
       ORDER BY created_at DESC NULLS LAST LIMIT 1`
    );
    out.quoteId = firstId(quote.rows, 'id');
    out.sources.quote = !!out.quoteId;

    const app = await q(
      client,
      `SELECT id::text AS id FROM adoption_applications
       ORDER BY COALESCE(submitted_at, created_at) DESC NULLS LAST LIMIT 1`
    );
    out.applicationId = firstId(app.rows, 'id');
    out.sources.application = !!out.applicationId;

    if (!out.requestId) {
      const anyReq = await q(
        client,
        `SELECT id::text AS id FROM mating_requests
         ORDER BY created_at DESC NULLS LAST LIMIT 1`
      );
      out.requestId = firstId(anyReq.rows, 'id');
      out.sources.matingRequestAny = !!out.requestId;
    }

    return out;
  } finally {
    client.release();
  }
}

async function main() {
  console.log('Bootstrap customer smoke fixtures');
  console.log(`  ENVIRONMENT=${ENVIRONMENT}`);
  console.log(`  SMOKE_BASE_URL=${API_BASE}`);
  console.log(`  SMOKE_CUSTOMER_PHONE=${SMOKE_PHONE}`);
  console.log(`  SMOKE_REQUIRE_RDS=${REQUIRE_RDS ? '1' : '0'}`);

  const pool = await getPool();
  const phone = SMOKE_PHONE.replace(/\D/g, '').slice(-10);

  let customerId = process.env.SMOKE_CUSTOMER_ID || null;
  let customerPhone = phone;
  let bookingId = process.env.SMOKE_BOOKING_ID || PLACEHOLDER.bookingId;
  let orderId = process.env.SMOKE_ORDER_ID || PLACEHOLDER.orderId;
  let appointmentId = process.env.SMOKE_APPOINTMENT_ID || bookingId;
  let vendorId = process.env.SMOKE_VENDOR_ID || PLACEHOLDER.vendorId;
  let addressId = process.env.SMOKE_ADDRESS_ID || PLACEHOLDER.addressId;
  let petId = process.env.SMOKE_PET_ID || PLACEHOLDER.petId;
  let itemId = process.env.SMOKE_ITEM_ID || PLACEHOLDER.itemId;
  let paymentId = process.env.SMOKE_PAYMENT_ID || PLACEHOLDER.paymentId;
  let requestId = process.env.SMOKE_REQUEST_ID || PLACEHOLDER.requestId;
  let quoteId = process.env.SMOKE_QUOTE_ID || PLACEHOLDER.quoteId;
  let applicationId = process.env.SMOKE_APPLICATION_ID || PLACEHOLDER.applicationId;
  let serviceId = process.env.SMOKE_SERVICE_ID || PLACEHOLDER.serviceId;
  let slug = process.env.SMOKE_SLUG || 'about';
  let adoptionPetId = null;
  let sources = { mode: 'placeholder' };
  let rdsOk = false;

  if (!pool) {
    if (REQUIRE_RDS) {
      console.error('SMOKE_REQUIRE_RDS=1 but RDS connection failed. Set DATABASE_URL or AWS Secrets Manager access.');
      process.exit(1);
    }
    console.warn('No RDS pool — writing placeholder UUIDs (expect many 404s in smoke).');
  } else {
    try {
      const loaded = await loadFromRds(pool, phone);
      rdsOk = loaded.rdsOk;
      sources = { mode: 'rds', ...loaded.sources };

      if (loaded.customerId) customerId = loaded.customerId;
      if (loaded.customerPhone) customerPhone = loaded.customerPhone;
      if (loaded.bookingId) bookingId = loaded.bookingId;
      if (loaded.orderId) orderId = loaded.orderId;
      if (loaded.appointmentId) appointmentId = loaded.appointmentId;
      else appointmentId = bookingId;
      if (loaded.vendorId) vendorId = loaded.vendorId;
      if (loaded.addressId) addressId = loaded.addressId;
      if (loaded.petId) petId = loaded.petId;
      if (loaded.adoptionPetId) adoptionPetId = loaded.adoptionPetId;
      if (loaded.itemId) itemId = loaded.itemId;
      if (loaded.paymentId) paymentId = loaded.paymentId;
      if (loaded.requestId) requestId = loaded.requestId;
      if (loaded.quoteId) quoteId = loaded.quoteId;
      if (loaded.applicationId) applicationId = loaded.applicationId;
      if (loaded.serviceId) serviceId = loaded.serviceId;
      if (loaded.slug) slug = loaded.slug;

      if (REQUIRE_RDS && !customerId) {
        console.error(`SMOKE_REQUIRE_RDS=1 but no customer found for phone ending ${phone}`);
        process.exit(1);
      }
    } catch (e) {
      console.warn('RDS query failed, using env/default fixtures:', e.message);
      if (REQUIRE_RDS) {
        console.error('SMOKE_REQUIRE_RDS=1 — aborting.');
        process.exit(1);
      }
    } finally {
      try {
        await pool.end();
      } catch {
        /* ignore */
      }
    }
  }

  const auth = await fetchAuthToken(customerPhone);
  const authToken = auth.token;
  if (!customerId && auth.customerId) customerId = auth.customerId;

  const fixtures = {
    generatedAt: new Date().toISOString(),
    environment: ENVIRONMENT,
    apiBase: API_BASE,
    rdsOk,
    sources,
    customerPhone,
    customerId,
    bookingId,
    orderId,
    appointmentId,
    vendorId,
    addressId,
    petId,
    adoptionPetId,
    itemId,
    paymentId,
    requestId,
    quoteId,
    applicationId,
    serviceId,
    slug,
    authToken,
    queryDefaults: {
      phone: customerPhone,
      customerPhone,
      customerId,
      vendorId,
      bookingId,
      orderId,
      appointmentId,
      addressId,
      petId,
      itemId,
      paymentId,
      requestId,
      quoteId,
      applicationId,
      serviceId,
      slug,
      category: 'vet',
      serviceStyle: 'at_center',
      style: 'at_center',
      limit: '5',
      date: '2026-07-20',
      lat: '12.97',
      lng: '77.59',
    },
  };

  fs.writeFileSync(OUT, JSON.stringify(fixtures, null, 2));
  console.log('Wrote fixtures:', OUT);
  console.log('customerId:', customerId || '(missing)');
  console.log('bookingId:', bookingId, '| orderId:', orderId, '| appointmentId:', appointmentId);
  console.log('vendorId:', vendorId, '| serviceId:', serviceId);
  console.log('addressId:', addressId, '| petId:', petId);
  console.log('itemId:', itemId, '| paymentId:', paymentId);
  console.log('slug:', slug, '| quoteId:', quoteId, '| applicationId:', applicationId);
  console.log('auth:', authToken ? 'yes' : 'no', '| rdsOk:', rdsOk);
  console.log('sources:', JSON.stringify(sources));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
