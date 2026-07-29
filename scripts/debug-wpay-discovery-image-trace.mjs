/**
 * Runtime trace: Appointment Discovery vendor image for Bindu Vet Clinic (or first provider).
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

function parseDebugLog(text) {
  const prefix = '[WPayDiscoveryImageDebug]';
  const idx = text.indexOf(prefix);
  if (idx < 0) return null;
  const jsonPart = text.slice(idx + prefix.length).trim();
  try {
    return JSON.parse(jsonPart);
  } catch {
    return { raw: jsonPart };
  }
}

async function main() {
  const imageDebugLogs = [];
  const apiResponses = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: devices['iPhone 13'].viewport });
  const page = await context.newPage();

  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('/customer/warmpawz-appointments/discovery/by-category')) return;
    try {
      const body = await response.json();
      apiResponses.push({ url, status: response.status(), body });
    } catch {
      /* ignore */
    }
  });

  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[WPayDiscoveryImageDebug]')) {
      const parsed = parseDebugLog(text);
      if (parsed) imageDebugLogs.push({ type: msg.type(), ...parsed });
    }
  });

  await login(page);

  const vetCare = page.getByRole('button', { name: /Vet Care/i }).first();
  await vetCare.click({ timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /^Book Appointment$/i }).first().click({ timeout: 15000 });
  await page.waitForSelector('[data-slot="card"]', { timeout: 45000 });
  await page.waitForTimeout(3000);

  const domReport = await page.evaluate(() => {
    const card = document.querySelector('[data-slot="card"]');
    if (!card) return { error: 'no card found' };
    const title = card.querySelector('[data-slot="vendor-name"]')?.textContent?.trim() ?? null;
    const img = card.querySelector('img[alt]');
    const fallback = card.querySelector('[role="img"][aria-label*="Avatar"]');
    return {
      cardTitle: title,
      hasImgElement: !!img,
      imgSrc: img?.getAttribute('src') ?? null,
      imgAlt: img?.getAttribute('alt') ?? null,
      fallbackInitial: fallback?.textContent?.trim() ?? null,
      fallbackAriaLabel: fallback?.getAttribute('aria-label') ?? null,
      showingFallbackAvatar: !img && !!fallback,
    };
  });

  const firstApi = apiResponses[0]?.body ?? null;
  let firstVendorFromApi = null;
  if (firstApi) {
    const list =
      firstApi.vendors ??
      firstApi.data?.vendors ??
      firstApi.cards ??
      firstApi.data?.cards ??
      [];
    if (Array.isArray(list) && list.length > 0) {
      firstVendorFromApi =
        list.find((v) => /bindu vet clinic/i.test(String(v.name ?? ''))) ?? list[0];
    }
  }

  const IMAGE_KEYS = [
    'photo',
    'photoUrl',
    'photo_url',
    'profilePhotoUrl',
    'profile_photo_url',
    'profileImageUrl',
    'profile_image',
    'profileImage',
    'logoUrl',
    'logo_url',
    'avatarUrl',
    'avatar_url',
    'thumbnailUrl',
    'thumbnail_url',
    'imageUrl',
    'image_url',
  ];

  const apiImageFields = {};
  if (firstVendorFromApi) {
    for (const k of IMAGE_KEYS) {
      if (firstVendorFromApi[k] != null && firstVendorFromApi[k] !== '') {
        apiImageFields[k] = firstVendorFromApi[k];
      }
    }
  }

  const report = {
    capturedAt: new Date().toISOString(),
    baseUrl: BASE,
    domReport,
    networkApi: {
      url: apiResponses[0]?.url ?? null,
      status: apiResponses[0]?.status ?? null,
      firstVendorName: firstVendorFromApi?.name ?? null,
      firstVendorFullRow: firstVendorFromApi,
      imageFields: apiImageFields,
    },
    consoleTrace: imageDebugLogs,
    stagesInOrder: imageDebugLogs.map((l) => l.stage),
  };

  const outFile = path.join(OUT, 'discovery-image-trace-report.json');
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log('Wrote', outFile);
  console.log(JSON.stringify(report, null, 2));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
