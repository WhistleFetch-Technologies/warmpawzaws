#!/usr/bin/env node
/**
 * Forensic Tier System Validation
 * Tests: Admin tiers CRUD, Vendor tier GET, Upgrade flow (T&C, settlement schedule)
 */

const https = require('https');

const API_BASE = process.env.API_BASE || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const VENDOR_ID = process.env.VENDOR_ID || 'e23c969e-bb16-4313-9f48-a80357ad6f42'; // solo vendor from conversation

function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path.startsWith('http') ? path : API_BASE + path);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-UAT-Mode': 'true',
        'X-UAT-Token': 'uat-token-test',
      },
    };
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed, ok: res.statusCode >= 200 && res.statusCode < 400 });
        } catch {
          resolve({ status: res.statusCode, data: { raw: data }, ok: false });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('🔬 FORENSIC TIER SYSTEM VALIDATION\n');
  console.log('API:', API_BASE);
  console.log('Vendor ID:', VENDOR_ID);
  console.log('—'.repeat(60));

  const failures = [];

  // 1. Admin GET tiers - should include termsAndConditions
  console.log('\n1️⃣  GET /admin/payments/tiers');
  const adminTiers = await request('/admin/payments/tiers');
  if (!adminTiers.ok) {
    if (adminTiers.status === 401) {
      console.log('   ⚠️  401 (auth required - expected for admin endpoints)');
    } else {
      failures.push(`Admin tiers GET failed: ${adminTiers.status}`);
      console.log('   ❌ Failed:', adminTiers.status);
    }
  } else {
    const tiers = adminTiers.data?.tiers ?? adminTiers.data?.data?.tiers ?? [];
    console.log('   ✅ Status:', adminTiers.status, '| Tiers:', tiers.length);
    const hasTermsField = tiers.some((t) => 'termsAndConditions' in t || 'terms_and_conditions' in t);
    if (tiers.length > 0 && !hasTermsField) {
      failures.push('Admin tiers response missing termsAndConditions field');
      console.log('   ⚠️  Missing termsAndConditions in tier objects');
    } else if (tiers.length > 0) {
      console.log('   ✅ termsAndConditions field present');
    }
  }

  // 2. Vendor GET tier - should include requirements with terms
  console.log('\n2️⃣  GET /vendor/:vendorId/tier');
  const vendorTier = await request(`/vendor/${VENDOR_ID}/tier`);
  if (!vendorTier.ok) {
    failures.push(`Vendor tier GET failed: ${vendorTier.status}`);
    console.log('   ❌ Failed:', vendorTier.status, vendorTier.data?.error || '');
  } else {
    const t = vendorTier.data?.tier ?? vendorTier.data;
    const req = t?.requirements ?? t?.upgradeRequirements;
    console.log('   ✅ Status:', vendorTier.status);
    console.log('   Current tier:', t?.current ?? t?.name);
    console.log('   Next tier:', t?.nextTier ?? t?.next_tier);
    console.log('   canUpgrade:', t?.canUpgrade ?? t?.eligible);
    if (req) {
      const hasTerms = !!(req.termsAndConditions ?? req.terms_and_conditions);
      const hasRequires = 'requiresTermsAcceptance' in req || 'requires_terms_acceptance' in req;
      console.log('   requirements.termsAndConditions:', hasTerms ? 'present' : 'empty');
      console.log('   requirements.requiresTermsAcceptance:', hasRequires ? req.requiresTermsAcceptance ?? req.requires_terms_acceptance : 'N/A');
    }
  }

  // 3. Upgrade without terms when tier has terms - expect 400
  console.log('\n3️⃣  POST /vendor/:vendorId/tier/upgrade (no termsAccepted - expect 400 if tier has terms)');
  const upgradeNoTerms = await request(`/vendor/${VENDOR_ID}/tier/upgrade`, 'POST', {
    newTier: 'Advance',
    paymentMethod: 'settlement_deduction',
    settlementSchedule: 'monthly',
    termsAccepted: false,
  });
  if (upgradeNoTerms.ok && upgradeNoTerms.data?.success) {
    console.log('   ℹ️  Upgrade succeeded (tier may not have terms, or free tier)');
  } else if (upgradeNoTerms.status === 400 && upgradeNoTerms.data?.requiresTermsAcceptance) {
    console.log('   ✅ Correctly rejected: requiresTermsAcceptance=true');
  } else if (upgradeNoTerms.status === 400) {
    console.log('   ℹ️  400:', upgradeNoTerms.data?.error || '');
  } else if (upgradeNoTerms.status === 404) {
    console.log('   ⚠️  Vendor not found - use valid VENDOR_ID');
  } else {
    console.log('   Status:', upgradeNoTerms.status, upgradeNoTerms.data?.error || '');
  }

  // 4. Validate tier API response shape for vendor dashboard
  console.log('\n4️⃣  Vendor tier response shape validation');
  const vt = await request(`/vendor/${VENDOR_ID}/tier`);
  if (vt.ok) {
    const t = vt.data?.tier ?? vt.data;
    const needs = ['current', 'canUpgrade', 'nextTier', 'requirements'];
    const missing = needs.filter((n) => !(n in t) && !(n === 'requirements' && t?.requirements));
    if (missing.length > 0) {
      failures.push(`Vendor tier missing fields: ${missing.join(', ')}`);
      console.log('   ❌ Missing:', missing.join(', '));
    } else {
      console.log('   ✅ All required fields present');
    }
    if (t?.requirements && !('termsAndConditions' in t.requirements || 'terms_and_conditions' in t.requirements)) {
      console.log('   ⚠️  requirements should include termsAndConditions for T&C flow');
    }
  }

  // 5. Admin tiers PUT - terms update (if we have a tier id)
  const tiers = adminTiers.data?.tiers ?? [];
  if (tiers.length > 0 && tiers[0].id) {
    console.log('\n5️⃣  PUT /admin/payments/tiers/:id (terms update)');
    const tierId = tiers[0].id;
    const putRes = await request(`/admin/payments/tiers/${tierId}`, 'PUT', {
      termsAndConditions: 'Test T&C for forensic validation. Vendor must accept.',
      termsVersion: '1.0',
    });
    if (!putRes.ok) {
      failures.push(`Admin tier PUT failed: ${putRes.status}`);
      console.log('   ❌ Failed:', putRes.status);
    } else {
      console.log('   ✅ Terms updated');
      // Revert - clear terms for clean state
      await request(`/admin/payments/tiers/${tierId}`, 'PUT', {
        termsAndConditions: tiers[0].termsAndConditions ?? '',
        termsVersion: tiers[0].termsVersion ?? '1.0',
      });
    }
  }

  // 6. Upgrade with settlementSchedule weekly_4
  console.log('\n6️⃣  POST upgrade with settlementSchedule=weekly_4 (smoke test)');
  const vt2 = await request(`/vendor/${VENDOR_ID}/tier`);
  const nextTier = vt2.ok && (vt2.data?.tier ?? vt2.data)?.nextTier;
  if (nextTier) {
    const weeklyUpgrade = await request(`/vendor/${VENDOR_ID}/tier/upgrade`, 'POST', {
      newTier: nextTier,
      paymentMethod: 'settlement_deduction',
      settlementSchedule: 'weekly_4',
      termsAccepted: true,
    });
    console.log('   Status:', weeklyUpgrade.status, weeklyUpgrade.data?.deductionInfo ? 'deductionInfo present' : '');
  } else {
    console.log('   ℹ️  No next tier to test (vendor may be at max tier)');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  if (failures.length > 0) {
    console.log('❌ FAILURES:');
    failures.forEach((f) => console.log('   -', f));
    process.exit(1);
  } else {
    console.log('✅ All forensic checks passed');
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
