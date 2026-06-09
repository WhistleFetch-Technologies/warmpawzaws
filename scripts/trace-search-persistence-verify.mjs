#!/usr/bin/env node
/**
 * Verify persistence source for taxonomy comma string.
 * Scenarios: clean LS, polluted warmpawz_recent_searches, polluted warmpawz_search_context.
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const TARGET =
  'Vet near me, Dog doctor, Cat doctor, Pet clinic, Animal hospital';
const API =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const baseUrl = process.env.CUSTOMER_URL || 'http://localhost:3001';
const phone = process.env.TEST_CUSTOMER_PHONE || '9999000002';
const customerId =
  process.env.TEST_CUSTOMER_ID || '00000000-0000-4000-8000-000000000002';

function parsePersistenceLogs(lines) {
  const hits = [];
  const byLabel = {};
  for (const line of lines) {
    if (!line.includes('[search-persistence]')) continue;
    const m = line.match(/\[search-persistence\]\s+(\S+)/);
    const label = m ? m[1] : 'unknown';
    if (!byLabel[label]) byLabel[label] = [];
    byLabel[label].push(line);
    if (line.includes('*** TARGET FOUND')) hits.push(line);
  }
  return { hits, byLabel };
}

async function runScenario(name, initExtra) {
  const token = `uat-token-customer-${phone}-${Date.now()}`;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });

  const apiResponses = [];
  await context.route('**/customer/**/search-history**', async (route) => {
    const res = await route.fetch();
    const body = await res.text();
    apiResponses.push({ url: route.request().url(), status: res.status(), body });
    await route.fulfill({ response: res });
  });

  await context.addInitScript(
    (seed) => {
      localStorage.setItem('customerPhone', seed.phone);
      localStorage.setItem('authToken', seed.token);
      localStorage.setItem('warmpawz_customer_id', seed.customerId);
      localStorage.setItem('profile_completed', 'true');
      localStorage.setItem('onboarding_completed', 'true');
      localStorage.setItem('customerOnboardingComplete', 'true');
      localStorage.setItem('customerData', seed.customerData);
      if (seed.recentSearches != null) {
        localStorage.setItem(
          'warmpawz_recent_searches',
          seed.recentSearches
        );
      } else {
        localStorage.removeItem('warmpawz_recent_searches');
      }
      if (seed.searchContext != null) {
        localStorage.setItem('warmpawz_search_context', seed.searchContext);
      } else {
        localStorage.removeItem('warmpawz_search_context');
      }
    },
    {
      phone,
      token,
      customerId,
      customerData: JSON.stringify({
        id: customerId,
        phone,
        onboardingComplete: true,
        profile_completed: true,
      }),
      recentSearches: initExtra.recentSearches ?? null,
      searchContext: initExtra.searchContext ?? null,
    }
  );

  const page = await context.newPage();
  const logs = [];
  page.on('console', (msg) => {
    const t = msg.text();
    if (t.includes('[search-persistence]')) logs.push(t);
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(18000);

  const inp = page.locator('input[placeholder*="Search services"]').first();
  if (await inp.isVisible().catch(() => false)) {
    await inp.click();
    await page.waitForTimeout(1500);
  }

  const ls = await page.evaluate(() => {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && /search|warmpawz/i.test(k)) out[k] = localStorage.getItem(k);
    }
    return out;
  });

  const { hits, byLabel } = parsePersistenceLogs(logs);
  const apiHit = apiResponses.find((r) => r.body.includes(TARGET));
  const lsHit = Object.entries(ls).find(([, v]) => v && v.includes(TARGET));

  await browser.close();

  return {
    name,
    url: page.url(),
    localStorage: ls,
    firstStorageWithTarget: lsHit
      ? { layer: 'localStorage', key: lsHit[0], sample: lsHit[1]?.slice(0, 400) }
      : apiHit
        ? {
            layer: 'GET /customer/:id/search-history',
            url: apiHit.url,
            sample: apiHit.body.slice(0, 400),
          }
        : null,
    persistenceLogTargetHits: hits,
    persistenceLabels: Object.keys(byLabel),
    searchHistoryApiCalls: apiResponses.map((r) => ({
      url: r.url,
      status: r.status,
      containsTarget: r.body.includes(TARGET),
      bodyPreview: r.body.slice(0, 500),
    })),
    relevantLogs: logs.filter(
      (l) =>
        l.includes('pageLoad') ||
        l.includes('search-history') ||
        l.includes('localStorage') ||
        l.includes('hydrated') ||
        l.includes('rendered') ||
        l.includes('TARGET')
    ),
  };
}

async function probeSearchHistoryApi() {
  const url = `${API}/customer/${customerId}/search-history`;
  try {
    const res = await fetch(url);
    const text = await res.text();
    return {
      url,
      status: res.status,
      containsTarget: text.includes(TARGET),
      bodyPreview: text.slice(0, 800),
    };
  } catch (e) {
    return { url, error: String(e) };
  }
}

const report = {
  target: TARGET,
  scenarios: [],
  directApiProbe: await probeSearchHistoryApi(),
};

console.log('=== Direct API probe (no auth header) ===');
console.log(JSON.stringify(report.directApiProbe, null, 2));

for (const scenario of [
  { name: 'clean-storage', recentSearches: null, searchContext: null },
  {
    name: 'polluted-recent-searches',
    recentSearches: JSON.stringify([TARGET]),
    searchContext: null,
  },
  {
    name: 'polluted-search-context-only',
    recentSearches: null,
    searchContext: JSON.stringify({
      query: TARGET,
      results: [],
      timestamp: Date.now(),
    }),
  },
]) {
  console.log('\n===', scenario.name, '===');
  const r = await runScenario(scenario.name, scenario);
  report.scenarios.push(r);
  console.log('firstStorageWithTarget:', JSON.stringify(r.firstStorageWithTarget, null, 2));
  console.log('search-history API calls:', r.searchHistoryApiCalls.length);
  for (const c of r.searchHistoryApiCalls) {
    console.log(' ', c.url, c.status, 'target?', c.containsTarget);
  }
  for (const line of r.persistenceLogTargetHits) {
    console.log(' TARGET LOG:', line.slice(0, 200));
  }
}

const out = 'scripts/trace-search-persistence-verify-report.json';
writeFileSync(out, JSON.stringify(report, null, 2));
console.log('\nWrote', out);
