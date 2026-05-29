/**
 * Measure API GETs during one home reload (Playwright).
 * Usage (dev server on :3001):
 *   node scripts/measure-home-network.mjs
 * Env: CUSTOMER_URL (default http://localhost:3001), TEST_CUSTOMER_PHONE (default 9999000002)
 */
import { chromium } from 'playwright';

const baseUrl = process.env.CUSTOMER_URL || 'http://localhost:3001';
const phone = process.env.TEST_CUSTOMER_PHONE || '9999000002';
const waitMs = Number(process.env.MEASURE_WAIT_MS || 25000);

function isApiGet(url, method) {
  if (method !== 'GET') return false;
  if (/_next|favicon|\.js|\.css|\.woff|\.png|\.jpeg|\.svg|runtime-config/.test(url)) return false;
  return (
    url.includes('execute-api') ||
    url.includes('amazonaws.com') ||
    url.includes('/api/customer/') ||
    url.includes('/customer/') ||
    url.includes('/config/') ||
    url.includes('/products') ||
    url.includes('/chat/')
  );
}

function classify(url) {
  if (url.includes('/customer/profile/unified')) return 'profile_unified';
  if (url.includes('/customer/profile?') || /\/customer\/profile(?:\?|$)/.test(url.split('?')[0] + (url.includes('?') ? '?' : ''))) {
    if (url.includes('/customer/profile/unified')) return 'profile_unified';
    if (url.match(/\/customer\/profile\?/) || url.endsWith('/customer/profile')) return 'profile';
  }
  if (url.includes('/customer/profile')) return 'profile_other';
  if (url.includes('/customer/pets/')) return 'pets';
  return 'other';
}

function countByClass(log) {
  const out = { profile_unified: 0, profile: 0, profile_other: 0, pets: 0, other: 0, total_api_get: 0 };
  for (const e of log) {
    if (!isApiGet(e.url, e.method)) continue;
    out.total_api_get++;
    const c = classify(e.url);
    out[c] = (out[c] || 0) + 1;
  }
  return out;
}

const token = `uat-token-customer-${phone}-${Date.now()}`;

const sessionSeed = {
  phone,
  token,
  customerData: JSON.stringify({
    id: '00000000-0000-4000-8000-000000000002',
    phone,
    firstName: 'Measure',
    name: 'Measure User',
    onboarding_status: 'COMPLETED',
    profile_completed: true,
    onboardingComplete: true,
  }),
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addInitScript((seed) => {
  localStorage.setItem('customerPhone', seed.phone);
  localStorage.setItem('authToken', seed.token);
  localStorage.setItem('profile_completed', 'true');
  localStorage.setItem('onboarding_completed', 'true');
  localStorage.setItem('customerOnboardingComplete', 'true');
  localStorage.setItem('customerData', seed.customerData);
}, sessionSeed);

const page = await context.newPage();

const log = [];
const allRequests = [];
page.on('request', (req) => {
  const url = req.url();
  const method = req.method();
  allRequests.push({ url: url.slice(0, 200), method });
  if (isApiGet(url, method)) {
    log.push({ url, method, t: Date.now() });
  }
});

await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });

log.length = 0;
const t0 = Date.now();
await page.reload({ waitUntil: 'networkidle', timeout: 120000 }).catch(() =>
  page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 })
);
await page.waitForTimeout(waitMs);

const finalUrl = page.url();
const storageSnap = await page.evaluate(() => ({
  phone: localStorage.getItem('customerPhone'),
  hasToken: !!localStorage.getItem('authToken'),
  profileCompleted: localStorage.getItem('profile_completed'),
}));

const counts = countByClass(log);
const profileTotal = counts.profile_unified + counts.profile + counts.profile_other;

console.log(
  JSON.stringify(
    {
      baseUrl,
      phone,
      waitMs,
      elapsedMs: Date.now() - t0,
      counts: {
        total_api_get: counts.total_api_get,
        profile_unified: counts.profile_unified,
        profile_query: counts.profile,
        profile_other: counts.profile_other,
        profile_all: profileTotal,
        pets: counts.pets,
        other: counts.other,
      },
      finalUrl,
      storageSnap,
      requestMethodCounts: allRequests.reduce((acc, r) => {
        acc[r.method] = (acc[r.method] || 0) + 1;
        return acc;
      }, {}),
      nonStaticRequestSample: allRequests
        .filter((r) => !/_next|webpack|favicon|\.css|\.js\?/.test(r.url))
        .slice(0, 40),
      allGetUrls: log.map((e) => e.url),
      sampleUrls: log
        .filter((e) => classify(e.url) !== 'other')
        .slice(0, 30)
        .map((e) => e.url),
    },
    null,
    2
  )
);

await browser.close();
