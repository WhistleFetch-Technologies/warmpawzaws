#!/usr/bin/env node
/**
 * Runtime trace: find source of taxonomy comma-list in search q.
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const TARGET =
  /Vet near me|Dog doctor|Cat doctor|Pet clinic|Animal hospital/i;
const TARGET_FULL =
  'Vet near me, Dog doctor, Cat doctor, Pet clinic, Animal hospital';
const BASE = process.argv[2] || 'http://localhost:3001';
const API =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

function scanValue(label, value) {
  if (value == null) return null;
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  if (TARGET.test(s) || (s.includes('Dog doctor') && s.includes('Pet clinic'))) {
    return { label, sample: s.slice(0, 1200) };
  }
  return null;
}

async function fetchJson(path) {
  const url = `${API}${path}`;
  const res = await fetch(url);
  const text = await res.text();
  try {
    return { url, status: res.status, body: JSON.parse(text) };
  } catch {
    return { url, status: res.status, body: text };
  }
}

async function runScenario(page, name, url) {
  const traceLogs = [];
  const apiHits = [];
  page.removeAllListeners('console');
  page.removeAllListeners('response');
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[search-trace]') || TARGET.test(text)) traceLogs.push(text);
  });
  page.on('response', async (res) => {
    const u = res.url();
    if (!/search|suggestions|service-launch|autocomplete/i.test(u)) return;
    try {
      const body = await res.json();
      const hit = scanValue(`HTTP ${u}`, body);
      if (hit) apiHits.push(hit);
    } catch {
      /* ignore */
    }
  });

  await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(2500);

  const snapshot = await page.evaluate(() => {
    const storage = {};
    for (const k of Object.keys(localStorage)) {
      if (/search|warmpawz/i.test(k)) storage[k] = localStorage.getItem(k);
    }
    const inputs = [...document.querySelectorAll('input')].map((el) => ({
      value: el.value,
      placeholder: el.getAttribute('placeholder'),
      name: el.getAttribute('name'),
      id: el.id,
      type: el.getAttribute('type'),
    }));
    return { href: window.location.href, storage, inputs };
  });

  const hits = [];
  if (TARGET.test(snapshot.href)) hits.push({ source: 'URL', href: snapshot.href });
  for (const [k, v] of Object.entries(snapshot.storage)) {
    const h = scanValue(`localStorage.${k}`, v);
    if (h) hits.push({ source: 'localStorage', key: k, ...h });
  }
  for (const inp of snapshot.inputs) {
    if (TARGET.test(inp.value || '')) hits.push({ source: 'input.value', ...inp });
    if (TARGET.test(inp.placeholder || '')) hits.push({ source: 'input.placeholder', ...inp });
  }
  for (const h of apiHits) hits.push({ source: 'api', ...h });
  for (const line of traceLogs) {
    if (line.includes('TARGET STRING') || (line.includes('performSearch') && TARGET.test(line))) {
      hits.push({ source: 'console-trace', line: line.slice(0, 500) });
    }
  }

  return { name, url, snapshot, traceLogs, apiHits, hits };
}

async function main() {
  const report = { api: [], scenarios: [] };

  console.log('=== API probe ===');
  for (const path of [
    '/customer/search-suggestions',
    '/config/service-launch/customer',
    `/search?q=${encodeURIComponent(TARGET_FULL)}`,
  ]) {
    const r = await fetchJson(path);
    const hit = scanValue(path, r.body);
    report.api.push({ path, status: r.status, hit: !!hit, sample: hit?.sample });
    console.log(path, r.status, hit ? '*** HIT ***' : 'ok');
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const scenarios = [
    ['search-cold', `${BASE}/search`],
    ['search-with-q-param', `${BASE}/search?q=${encodeURIComponent(TARGET_FULL)}`],
    ['home', `${BASE}/`],
  ];

  for (const [name, url] of scenarios) {
    console.log('\n---', name, '---');
    const r = await runScenario(page, name, url);
    report.scenarios.push(r);
    console.log('URL:', r.snapshot.href);
    console.log('Hits:', r.hits.length);
    for (const h of r.hits) console.log(JSON.stringify(h, null, 2));
    const searchInput = r.snapshot.inputs.find(
      (i) => /search/i.test(i.type || '') || /service|vendor/i.test(i.placeholder || '')
    );
    if (searchInput) console.log('Search-like input:', searchInput);
  }

  // Inject taxonomy string into localStorage then reload search
  await page.goto(`${BASE}/search`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((q) => {
    localStorage.setItem(
      'warmpawz_recent_searches',
      JSON.stringify([q])
    );
    localStorage.setItem(
      'warmpawz_search_context',
      JSON.stringify({ query: q, timestamp: Date.now(), results: [] })
    );
  }, TARGET_FULL);
  console.log('\n--- after localStorage inject ---');
  const injected = await runScenario(
    page,
    'search-after-storage-inject',
    `${BASE}/search`
  );
  report.scenarios.push(injected);
  console.log('Input after inject reload:', injected.snapshot.inputs);
  console.log('Trace performSearch lines:', injected.traceLogs.filter((l) => l.includes('performSearch') || l.includes('mount')));

  const outPath = 'scripts/trace-search-q-runtime-report.json';
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log('\nWrote', outPath);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
