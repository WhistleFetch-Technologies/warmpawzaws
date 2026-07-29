/**
 * Capture runtime [WPayVendorCardCtaDebug] console logs + DOM verification from live Appointment Discovery.
 */
import { chromium, devices } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'screenshots', 'runtime-debug');
const BASE = process.env.CUSTOMER_WEB_URL || 'http://localhost:3001';
const PHONE = process.env.UAT_PHONE || '9876543210';
const OTP = '123456';
const UAT_PASSWORD = process.env.UAT_PASSWORD || 'TestPass123!';

fs.mkdirSync(OUT, { recursive: true });

async function completeSetPasswordIfNeeded(page) {
  if (!page.url().includes('/auth/set-password')) return;
  const passwordInputs = page.locator('input[type="password"]');
  const count = await passwordInputs.count();
  if (count >= 2) {
    await passwordInputs.nth(0).fill(UAT_PASSWORD);
    await passwordInputs.nth(1).fill(UAT_PASSWORD);
  }
  await page.getByRole('button', { name: /Save & continue/i }).click();
  await page.waitForTimeout(3000);
}

async function login(page) {
  await page.goto(`${BASE}/auth`, { waitUntil: 'networkidle', timeout: 120000 });
  const signupLink = page.getByRole('button', { name: /New user\? Sign up/i });
  if (await signupLink.isVisible().catch(() => false)) await signupLink.click();
  await page.locator('input[type="tel"]').fill(PHONE);
  await page.getByRole('button', { name: /Send Verification Code/i }).click();
  await page.waitForTimeout(2000);
  await page.getByPlaceholder('Enter 6-digit code').fill(OTP);
  await page.getByRole('button', { name: /Verify & Continue/i }).click();
  await page.waitForTimeout(2000);
  await completeSetPasswordIfNeeded(page);
  await page.evaluate(() => {
    sessionStorage.setItem('warmpawz_ecommerce_launch_popup_seen', '1');
    localStorage.setItem('profile_completed', 'true');
    localStorage.setItem('onboarding_completed', 'true');
    localStorage.setItem('customerOnboardingComplete', 'true');
  });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2000);
}

async function openDiscovery(page) {
  const vetCare = page.getByRole('button', { name: /Vet Care/i }).first();
  await vetCare.click({ timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /^Book Appointment$/i }).first().click({ timeout: 15000 });
  await page.waitForSelector('[data-slot="card"]', { timeout: 45000 });
  await page.waitForTimeout(2000);
}

async function main() {
  const debugLogs = [];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: devices['iPhone 13'].viewport });
  const page = await context.newPage();

  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[WPayVendorCardCtaDebug]')) {
      debugLogs.push({ type: msg.type(), text });
    }
  });

  await login(page);
  await openDiscovery(page);

  const domReport = await page.evaluate(() => {
    const card = document.querySelector('[data-slot="card"]');
    if (!card) return { error: 'no card found' };

    const ctaButtons = card.querySelectorAll('[data-slot="cta-icon-slot"]');
    const actionButtons = Array.from(card.querySelectorAll('button')).filter((btn) => {
      const t = btn.textContent || '';
      return t.includes('Book Appointment') || t.includes('Pay with Warmpawz');
    });

    return {
      cardFound: true,
      iconSlots: ctaButtons.length,
      iconSlotsWithSvg: Array.from(ctaButtons).filter((el) => el.querySelector('svg')).length,
      actionButtons: actionButtons.map((btn) => ({
        text: btn.textContent?.trim(),
        hasReserveSubtitle: btn.textContent?.includes('Reserve your slot') ?? false,
        hasDiscountSubtitle: btn.textContent?.includes('Get discount') ?? false,
        svgCount: btn.querySelectorAll('svg').length,
        iconSlotPresent: !!btn.querySelector('[data-slot="cta-icon-slot"]'),
        iconSlotHasSvg: !!btn.querySelector('[data-slot="cta-icon-slot"] svg'),
      })),
    };
  });

  const report = {
    capturedAt: new Date().toISOString(),
    debugLogCount: debugLogs.length,
    debugLogs: debugLogs.map((l) => {
      try {
        const json = l.text.replace('[WPayVendorCardCtaDebug] ', '');
        return JSON.parse(json);
      } catch {
        return { raw: l.text };
      }
    }),
    domReport,
  };

  const logFile = path.join(OUT, 'cta-action-runtime-report.json');
  fs.writeFileSync(logFile, JSON.stringify(report, null, 2));
  console.log(`Report written → ${logFile}`);
  console.log(JSON.stringify(report, null, 2));

  await page.locator('[data-slot="card"]').first().screenshot({
    path: path.join(OUT, 'discovery-card-at-log-time.png'),
  });

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
