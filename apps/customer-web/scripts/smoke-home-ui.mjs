/**
 * Smoke test: new customer home UI with seeded UAT session.
 * Usage: node scripts/smoke-home-ui.mjs
 * Requires dev server on :3001 and NEXT_PUBLIC_NEW_HOME_UI=true at dev start.
 */
import { chromium } from 'playwright';

const baseUrl = process.env.CUSTOMER_URL || 'http://localhost:3001';
const phone = process.env.TEST_CUSTOMER_PHONE || '9999000002';
const waitMs = Number(process.env.SMOKE_WAIT_MS || 15000);

const token = `uat-token-customer-${phone}-${Date.now()}`;
const sessionSeed = {
  phone,
  token,
  customerData: JSON.stringify({
    id: '00000000-0000-4000-8000-000000000002',
    phone,
    firstName: 'Smoke',
    name: 'Smoke Test',
    onboarding_status: 'COMPLETED',
    profile_completed: true,
    onboardingComplete: true,
  }),
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.addInitScript((seed) => {
  localStorage.setItem('customerPhone', seed.phone);
  localStorage.setItem('authToken', seed.token);
  localStorage.setItem('profile_completed', 'true');
  localStorage.setItem('onboarding_completed', 'true');
  localStorage.setItem('customerOnboardingComplete', 'true');
  localStorage.setItem('customerData', seed.customerData);
}, sessionSeed);

const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];

page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => pageErrors.push(String(err)));

await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(waitMs);

const finalUrl = page.url();
const bodyText = await page.locator('body').innerText().catch(() => '');
const checks = {
  stayedOnHome: finalUrl.startsWith(baseUrl) && !finalUrl.includes('/auth'),
  hasPopularServices: /Popular Services/i.test(bodyText),
  hasPetStrip: /Add Your Pet/i.test(bodyText),
  hasDiscoverSection: /Trending Now|For you/i.test(bodyText),
  noErrorBoundary: !/Something went wrong|Application error/i.test(bodyText),
  notStuckLoading: !/^Loading\.\.\.$/m.test(bodyText.trim()),
};

const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
const criticalConsole = consoleErrors.filter(
  (e) => !/favicon|404|Failed to load resource|hydration/i.test(e)
);

console.log(
  JSON.stringify(
    {
      ok: failed.length === 0 && pageErrors.length === 0,
      baseUrl,
      phone,
      waitMs,
      finalUrl,
      checks,
      failed,
      pageErrors,
      consoleErrorCount: consoleErrors.length,
      criticalConsoleErrors: criticalConsole.slice(0, 10),
      bodyPreview: bodyText.slice(0, 500).replace(/\s+/g, ' ').trim(),
    },
    null,
    2
  )
);

await browser.close();
process.exit(failed.length === 0 && pageErrors.length === 0 ? 0 : 1);
