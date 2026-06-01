#!/usr/bin/env node
/**
 * End-to-end native push test on DEV API (requires a real FCM token from device).
 *
 * Get token from Android logcat after opening the app:
 *   adb logcat | findstr /i "FCM token registration"
 *
 * Usage:
 *   node scripts/test-native-push-dev.js --userId=<uuid> --userType=customer --token=<fcm-token>
 *   node scripts/test-native-push-dev.js --userId=<uuid> --userType=vendor --token=<fcm-token>
 */
const API = process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

function arg(name, fallback = '') {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}

const userId = arg('userId');
const userType = arg('userType', 'customer');
const fcmToken = arg('token');
const title = arg('title', 'Warmpawz push test');
const body = arg('body', `Native push test ${new Date().toISOString()}`);

if (!userId || !fcmToken) {
  console.error(`
Usage:
  node scripts/test-native-push-dev.js --userId=<uuid> --userType=customer|vendor --token=<fcm-token>

Optional: --title=... --body=...
API: ${API}
`);
  process.exit(1);
}

async function post(path, payload) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

async function main() {
  const deviceId = `e2e-${Date.now()}`;
  console.log('1) Register device…');
  const reg = await post('/push/register-device', {
    userId,
    userType,
    deviceId,
    fcmToken,
    platform: 'android',
  });
  console.log('   ', reg.status, JSON.stringify(reg.json));

  console.log('\n2) Send push…');
  const send = await post('/push/send', { userId, userType, title, body, data: { source: 'test-native-push-dev' } });
  console.log('   ', send.status, JSON.stringify(send.json));

  if (send.json?.successCount > 0) {
    console.log('\n✅ Push accepted by FCM — check the device notification tray.');
  } else {
    console.log('\n⚠️  Push not delivered. Check token, Firebase project, and device_tokens row.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
