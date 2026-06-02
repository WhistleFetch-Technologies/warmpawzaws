#!/usr/bin/env node
/** Fast probe of notification routes on dev API. Usage: node scripts/probe-notification-routes-dev.js */
const BASE = process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

const tests = [
  ['GET', '/admin/notifications/campaigns'],
  ['GET', '/admin/notifications/settings'],
  ['GET', '/admin/notifications/delivery/stats'],
  ['GET', '/admin/notifications/templates'],
  ['GET', '/notifications?userId=test&userType=customer'],
  ['POST', '/admin/notifications/estimate-audience', { target_app: 'CUSTOMER', targeting_type: 'BROADCAST' }],
  ['POST', '/push/register-device', {
    userId: '00000000-0000-0000-0000-000000000001',
    userType: 'customer',
    deviceId: 'probe-device',
    fcmToken: 'probe-fcm-token',
    platform: 'android',
  }],
  ['POST', '/push/send', {
    userId: '00000000-0000-0000-0000-000000000001',
    userType: 'customer',
    title: 'Route probe',
    body: 'probe',
  }],
];

async function run() {
  console.log('API:', BASE, '\n');
  for (const [method, path, body] of tests) {
    const t0 = Date.now();
    try {
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      const ms = Date.now() - t0;
      const snippet = text.replace(/\s+/g, ' ').slice(0, 140);
      console.log(`${method.padEnd(4)} ${path}`);
      console.log(`     ${res.status} (${ms}ms) ${snippet}\n`);
    } catch (e) {
      console.log(`${method} ${path} -> ERROR ${e.message}\n`);
    }
  }
}

run();
