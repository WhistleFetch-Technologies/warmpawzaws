/**
 * Inspect first CTA — red boxes + 3x device scale screenshot.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'screenshots', 'runtime-debug', 'first-cta-inspect');
const BASE = process.env.CUSTOMER_WEB_URL || 'http://localhost:3001';
const PHONE = process.env.UAT_PHONE || '9876543210';
const OTP = '123456';
const UAT_PASSWORD = process.env.UAT_PASSWORD || 'TestPass123!';

fs.mkdirSync(OUT, { recursive: true });

async function completeSetPasswordIfNeeded(page) {
  if (!page.url().includes('/auth/set-password')) return;
  const inputs = page.locator('input[type="password"]');
  if ((await inputs.count()) >= 2) {
    await inputs.nth(0).fill(UAT_PASSWORD);
    await inputs.nth(1).fill(UAT_PASSWORD);
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
  await page.getByRole('button', { name: /Vet Care/i }).first().click({ timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /^Book Appointment$/i }).first().click({ timeout: 15000 });
  await page.waitForSelector('[data-slot="card"]', { timeout: 45000 });
  await page.waitForTimeout(2000);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();

  await login(page);
  await openDiscovery(page);

  const firstCta = page
    .locator('[data-slot="card"]')
    .first()
    .locator('button')
    .filter({ hasText: 'Book Appointment' })
    .first();

  await firstCta.scrollIntoViewIfNeeded();

  const findings = await page.evaluate(() => {
    const RED = '4px solid red';
    const card = document.querySelector('[data-slot="card"]');
    const cta = Array.from(card?.querySelectorAll('button') || []).find((b) =>
      (b.textContent || '').includes('Book Appointment'),
    );
    if (!cta) return { error: 'no cta' };

    const iconSlot = cta.querySelector('[data-slot="cta-icon-slot"]');
    const svg = iconSlot?.querySelector('svg');
    const subtitleEl = Array.from(cta.querySelectorAll('span')).find(
      (el) => el.textContent?.trim() === 'Reserve your slot',
    );

    if (iconSlot) {
      iconSlot.style.outline = RED;
      iconSlot.style.outlineOffset = '1px';
    }
    if (subtitleEl) {
      subtitleEl.style.outline = RED;
      subtitleEl.style.outlineOffset = '1px';
    }

    const cs = (el) => (el ? getComputedStyle(el) : null);
    const r = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    };

    const svgRect = r(svg);
    const subRect = r(subtitleEl);

    let whyIconNotVisible = null;
    let whySubtitleNotVisible = null;

    if (!svg) whyIconNotVisible = 'SVG element missing inside [data-slot="cta-icon-slot"]';
    else if (svgRect.w === 0 || svgRect.h === 0) whyIconNotVisible = `SVG bounding box is zero (${JSON.stringify(svgRect)})`;
    else if (cs(svg).visibility === 'hidden') whyIconNotVisible = 'SVG visibility:hidden';
    else if (cs(svg).opacity === '0') whyIconNotVisible = 'SVG opacity:0';

    if (!subtitleEl) whySubtitleNotVisible = 'Subtitle span with text "Reserve your slot" not found';
    else if (subRect.w === 0 || subRect.h === 0) whySubtitleNotVisible = `Subtitle bounding box is zero (${JSON.stringify(subRect)})`;
    else if (cs(subtitleEl).visibility === 'hidden') whySubtitleNotVisible = 'Subtitle visibility:hidden';
    else if (cs(subtitleEl).opacity === '0') whySubtitleNotVisible = 'Subtitle opacity:0';

    return {
      iconVisible: !whyIconNotVisible,
      subtitleVisible: !whySubtitleNotVisible,
      whyIconNotVisible,
      whySubtitleNotVisible,
      svg: { rect: svgRect, stroke: cs(svg)?.stroke, opacity: cs(svg)?.opacity },
      subtitle: { rect: subRect, text: subtitleEl?.textContent?.trim(), color: cs(subtitleEl)?.color, fontSize: cs(subtitleEl)?.fontSize, opacity: cs(subtitleEl)?.opacity },
      iconSlot: { rect: r(iconSlot) },
    };
  });

  fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify(findings, null, 2));

  await firstCta.screenshot({
    path: path.join(OUT, 'first-cta-300pct-zoom-red-boxes.png'),
  });

  await browser.close();
  console.log(JSON.stringify(findings, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
