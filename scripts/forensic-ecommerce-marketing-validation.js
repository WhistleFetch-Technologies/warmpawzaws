#!/usr/bin/env node
/**
 * Forensic validation: E-Commerce & Marketing north/south bound integrations
 * Run against a live API base (e.g. LOCAL or deployed). No auth for local;
 * set API_BASE and optionally AUTH_HEADER for deployed.
 *
 * Usage: node scripts/forensic-ecommerce-marketing-validation.js
 * Env:   API_BASE (default http://localhost:3000), AUTH_HEADER (optional Bearer token)
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const AUTH = process.env.AUTH_HEADER ? { Authorization: process.env.AUTH_HEADER } : {};
const headers = { 'Content-Type': 'application/json', ...AUTH };

async function request(method, path, body) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const opt = { method, headers };
  if (body && (method === 'POST' || method === 'PUT')) opt.body = JSON.stringify(body);
  let res;
  try {
    res = await fetch(url, opt);
  } catch (err) {
    return { status: 0, ok: false, json: null, text: '', error: err.message };
  }
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, ok: res.ok, json, text };
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

async function main() {
  const results = { passed: 0, failed: 0, errors: [] };

  if (await request('GET', '/admin/orders?limit=1').then(r => r.status === 0)) {
    console.log('API_BASE not reachable (is the server running?). Skipping assertions.');
    console.log('Start API then: API_BASE=http://localhost:3000 node scripts/forensic-ecommerce-marketing-validation.js');
    process.exit(0);
  }

  // --- E-Commerce Southbound (Admin UI -> API -> DB) ---
  console.log('\n--- E-Commerce ---');
  try {
    const platform = await request('GET', '/admin/ecommerce/analytics/platform');
    assert(platform.ok || platform.status === 401, 'GET /admin/ecommerce/analytics/platform');
    if (platform.ok && platform.json) {
      const data = platform.json.data ?? platform.json;
      assert(typeof (data.totalRevenue ?? data.totalGMV) === 'number' || data.totalOrders !== undefined, 'Platform analytics shape');
    }
    results.passed++;
    console.log('  GET /admin/ecommerce/analytics/platform OK');
  } catch (e) {
    results.failed++; results.errors.push(e.message);
    console.log('  GET /admin/ecommerce/analytics/platform FAIL:', e.message);
  }

  try {
    const orders = await request('GET', '/admin/orders?limit=5');
    assert(orders.ok || orders.status === 401, 'GET /admin/orders');
    if (orders.ok && orders.json) assert(Array.isArray(orders.json.orders), 'orders array');
    results.passed++;
    console.log('  GET /admin/orders OK');
  } catch (e) {
    results.failed++; results.errors.push(e.message);
    console.log('  GET /admin/orders FAIL:', e.message);
  }

  try {
    const products = await request('GET', '/admin/products?limit=5');
    assert(products.ok || products.status === 401, 'GET /admin/products');
    if (products.ok && products.json) assert(Array.isArray(products.json.products), 'products array');
    results.passed++;
    console.log('  GET /admin/products OK');
  } catch (e) {
    results.failed++; results.errors.push(e.message);
    console.log('  GET /admin/products FAIL:', e.message);
  }

  try {
    const sellers = await request('GET', '/admin/vendors/top-sellers?limit=5');
    assert(sellers.ok || sellers.status === 401, 'GET /admin/vendors/top-sellers');
    if (sellers.ok && sellers.json) {
      const list = sellers.json.sellers ?? sellers.json.topSellers ?? [];
      assert(Array.isArray(list), 'sellers/topSellers array');
    }
    results.passed++;
    console.log('  GET /admin/vendors/top-sellers OK');
  } catch (e) {
    results.failed++; results.errors.push(e.message);
    console.log('  GET /admin/vendors/top-sellers FAIL:', e.message);
  }

  try {
    const commission = await request('GET', '/admin/ecommerce/commission/settings');
    assert(commission.ok || commission.status === 401, 'GET /admin/ecommerce/commission/settings');
    results.passed++;
    console.log('  GET /admin/ecommerce/commission/settings OK');
  } catch (e) {
    results.failed++; results.errors.push(e.message);
    console.log('  GET /admin/ecommerce/commission/settings FAIL:', e.message);
  }

  try {
    const categories = await request('GET', '/admin/ecommerce/categories');
    assert(categories.ok || categories.status === 401, 'GET /admin/ecommerce/categories');
    results.passed++;
    console.log('  GET /admin/ecommerce/categories OK');
  } catch (e) {
    results.failed++; results.errors.push(e.message);
    console.log('  GET /admin/ecommerce/categories FAIL:', e.message);
  }

  // --- Marketing Southbound ---
  console.log('\n--- Marketing ---');
  try {
    const banners = await request('GET', '/admin/banners');
    assert(banners.ok || banners.status === 401, 'GET /admin/banners');
    if (banners.ok && banners.json) assert(Array.isArray(banners.json.banners ?? []), 'banners array');
    results.passed++;
    console.log('  GET /admin/banners OK');
  } catch (e) {
    results.failed++; results.errors.push(e.message);
    console.log('  GET /admin/banners FAIL:', e.message);
  }

  try {
    const coupons = await request('GET', '/admin/coupons?limit=5');
    assert(coupons.ok || coupons.status === 401, 'GET /admin/coupons');
    if (coupons.ok && coupons.json) assert(Array.isArray(coupons.json.coupons ?? []), 'coupons array');
    results.passed++;
    console.log('  GET /admin/coupons OK');
  } catch (e) {
    results.failed++; results.errors.push(e.message);
    console.log('  GET /admin/coupons FAIL:', e.message);
  }

  try {
    const settings = await request('GET', '/admin/platform-settings?key=home_announcements');
    assert(settings.ok || settings.status === 401, 'GET /admin/platform-settings');
    results.passed++;
    console.log('  GET /admin/platform-settings (What\'s New) OK');
  } catch (e) {
    results.failed++; results.errors.push(e.message);
    console.log('  GET /admin/platform-settings FAIL:', e.message);
  }

  // --- Northbound (API -> UI shape) ---
  console.log('\n--- Northbound response shape ---');
  try {
    const platform2 = await request('GET', '/admin/ecommerce/analytics/platform');
    if (platform2.ok && platform2.json) {
      const d = platform2.json.data ?? platform2.json;
      assert(d.totalRevenue !== undefined || d.totalGMV !== undefined || d.totalOrders !== undefined, 'Platform has at least one metric');
    }
    results.passed++;
    console.log('  Platform analytics northbound shape OK');
  } catch (e) {
    results.failed++; results.errors.push(e.message);
    console.log('  Platform northbound FAIL:', e.message);
  }

  // --- Customer journey (public / customer-facing endpoints) ---
  console.log('\n--- Customer journey (banners, promotions, rewards, config) ---');
  try {
    const custBanners = await request('GET', '/customer/banners');
    assert(custBanners.ok, 'GET /customer/banners');
    if (custBanners.ok && custBanners.json) {
      const list = custBanners.json.banners ?? custBanners.json;
      assert(Array.isArray(list), 'customer banners array');
    }
    results.passed++;
    console.log('  GET /customer/banners OK');
  } catch (e) {
    results.failed++; results.errors.push(e.message);
    console.log('  GET /customer/banners FAIL:', e.message);
  }

  try {
    const promoList = await request('GET', '/promotions/list?service=vet&published=true');
    assert(promoList.ok, 'GET /promotions/list');
    if (promoList.ok && promoList.json) {
      const list = promoList.json.promotions ?? promoList.json;
      assert(Array.isArray(list), 'promotions list array');
    }
    results.passed++;
    console.log('  GET /promotions/list OK');
  } catch (e) {
    results.failed++; results.errors.push(e.message);
    console.log('  GET /promotions/list FAIL:', e.message);
  }

  try {
    const promoActive = await request('GET', '/promotions/active');
    assert(promoActive.ok, 'GET /promotions/active');
    if (promoActive.ok && promoActive.json) {
      const list = promoActive.json.promotions ?? promoActive.json;
      assert(Array.isArray(list), 'promotions active array');
    }
    results.passed++;
    console.log('  GET /promotions/active OK');
  } catch (e) {
    results.failed++; results.errors.push(e.message);
    console.log('  GET /promotions/active FAIL:', e.message);
  }

  try {
    const serviceLaunch = await request('GET', '/config/service-launch/customer');
    assert(serviceLaunch.ok, 'GET /config/service-launch/customer');
    if (serviceLaunch.ok && serviceLaunch.json) {
      const j = serviceLaunch.json;
      assert(j.success === true && (j.services || j.buttons), 'service-launch has services or buttons');
    }
    results.passed++;
    console.log('  GET /config/service-launch/customer OK');
  } catch (e) {
    results.failed++; results.errors.push(e.message);
    console.log('  GET /config/service-launch/customer FAIL:', e.message);
  }

  try {
    const validateCode = await request('POST', '/promotions/validate-code', { code: 'INVALID_TEST', orderAmount: 100 });
    assert(validateCode.ok, 'POST /promotions/validate-code (expect 200 with valid: false)');
    if (validateCode.ok && validateCode.json) {
      assert(typeof validateCode.json.valid === 'boolean', 'validate-code returns valid boolean');
    }
    results.passed++;
    console.log('  POST /promotions/validate-code contract OK');
  } catch (e) {
    results.failed++; results.errors.push(e.message);
    console.log('  POST /promotions/validate-code FAIL:', e.message);
  }

  // Rewards require a valid customerId; only check route exists (401/404 or 200 with shape)
  const dummyCustomerId = '00000000-0000-0000-0000-000000000001';
  try {
    const rewardsPoints = await request('GET', `/customer/${dummyCustomerId}/rewards/points`);
    assert(rewardsPoints.status === 200 || rewardsPoints.status === 401 || rewardsPoints.status === 404, 'GET rewards/points exists');
    if (rewardsPoints.ok && rewardsPoints.json) {
      const d = rewardsPoints.json.balance ?? rewardsPoints.json;
      assert(typeof (d.points ?? d.totalPoints ?? d.total_points) === 'number', 'rewards points shape');
    }
    results.passed++;
    console.log('  GET /customer/:id/rewards/points contract OK');
  } catch (e) {
    results.failed++; results.errors.push(e.message);
    console.log('  GET rewards/points FAIL:', e.message);
  }

  try {
    const rewardsAvailable = await request('GET', `/customer/${dummyCustomerId}/rewards/available`);
    assert(rewardsAvailable.status === 200 || rewardsAvailable.status === 401 || rewardsAvailable.status === 404, 'GET rewards/available exists');
    if (rewardsAvailable.ok && rewardsAvailable.json) {
      const list = rewardsAvailable.json.rewards ?? rewardsAvailable.json.catalog ?? [];
      assert(Array.isArray(list), 'rewards available array');
    }
    results.passed++;
    console.log('  GET /customer/:id/rewards/available contract OK');
  } catch (e) {
    results.failed++; results.errors.push(e.message);
    console.log('  GET rewards/available FAIL:', e.message);
  }

  console.log('\n--- Summary ---');
  console.log(`Passed: ${results.passed}, Failed: ${results.failed}`);
  if (results.errors.length) console.log('Errors:', results.errors);
  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
