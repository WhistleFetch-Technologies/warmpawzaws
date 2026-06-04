#!/usr/bin/env node
/**
 * Sanity check for notification campaign engine on dev (post migrate + deploy).
 * Usage: node scripts/sanity-check-notification-engine-dev.js
 */
const BASE = process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

const REQUIRED_ROUTES = [
  ['GET', '/admin/notifications/campaigns', null, (s) => s === 200],
  ['GET', '/admin/notifications/settings', null, (s) => s === 200],
  ['GET', '/admin/notifications/templates', null, (s) => s === 200],
  ['GET', '/admin/notifications/segments', null, (s) => s === 200],
  ['GET', '/admin/notifications/delivery/stats', null, (s) => s === 200],
  ['POST', '/admin/notifications/estimate-audience', {
    target_app: 'CUSTOMER',
    targeting_type: 'BROADCAST',
  }, (s) => s === 200],
];

const SCHEMA_CHECKS = [
  'notification_campaigns',
  'notification_campaign_templates',
  'notification_channel_settings',
  'notification_campaign_deliveries',
  'notification_campaign_events',
];

async function request(method, path, body) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, ms: Date.now() - t0, json, text };
}

async function run() {
  console.log('Notification Engine Sanity Check');
  console.log('API:', BASE, '\n');

  let passed = 0;
  let failed = 0;

  console.log('── Route checks ──');
  for (const [method, path, body, okFn] of REQUIRED_ROUTES) {
    try {
      const { status, ms, json } = await request(method, path, body);
      const ok = okFn(status);
      console.log(`${ok ? 'PASS' : 'FAIL'} ${method} ${path} → ${status} (${ms}ms)`);
      if (!ok) {
        failed += 1;
        console.log('     ', JSON.stringify(json).slice(0, 160));
      } else {
        passed += 1;
      }
    } catch (e) {
      failed += 1;
      console.log(`FAIL ${method} ${path} → ${e.message}`);
    }
  }

  console.log('\n── Schema / payload checks ──');
  try {
    const templates = await request('GET', '/admin/notifications/templates');
    const list = templates.json?.templates;
    const templateOk = templates.status === 200 && Array.isArray(list);
    console.log(`${templateOk ? 'PASS' : 'FAIL'} templates returns array (campaign templates table)`);
    templateOk ? passed += 1 : failed += 1;

    const estimate = await request('POST', '/admin/notifications/estimate-audience', {
      target_app: 'CUSTOMER',
      targeting_type: 'BROADCAST',
    });
    const estOk = estimate.status === 200
      && typeof estimate.json?.estimatedRecipients === 'number'
      && Array.isArray(estimate.json?.warnings);
    console.log(`${estOk ? 'PASS' : 'FAIL'} estimate-audience returns estimatedRecipients + warnings`);
    estOk ? passed += 1 : failed += 1;

    const campaigns = await request('GET', '/admin/notifications/campaigns');
    const campOk = campaigns.status === 200 && Array.isArray(campaigns.json?.campaigns);
    console.log(`${campOk ? 'PASS' : 'FAIL'} campaigns list endpoint`);
    campOk ? passed += 1 : failed += 1;
  } catch (e) {
    failed += 1;
    console.log('FAIL schema checks:', e.message);
  }

  console.log('\n── Expected tables (apply migrations 1024, 1025 on RDS) ──');
  for (const table of SCHEMA_CHECKS) {
    console.log(`  • ${table}`);
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('\nIf routes return 404, deploy Lambda with notification-campaigns endpoints.');
    console.log('If templates return 500 with column errors, run migration 1024 before deploy.');
    process.exit(1);
  }
  process.exit(0);
}

run();
