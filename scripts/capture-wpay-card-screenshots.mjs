/**
 * One-off PR-12 visual capture — Pay Hub + Appointment Discovery vendor cards.
 * Usage: node scripts/capture-wpay-card-screenshots.mjs
 */
import { chromium, devices } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'screenshots', 'pr-12');
const BASE = process.env.CUSTOMER_WEB_URL || 'http://localhost:3001';
const PHONE = process.env.UAT_PHONE || '9876543210';
const OTP = '123456';

fs.mkdirSync(OUT_DIR, { recursive: true });

async function seedOnboardingFlags(page) {
  await page.evaluate(() => {
    localStorage.setItem('profile_completed', 'true');
    localStorage.setItem('onboarding_completed', 'true');
    localStorage.setItem('customerOnboardingComplete', 'true');
    sessionStorage.setItem('warmpawz_ecommerce_launch_popup_seen', '1');
  });
}

async function dismissPopups(page) {
  for (const label of [/No, thanks/i, /Maybe later/i, /Close/i]) {
    const btn = page.getByRole('button', { name: label }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(500);
    }
  }
}

const UAT_PASSWORD = process.env.UAT_PASSWORD || 'TestPass123!';

async function completeSetPasswordIfNeeded(page) {
  if (!page.url().includes('/auth/set-password')) return;

  const passwordInputs = page.locator('input[type="password"]');
  const count = await passwordInputs.count();
  if (count >= 2) {
    await passwordInputs.nth(0).fill(UAT_PASSWORD);
    await passwordInputs.nth(1).fill(UAT_PASSWORD);
  } else if (count === 1) {
    await passwordInputs.first().fill(UAT_PASSWORD);
  }

  await page.getByRole('button', { name: /Save & continue/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/auth/set-password'), { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

async function uatSignupLogin(page) {
  await page.goto(`${BASE}/auth`, { waitUntil: 'networkidle', timeout: 120_000 });

  const signupLink = page.getByRole('button', { name: /New user\? Sign up/i });
  if (await signupLink.isVisible().catch(() => false)) {
    await signupLink.click();
  }

  await page.locator('input[type="tel"]').fill(PHONE);
  await page.getByRole('button', { name: /Send Verification Code/i }).click();
  await page.waitForTimeout(2000);

  const otpInput = page.getByPlaceholder('Enter 6-digit code');
  await otpInput.waitFor({ state: 'visible', timeout: 20_000 });
  await otpInput.fill(OTP);
  await page.getByRole('button', { name: /Verify & Continue/i }).click();
  await page.waitForURL(/\/(auth\/set-password|profile|onboarding|\?|$)/, { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(2000);

  await completeSetPasswordIfNeeded(page);
  await seedOnboardingFlags(page);

  if (!page.url().endsWith('/') && !page.url().match(/localhost:3001\/?$/)) {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 120_000 });
    await completeSetPasswordIfNeeded(page);
  }
  await page.waitForTimeout(3000);
}

async function openVetAppointmentDiscovery(page, debugPrefix) {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 120_000 });
  await completeSetPasswordIfNeeded(page);
  await seedOnboardingFlags(page);
  await page.waitForTimeout(2000);
  await dismissPopups(page);
  await screenshotPage(page, `${debugPrefix}-home`);

  const vetCare = page.getByRole('button', { name: /Vet Care/i }).first();
  await vetCare.scrollIntoViewIfNeeded();
  await vetCare.click({ timeout: 15_000 });
  await page.waitForTimeout(3000);
  await dismissPopups(page);
  await page.getByRole('heading', { name: /Veterinary Services|Choose Service/i }).first().waitFor({ timeout: 20_000 }).catch(() => {});
  await screenshotPage(page, `${debugPrefix}-vet-hub`);

  const bookAppt = page.getByRole('button', { name: /^Book Appointment$/i }).first();
  await bookAppt.scrollIntoViewIfNeeded();
  await bookAppt.click({ timeout: 30_000 });
  await page.getByRole('heading', { name: /^Book Appointment$/i }).waitFor({ timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(5000);
}

async function waitForVendorCard(page, timeoutMs = 45_000) {
  await page.waitForSelector('[data-slot="card"]', { timeout: timeoutMs });
  await page.waitForTimeout(1500);
}

async function screenshotPage(page, name) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`Saved ${file}`);
}

async function screenshotFirstCard(page, name) {
  const card = page.locator('[data-slot="card"]').first();
  if (await card.count()) {
    const file = path.join(OUT_DIR, `${name}.png`);
    await card.screenshot({ path: file });
    console.log(`Saved ${file}`);
  }
}

async function capturePayHub(browser) {
  for (const [label, viewport] of [
    ['pay-hub-desktop', { width: 1280, height: 900 }],
    ['pay-hub-mobile', devices['iPhone 13'].viewport],
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.goto(`${BASE}/warmpawz-pay`, { waitUntil: 'networkidle', timeout: 120_000 });
    await waitForVendorCard(page).catch(() => page.waitForTimeout(3000));
    await screenshotPage(page, label);
    await screenshotFirstCard(page, `${label}-card`);
    await context.close();
  }
}

async function captureAppointmentDiscovery(browser) {
  const context = await browser.newContext({ viewport: devices['iPhone 13'].viewport });
  const page = await context.newPage();
  await uatSignupLogin(page);
  await openVetAppointmentDiscovery(page, 'appointment-discovery-mobile');
  await waitForVendorCard(page);
  await screenshotPage(page, 'appointment-discovery-mobile');
  await screenshotFirstCard(page, 'appointment-discovery-mobile-card');
  await context.close();

  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const desktopPage = await desktopContext.newPage();
  await uatSignupLogin(desktopPage);
  await openVetAppointmentDiscovery(desktopPage, 'appointment-discovery-desktop');
  await waitForVendorCard(desktopPage);
  await screenshotPage(desktopPage, 'appointment-discovery-desktop');
  await screenshotFirstCard(desktopPage, 'appointment-discovery-desktop-card');
  await desktopContext.close();
}

async function main() {
  console.log(`Capturing to ${OUT_DIR}`);
  console.log(`Base URL: ${BASE}`);

  const browser = await chromium.launch({ headless: true });
  const only = process.env.CAPTURE_ONLY;
  try {
    if (!only || only === 'pay-hub') await capturePayHub(browser);
    if (!only || only === 'appointments') await captureAppointmentDiscovery(browser);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
