#!/usr/bin/env node
/** Authenticated home: click polluted recent search → router.push upstream trace */
import { chromium } from 'playwright';

const TARGET_FULL =
  'Vet near me, Dog doctor, Cat doctor, Pet clinic, Animal hospital';
const phone = process.env.TEST_CUSTOMER_PHONE || '9999000002';
const token = `uat-token-customer-${phone}-${Date.now()}`;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(
  (seed) => {
    localStorage.setItem('customerPhone', seed.phone);
    localStorage.setItem('authToken', seed.token);
    localStorage.setItem('profile_completed', 'true');
    localStorage.setItem('onboarding_completed', 'true');
    localStorage.setItem('customerOnboardingComplete', 'true');
    localStorage.setItem('customerData', seed.customerData);
    localStorage.setItem('warmpawz_recent_searches', JSON.stringify([seed.polluted]));
  },
  {
    phone,
    token,
    polluted: TARGET_FULL,
    customerData: JSON.stringify({
      id: '00000000-0000-4000-8000-000000000002',
      phone,
      onboardingComplete: true,
      profile_completed: true,
    }),
  }
);

const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => {
  const t = m.text();
  if (t.includes('search-trace')) logs.push(t);
});

await page.goto('http://localhost:3001/', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(15000);

const inp = page.locator('input[placeholder*="Search services"]').first();
await inp.click();
await page.waitForTimeout(1000);

const inputValBefore = await inp.inputValue();
console.log('Input value before recent click:', JSON.stringify(inputValBefore));

const recentBtn = page.getByRole('button').filter({ hasText: TARGET_FULL }).first();
const visible = await recentBtn.isVisible().catch(() => false);
console.log('Recent row visible:', visible);

if (visible) {
  await recentBtn.click();
  await page.waitForTimeout(5000);
}

console.log('URL:', page.url());
console.log('--- trace (recent click path) ---');
for (const l of logs.filter((x) => x.includes('upstream') || x.includes('recentSearch'))) {
  console.log(l.slice(0, 650));
}

await browser.close();
