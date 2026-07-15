#!/usr/bin/env node
/**
 * Bootstrap smoke fixtures from dev RDS (read-only) + optional local UAT auth.
 * Output: scripts/_customer-smoke-fixtures.json
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const OUT = path.join(__dirname, '_customer-smoke-fixtures.json');
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const SMOKE_PHONE = process.env.SMOKE_CUSTOMER_PHONE || '9845299005';
const API_BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000';

async function getPool() {
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 2 });
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
    const REGION = process.env.AWS_REGION || 'ap-south-1';
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
    console.warn('DB connection unavailable, using env/default fixtures:', e.message);
    return null;
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

async function main() {
  const pool = await getPool();
  const phone = SMOKE_PHONE.replace(/\D/g, '').slice(-10);
  let customerId = process.env.SMOKE_CUSTOMER_ID || null;
  let customerPhone = phone;
  let bookingId = process.env.SMOKE_BOOKING_ID || '00000000-0000-0000-0000-000000000001';
  let orderId = process.env.SMOKE_ORDER_ID || '00000000-0000-0000-0000-000000000002';
  let vendorId = process.env.SMOKE_VENDOR_ID || '00000000-0000-0000-0000-000000000004';
  let addressId = process.env.SMOKE_ADDRESS_ID || '00000000-0000-0000-0000-000000000005';
  let petId = process.env.SMOKE_PET_ID || '00000000-0000-0000-0000-000000000006';

  if (pool) {
    try {
      const client = await pool.connect();
      try {
        const cust = await client.query(
          `SELECT id, phone FROM customers WHERE phone LIKE $1 ORDER BY created_at DESC NULLS LAST LIMIT 1`,
          [`%${phone}%`]
        );
        customerId = cust.rows[0]?.id || customerId;
        customerPhone = cust.rows[0]?.phone || phone;

        if (customerId) {
          const booking = await client.query(
            `SELECT id FROM bookings WHERE customer_id = $1::uuid ORDER BY created_at DESC NULLS LAST LIMIT 1`,
            [customerId]
          );
          const order = await client.query(
            `SELECT id FROM orders WHERE customer_id = $1::uuid ORDER BY created_at DESC NULLS LAST LIMIT 1`,
            [customerId]
          );
          const address = await client.query(
            `SELECT id FROM customer_addresses WHERE customer_id = $1::uuid LIMIT 1`,
            [customerId]
          );
          const pet = await client.query(`SELECT id FROM pets WHERE customer_id = $1::uuid LIMIT 1`, [customerId]);
          bookingId = booking.rows[0]?.id || bookingId;
          orderId = order.rows[0]?.id || orderId;
          addressId = address.rows[0]?.id || addressId;
          petId = pet.rows[0]?.id || petId;
        }

        const vendor = await client.query(
          `SELECT id FROM vendors WHERE is_active = true ORDER BY created_at DESC NULLS LAST LIMIT 1`
        );
        vendorId = vendor.rows[0]?.id || vendorId;
      } finally {
        client.release();
        await pool.end();
      }
    } catch (e) {
      console.warn('RDS query failed, using env/default fixtures:', e.message);
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
      customerPhone,
      customerId,
    bookingId,
    orderId,
    appointmentId: bookingId,
    vendorId,
    addressId,
    petId,
      itemId: '00000000-0000-0000-0000-000000000007',
      paymentId: '00000000-0000-0000-0000-000000000008',
      requestId: '00000000-0000-0000-0000-000000000009',
      quoteId: '00000000-0000-0000-0000-00000000000a',
      applicationId: '00000000-0000-0000-0000-00000000000b',
      slug: 'about',
      authToken,
      queryDefaults: {
        phone: customerPhone,
        customerPhone,
        customerId,
        category: 'vet',
        serviceStyle: 'at_center',
        style: 'at_center',
        limit: '5',
      },
    };

  fs.writeFileSync(OUT, JSON.stringify(fixtures, null, 2));
  console.log('Wrote fixtures:', OUT);
  console.log('customerId:', customerId, 'auth:', authToken ? 'yes' : 'no');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
