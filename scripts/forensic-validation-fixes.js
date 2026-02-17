#!/usr/bin/env node
/**
 * Forensic validation for recent fixes:
 * 1. Refund on cancellation uses refund policy only (no payment policy)
 * 2. Featured vendors endpoint + customer home block
 * 3. Banner click tracking route
 * 4. Wallet → Rewards & Referral links
 * 5. CustomerHomeWrapper allowedServiceStyles type
 *
 * Usage: node scripts/forensic-validation-fixes.js
 * With live API: API_URL=https://your-api node scripts/forensic-validation-fixes.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;

function ok(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}${detail ? ` – ${detail}` : ''}`);
    return true;
  }
  failed++;
  console.log(`  ❌ ${name}${detail ? ` – ${detail}` : ''}`);
  return false;
}

function readFile(relPath) {
  const full = path.join(ROOT, relPath);
  try {
    return fs.readFileSync(full, 'utf8');
  } catch (e) {
    return '';
  }
}

// ---------- 1. Refund on cancellation: refund policy only ----------
function validateRefundOnCancel() {
  console.log('\n1. Refund on cancellation uses REFUND policy only (no payment policy)');
  const bookingsEnhanced = readFile('backend/lambda/src/endpoints/bookings-enhanced.ts');
  const cancelBlock = (() => {
    const start = bookingsEnhanced.indexOf('Process refund if payment was made');
    if (start === -1) return '';
    const end = bookingsEnhanced.indexOf('Publish event', start);
    return end === -1 ? bookingsEnhanced.slice(start, start + 4000) : bookingsEnhanced.slice(start, end);
  })();

  ok('Cancel handler imports getRefundTierForCancellation', bookingsEnhanced.includes('getRefundTierForCancellation'));
  ok('Cancel handler imports computeRefundFromTier', bookingsEnhanced.includes('computeRefundFromTier'));
  ok('Cancel block uses getRefundTierForCancellation', cancelBlock.includes('getRefundTierForCancellation'));
  ok('Cancel block uses computeRefundFromTier', cancelBlock.includes('computeRefundFromTier'));
  ok('Cancel block mentions refund policy / vendor_refund_tiers', cancelBlock.includes('refund policy') || cancelBlock.includes('vendor_refund_tiers'));
  ok('No resolvePaymentPolicy in cancel flow', !cancelBlock.includes('resolvePaymentPolicy'));
  ok('No payment_policy in cancel flow', !cancelBlock.includes('payment_policy') && !cancelBlock.includes('paymentPolicy'));
}

// ---------- 2. Featured vendors ----------
function validateFeaturedVendors() {
  console.log('\n2. Featured vendors endpoint + customer home block');
  const customerContent = readFile('backend/lambda/src/endpoints/customer-content.ts');
  const handlerIndex = readFile('backend/lambda/src/handler/index.ts');
  const home = readFile('apps/customer-web/components/customer/CustomerHomeComplete.tsx');

  ok('Backend: GET /customer/featured-vendors exists', customerContent.includes('"/customer/featured-vendors"') || customerContent.includes("'/customer/featured-vendors'"));
  ok('Backend: queries spotlight_offers', customerContent.includes('spotlight_offers'));
  ok('Backend: returns success, vendors, total', customerContent.includes('success: true') && customerContent.includes('vendors') && customerContent.includes('total'));
  ok('Handler registers customer content', handlerIndex.includes('registerCustomerContentEndpoints'));
  ok('Customer home: featuredVendors state', home.includes('featuredVendors'));
  ok('Customer home: fetch featured-vendors in loadDynamicContent', home.includes("featured-vendors"));
  ok('Customer home: Featured providers section when featuredVendors.length > 0', home.includes('Featured providers') && home.includes('featuredVendors.length > 0'));
  ok('Customer home: onNavigate(ctaLink', home.includes('onNavigate') && (home.includes('ctaLink') || home.includes('v.ctaLink')));
}

// ---------- 3. Banner click tracking ----------
function validateBannerClick() {
  console.log('\n3. Banner click tracking');
  const governance = readFile('backend/lambda/src/endpoints/admin-governance-enhanced.ts');
  const handlerIndex = readFile('backend/lambda/src/handler/index.ts');
  const home = readFile('apps/customer-web/components/customer/CustomerHomeComplete.tsx');

  ok('Customer: POST /banners/:id/click on banner', home.includes('banners/') && home.includes('/click'));
  ok('Backend: POST /banners/:id/click route', governance.includes("'/banners/:id/click'") || governance.includes('"/banners/:id/click"'));
  ok('Backend: banner_clicks or click_count', governance.includes('banner_clicks') || governance.includes('click_count'));
  ok('Handler registers admin governance enhanced', handlerIndex.includes('registerAdminGovernanceEnhancedEndpoints'));
}

// ---------- 4. Wallet → Rewards & Referral ----------
function validateWalletRewards() {
  console.log('\n4. Wallet → Rewards & Referral links');
  const customerWallet = readFile('apps/customer-web/components/customer/CustomerWallet.tsx');

  ok('CustomerWallet: rewards-loyalty navigation', customerWallet.includes('rewards-loyalty') || customerWallet.includes("'rewards-loyalty'"));
  ok('CustomerWallet: referral-system navigation', customerWallet.includes('referral-system') || customerWallet.includes("'referral-system'"));
  ok('CustomerWallet: Rewards & points label', customerWallet.includes('Rewards') && customerWallet.includes('points'));
  ok('CustomerWallet: Refer & Earn or referrals', customerWallet.includes('Refer') || customerWallet.includes('referral'));
}

// ---------- 5. allowedServiceStyles type ----------
function validateAllowedServiceStylesType() {
  console.log('\n5. CustomerHomeWrapper allowedServiceStyles type');
  const wrapper = readFile('apps/customer-web/components/customer/wrappers/CustomerHomeWrapper.tsx');

  ok('allowedServiceStyles cast to at_home|at_center|tele', wrapper.includes("'at_home' | 'at_center' | 'tele'") && wrapper.includes('allowedServiceStyles'));
}

// ---------- Optional: Live API tests ----------
async function runOptionalApiTests() {
  const base = process.env.API_URL || process.env.API_BASE_URL;
  if (!base) {
    console.log('\n(Optional) Set API_URL or API_BASE_URL to run live API checks.');
    return;
  }
  console.log('\n--- Optional live API tests ---');
  const baseUrl = base.replace(/\/$/, '');

  // GET /customer/featured-vendors
  try {
    const res = await fetch(`${baseUrl}/customer/featured-vendors?limit=6`);
    const body = res.ok ? await res.json() : null;
    ok('GET /customer/featured-vendors returns 200', res.status === 200, `status=${res.status}`);
    if (body && res.status === 200) {
      ok('Response has success and vendors', body.success === true && Array.isArray(body.vendors), '');
    }
  } catch (e) {
    ok('GET /customer/featured-vendors reachable', false, e.message || 'fetch failed');
  }

  // POST /banners/:id/click (use a dummy UUID; expect 200 or 404)
  try {
    const res = await fetch(`${baseUrl}/banners/00000000-0000-0000-0000-000000000001/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'forensic-test' }),
    });
    ok('POST /banners/:id/click route exists (200 or 404)', res.status === 200 || res.status === 404, `status=${res.status}`);
  } catch (e) {
    ok('POST /banners/:id/click reachable', false, e.message || 'fetch failed');
  }
}

// ---------- Main ----------
async function main() {
  console.log('═'.repeat(72));
  console.log('FORENSIC VALIDATION – Recent fixes (code-path + optional API)');
  console.log('═'.repeat(72));

  validateRefundOnCancel();
  validateFeaturedVendors();
  validateBannerClick();
  validateWalletRewards();
  validateAllowedServiceStylesType();
  await runOptionalApiTests();

  console.log('\n' + '═'.repeat(72));
  console.log(`Result: ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(72) + '\n');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
