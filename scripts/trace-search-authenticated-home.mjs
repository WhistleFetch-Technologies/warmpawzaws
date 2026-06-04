#!/usr/bin/env node
/**
 * Authenticated customer home: trace upstream search → router.push.
 * Seeds UAT session (same pattern as apps/customer-web/scripts/smoke-home-ui.mjs).
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const TARGET =
  /Vet near me|Dog doctor|Cat doctor|Pet clinic|Animal hospital/i;
const TARGET_FULL =
  'Vet near me, Dog doctor, Cat doctor, Pet clinic, Animal hospital';

const baseUrl = process.env.CUSTOMER_URL || 'http://localhost:3001';
const phone = process.env.TEST_CUSTOMER_PHONE || '9999000002';
const waitMs = Number(process.env.SMOKE_WAIT_MS || 20000);
const customerId = process.env.TEST_CUSTOMER_ID || '00000000-0000-4000-8000-000000000002';

const token = `uat-token-customer-${phone}-${Date.now()}`;
const sessionSeed = {
  phone,
  token,
  customerData: JSON.stringify({
    id: customerId,
    phone,
    firstName: 'Trace',
    name: 'Search Trace',
    onboarding_status: 'COMPLETED',
    profile_completed: true,
    onboardingComplete: true,
  }),
};

function collectTraceLogs(text) {
  return (
    text.includes('[search-trace-upstream]') ||
    text.includes('[search-trace]') ||
    TARGET.test(text)
  );
}

async function main() {
  const report = {
    baseUrl,
    phone,
    customerId,
    scenarios: [],
    repoNote:
      'Comma taxonomy string is not built in customer-web source; upstream trace shows what EnhancedSearchBar passes to onSearch.',
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
    localStorage.removeItem('warmpawz_recent_searches');
    localStorage.removeItem('warmpawz_search_context');
  }, sessionSeed);

  const page = await context.newPage();
  const traceLogs = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (collectTraceLogs(text)) traceLogs.push(text);
  });

  console.log('=== Authenticated home load ===');
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(waitMs);

  const afterHome = await page.evaluate(() => {
    const storage = {};
    for (const k of Object.keys(localStorage)) {
      if (/search|warmpawz/i.test(k)) storage[k] = localStorage.getItem(k);
    }
    const inputs = [...document.querySelectorAll('input[type="text"], input[type="search"]')].map(
      (el) => ({
        value: el.value,
        placeholder: el.getAttribute('placeholder'),
      })
    );
    return { href: window.location.href, storage, inputs, bodyHasSearch: /Search/i.test(document.body.innerText) };
  });

  const homeScenario = {
    name: 'authenticated-home-cold',
    url: afterHome.href,
    onAuth: afterHome.href.includes('/auth'),
    inputs: afterHome.inputs,
    storage: afterHome.storage,
    traceLogs: traceLogs.slice(),
    targetHits: traceLogs.filter((l) => TARGET.test(l)),
  };
  report.scenarios.push(homeScenario);

  console.log('finalUrl:', afterHome.href);
  console.log('onAuth:', homeScenario.onAuth);
  console.log('search inputs:', JSON.stringify(afterHome.inputs.filter((i) => /search|service|vet/i.test(i.placeholder || '')), null, 2));

  if (!homeScenario.onAuth) {
    const searchInput = page.locator('input').filter({ has: page.locator('xpath=..') }).first();
    const inputs = page.locator('input[type="text"], input[type="search"]');
    const count = await inputs.count();
    let searchLike = null;
    for (let i = 0; i < count; i++) {
      const ph = await inputs.nth(i).getAttribute('placeholder');
      if (ph && /search|service|vet|groom/i.test(ph)) {
        searchLike = inputs.nth(i);
        break;
      }
    }
    if (searchLike) {
      const val = await searchLike.inputValue();
      const ph = await searchLike.getAttribute('placeholder');
      console.log('Search-like input value:', JSON.stringify(val), 'placeholder:', ph);
      traceLogs.length = 0;
      await searchLike.click();
      await page.waitForTimeout(800);
      const submitBtn = page.getByRole('button', { name: /^Search$/i }).first();
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(3000);
      }
      const afterSubmit = await page.evaluate(() => ({
        href: window.location.href,
        inputValues: [...document.querySelectorAll('input')].map((el) => ({
          value: el.value,
          placeholder: el.getAttribute('placeholder'),
        })),
      }));
      report.scenarios.push({
        name: 'empty-submit-then-nav',
        url: afterSubmit.href,
        inputValues: afterSubmit.inputValues,
        traceLogs: traceLogs.slice(),
        targetHits: traceLogs.filter((l) => TARGET.test(l)),
      });
      console.log('After empty submit url:', afterSubmit.href);
    }

    // Inject recent search then click it (simulates polluted history path)
    traceLogs.length = 0;
    await page.evaluate((q) => {
      localStorage.setItem('warmpawz_recent_searches', JSON.stringify([q]));
    }, TARGET_FULL);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(waitMs);
    const recentBtn = page.getByRole('button').filter({ hasText: /Vet near me/i }).first();
    if (await recentBtn.isVisible().catch(() => false)) {
      await recentBtn.click();
      await page.waitForTimeout(4000);
      report.scenarios.push({
        name: 'recent-search-click',
        url: page.url(),
        traceLogs: traceLogs.slice(),
        targetHits: traceLogs.filter((l) => TARGET.test(l)),
      });
      console.log('After recent click url:', page.url());
      for (const line of traceLogs.filter((l) => l.includes('router.push') || l.includes('handleSearchSubmit'))) {
        console.log(line.slice(0, 400));
      }
    }
  }

  const out = 'scripts/trace-search-authenticated-home-report.json';
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log('\nWrote', out);
  console.log(
    'Upstream TARGET hits:',
    report.scenarios.flatMap((s) => s.targetHits || []).length
  );

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
