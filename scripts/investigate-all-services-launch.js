#!/usr/bin/env node
/**
 * Read-only investigation: Admin vs Customer launch config vs All Services tile rendering.
 * Usage:
 *   node scripts/investigate-all-services-launch.js
 *   STATE_CODE=KA STATE_NAME=Karnataka CITY=Bangalore node scripts/investigate-all-services-launch.js
 *
 * Does not commit secrets. Uses public dev API by default.
 */

const API_BASE =
  process.env.API_BASE_URL ||
  process.env.API_URL ||
  'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

const STATE_CODE = process.env.STATE_CODE || 'KA';
const STATE_NAME = process.env.STATE_NAME || 'Karnataka';
const CITY = process.env.CITY || 'Bangalore';
const PHONE = process.env.PHONE || '';

const FETCH_TIMEOUT_MS = 25000;

// --- Inline copies of mapping logic (keep in sync with @warmpawz/service-launch-mappings) ---
function normalizeServiceKey(key) {
  return String(key ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
}

const CATALOG_SLUG_TO_LAUNCH = {
  veterinary: 'vet',
  grooming: 'grooming',
  training: 'training',
  walking: 'walker',
  walker: 'walker',
  'dog-walker': 'walker',
  dog_walker: 'walker',
  boarding: 'boarding',
  'pet-holiday': 'holiday',
  pet_holiday: 'holiday',
  pet_holiday_planner: 'holiday',
  diagnostic: 'diagnostics',
  diagnostics: 'diagnostics',
  pharmacy: 'pharmacy',
  emergency: 'ambulance',
  wellness: 'nutritionist',
  nutrition: 'nutritionist',
  specialty: 'specialty',
  speciality: 'specialty',
  daycare: 'daycare',
  behavioral: 'training',
  behaviorist: 'training',
  pet_behaviorist: 'training',
  pet_trainer: 'training',
  trainer: 'training',
  sitting: 'pet-sitter',
  'pet-sitter': 'pet-sitter',
  sitter: 'pet-sitter',
};

function mapCatalogSlugToLaunchServiceId(categoryId) {
  if (categoryId == null || String(categoryId).trim() === '') return 'unknown';
  const key = normalizeServiceKey(categoryId);
  return CATALOG_SLUG_TO_LAUNCH[key] || String(categoryId).trim();
}

const LAUNCH_TO_SCREEN = {
  vet: 'vet',
  grooming: 'grooming',
  training: 'training',
  walker: 'walker',
  boarding: 'boarding',
  'pet-sitter': 'pet-sitter',
  holiday: 'holiday',
  shop: 'shop',
  pharmacy: 'pharmacy',
  adoption: 'adoption',
  mating: 'mating-dating-hub',
  'mating-dating-hub': 'mating-dating-hub',
  cafes: 'cafes',
  photography: 'photography',
  insurance: 'insurance',
  breeder: 'breeder',
  ambulance: 'ambulance',
  nutritionist: 'nutritionist',
  relocation: 'relocation',
  resort: 'resort',
  sunset: 'sunset',
  diagnostics: 'vet',
  diagnostic: 'vet',
  specialty: 'insurance',
  wellness: 'nutritionist',
  nutrition: 'nutritionist',
};

function mapLaunchServiceIdToCustomerHomeScreen(launchId) {
  const key = normalizeServiceKey(launchId);
  if (!key) return '';
  return LAUNCH_TO_SCREEN[key] || key;
}

const CATALOG_TO_SCREEN = {
  veterinary: 'vet',
  grooming: 'grooming',
  training: 'training',
  boarding: 'boarding',
  walking: 'walker',
  walker: 'walker',
  'dog-walker': 'walker',
  dog_walker: 'walker',
  'pet-sitter': 'pet-sitter',
  pet_sitter: 'pet-sitter',
  sitting: 'pet-sitter',
  sitter: 'pet-sitter',
  diagnostic: 'lab-diagnostics',
  diagnostics: 'lab-diagnostics',
  'lab-diagnostics': 'lab-diagnostics',
  lab: 'lab-diagnostics',
  pharmacy: 'pharmacy',
  emergency: 'ambulance',
  ambulance: 'ambulance',
  emergency_care: 'ambulance',
  wellness: 'nutritionist',
  nutrition: 'nutritionist',
  nutritionist: 'nutritionist',
  specialty: 'insurance',
  speciality: 'insurance',
  adoption: 'adoption',
  mating: 'mating-dating-hub',
  'mating-dating-hub': 'mating-dating-hub',
  shop: 'shop',
  marketplace: 'shop',
  resort: 'resort',
  cafe: 'cafes',
  cafes: 'cafes',
  photography: 'photography',
  breeder: 'breeder',
  relocation: 'relocation',
  holiday: 'holiday',
  'pet-holiday': 'holiday',
  pet_holiday: 'holiday',
  pet_holiday_planner: 'holiday',
  sunset: 'sunset',
  insurance: 'insurance',
  behavioral: 'training',
  behaviorist: 'training',
  pet_behaviorist: 'training',
  pet_trainer: 'training',
  trainer: 'training',
};

function mapCatalogCategoryIdToCustomerHomeScreen(categoryId) {
  const key = normalizeServiceKey(categoryId);
  if (!key) return '';
  if (CATALOG_TO_SCREEN[key]) return CATALOG_TO_SCREEN[key];
  return mapLaunchServiceIdToCustomerHomeScreen(mapCatalogSlugToLaunchServiceId(categoryId));
}

const PRIMARY_SERVICE_SCREENS = new Set([
  'grooming',
  'vet',
  'boarding',
  'walker',
  'training',
  'shop',
  'nutritionist',
  'pet-sitter',
]);

const HIDDEN_CATEGORIES = ['physiotherapy', 'physio', 'physical_therapy'];

// quickServices screens from apps/customer-web/.../constants/index.ts
const QUICK_SERVICES_TILES = [
  { screen: 'vet', categoryId: 'vet' },
  { screen: 'grooming', categoryId: 'grooming' },
  { screen: 'shop', categoryId: 'shop' },
  { screen: 'training', categoryId: 'training' },
  { screen: 'pharmacy', categoryId: 'pharmacy' },
  { screen: 'lab-diagnostics', categoryId: 'lab-diagnostics' },
  { screen: 'walker', categoryId: 'walker' },
  { screen: 'boarding', categoryId: 'boarding' },
  { screen: 'pet-sitter', categoryId: 'pet-sitter' },
  { screen: 'adoption', categoryId: 'adoption' },
  { screen: 'mating-dating-hub', categoryId: 'mating-dating-hub' },
  { screen: 'cafes', categoryId: 'cafes' },
  { screen: 'photography', categoryId: 'photography' },
  { screen: 'insurance', categoryId: 'insurance' },
  { screen: 'breeder', categoryId: 'breeder' },
  { screen: 'ambulance', categoryId: 'ambulance' },
  { screen: 'nutritionist', categoryId: 'nutritionist' },
  { screen: 'behaviorist', categoryId: 'behaviorist' },
  { screen: 'relocation', categoryId: 'relocation' },
  { screen: 'resort', categoryId: 'resort' },
  { screen: 'holiday', categoryId: 'holiday' },
  { screen: 'sunset', categoryId: 'sunset' },
];

async function fetchJson(path) {
  const url = `${API_BASE.replace(/\/$/, '')}${path}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`Non-JSON ${res.status} from ${url}: ${text.slice(0, 200)}`);
    }
    return { status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

function categoriesToTiles(categories) {
  const filtered = categories.filter((cat) => {
    const id = (cat.category_id || '').toLowerCase();
    return !HIDDEN_CATEGORIES.some((h) => id.includes(h));
  });
  const seenScreens = new Set();
  const tiles = [];
  for (const cat of filtered) {
    const screen =
      mapCatalogCategoryIdToCustomerHomeScreen(cat.category_id) ||
      String(cat.category_id || '').trim();
    if (seenScreens.has(screen)) continue;
    seenScreens.add(screen);
    tiles.push({
      screen,
      categoryId: cat.category_id,
      label: cat.name || cat.category_id,
    });
  }
  return tiles;
}

function buildSourceQuickServices(quickServiceTiles) {
  const base = quickServiceTiles.length > 0 ? quickServiceTiles : QUICK_SERVICES_TILES;
  const nutritionIds = new Set(['nutritionist', 'nutrition', 'wellness']);
  let source = [...base];
  const has = (pred) => source.some(pred);
  if (!has((s) => (s.categoryId || s.screen || '').toLowerCase() === 'pharmacy')) {
    source.push({ screen: 'pharmacy', categoryId: 'pharmacy', label: 'Pharmacy' });
  }
  if (
    !has((s) => {
      const r = (s.categoryId || s.screen || '').toLowerCase();
      return r === 'lab-diagnostics' || s.screen === 'lab-diagnostics';
    })
  ) {
    source.push({ screen: 'lab-diagnostics', categoryId: 'lab-diagnostics', label: 'Lab' });
  }
  if (
    !has((s) => {
      const r = (s.categoryId || s.screen || '').toLowerCase();
      return nutritionIds.has(r) || mapCatalogSlugToLaunchServiceId(s.categoryId || s.screen) === 'nutritionist';
    })
  ) {
    source.push({ screen: 'nutritionist', categoryId: 'nutritionist', label: 'Nutritionist' });
  }
  const hasTraining = has(
    (s) =>
      (s.screen || '').toLowerCase() === 'training' ||
      mapCatalogSlugToLaunchServiceId(s.categoryId || '') === 'training'
  );
  const hasBehaviorist = has((s) => {
    const r = (s.categoryId || s.screen || '').toLowerCase();
    return r === 'behaviorist' || r === 'behavioral';
  });
  if (!hasBehaviorist && !hasTraining) {
    source.push({ screen: 'behaviorist', categoryId: 'behaviorist', label: 'Behaviorist' });
  }
  const seen = new Set();
  return source
    .map((s) => ({ ...s, screen: s.screen || s.categoryId || '' }))
    .filter((s) => {
      if (seen.has(s.screen)) return false;
      seen.add(s.screen);
      return true;
    });
}

function findMatchingTileForLaunchId(svcIdRaw, allTilePool) {
  const svcId = (svcIdRaw || '').toLowerCase();
  const targetScreen = mapLaunchServiceIdToCustomerHomeScreen(svcId).toLowerCase();
  return allTilePool.find((tile) => {
    const catId = (tile.categoryId || '').toLowerCase();
    const tileScreen = (tile.screen || '').toLowerCase();
    const catalogScreen = mapCatalogCategoryIdToCustomerHomeScreen(tile.categoryId || '').toLowerCase();
    const screenAsCatalog = mapCatalogCategoryIdToCustomerHomeScreen(tile.screen || '').toLowerCase();
    const launchFromCat = mapLaunchServiceIdToCustomerHomeScreen(catId).toLowerCase();
    return (
      catId === svcId ||
      tileScreen === svcId ||
      catalogScreen === targetScreen ||
      screenAsCatalog === targetScreen ||
      launchFromCat === targetScreen ||
      tileScreen === targetScreen
    );
  });
}

function simulateAllServicesTiles(catalog, sourceQuickServices) {
  const allTilePool = [...sourceQuickServices, ...QUICK_SERVICES_TILES];
  const seen = new Set();
  const resultTiles = [];
  for (const entry of catalog || []) {
    const svcId = (entry.serviceId || '').toLowerCase();
    if (!svcId || svcId === 'general' || svcId === 'unknown') continue;
    const status = entry.effectiveStatus || 'hidden';
    if (status === 'hidden') {
      // All Services includes hidden as SOON
    } else if (status !== 'launched' && status !== 'beta' && status !== 'coming_soon') {
      continue;
    }
    const isComingSoon = status === 'coming_soon' || status === 'hidden';
    const preferScreen =
      svcId === 'diagnostics' || svcId === 'diagnostic' ? 'lab-diagnostics' : null;
    const matchingTile = findMatchingTileForLaunchId(svcId, allTilePool);
    const screen = preferScreen || (matchingTile && matchingTile.screen) || svcId;
    if (seen.has(svcId)) continue;
    seen.add(svcId);
    resultTiles.push({
      screen,
      isComingSoon,
      launchServiceId: svcId,
      label: entry.displayName || svcId,
    });
  }
  const primary = resultTiles.filter((s) => PRIMARY_SERVICE_SCREENS.has(String(s.screen).toLowerCase()));
  const secondary = resultTiles.filter((s) => !PRIMARY_SERVICE_SCREENS.has(String(s.screen).toLowerCase()));
  return { resultTiles, primary, secondary, dropped: [] };
}

function simulateAppendFromLaunchLists(visibleLaunch, comingSoonLaunch, sourceQuickServices) {
  const allTilePool = [...sourceQuickServices, ...QUICK_SERVICES_TILES];
  const seenScreens = new Set();
  const resultTiles = [];

  const appendFromLaunchList = (list, isComingSoon) => {
    const dropped = [];
    for (const entry of list) {
      const svcId = (entry.serviceId || '').toLowerCase();
      const matchingTile = findMatchingTileForLaunchId(svcId, allTilePool);
      if (!matchingTile) {
        dropped.push({ serviceId: svcId, reason: 'NO_TILE_MATCH' });
        continue;
      }
      if (seenScreens.has(matchingTile.screen)) {
        dropped.push({
          serviceId: svcId,
          reason: 'DEDUPED_SCREEN',
          screen: matchingTile.screen,
        });
        continue;
      }
      seenScreens.add(matchingTile.screen);
      resultTiles.push({ ...matchingTile, isComingSoon, launchServiceId: svcId });
    }
    return dropped;
  };

  const droppedVisible = appendFromLaunchList(visibleLaunch, false);
  const droppedComingSoon = appendFromLaunchList(comingSoonLaunch, true);

  const primary = resultTiles.filter((s) => PRIMARY_SERVICE_SCREENS.has(String(s.screen).toLowerCase()));
  const secondary = resultTiles.filter((s) => !PRIMARY_SERVICE_SCREENS.has(String(s.screen).toLowerCase()));

  return {
    resultTiles,
    primary,
    secondary,
    dropped: [...droppedVisible, ...droppedComingSoon],
    allTilePoolScreens: [...new Set(allTilePool.map((t) => t.screen))],
  };
}

function bucketCustomerService(serviceId, customerBody) {
  const id = normalizeServiceKey(serviceId);
  for (const s of customerBody.services?.visible || []) {
    if (normalizeServiceKey(s.serviceId) === id) return 'visible';
  }
  for (const s of customerBody.services?.comingSoon || []) {
    if (normalizeServiceKey(s.serviceId) === id) return 'comingSoon';
  }
  for (const s of customerBody.services?.hidden || []) {
    if (normalizeServiceKey(s.serviceId) === id) return 'hidden';
  }
  return 'absent';
}

async function main() {
  console.log('=== All Services Launch Investigation ===');
  console.log(`API: ${API_BASE}`);
  console.log(`Geography: stateCode=${STATE_CODE} stateName=${STATE_NAME} city=${CITY}`);
  console.log('');

  const adminPath = `/config/service-launch?stateCode=${encodeURIComponent(STATE_CODE)}&city=${encodeURIComponent(CITY)}`;
  const customerPath = `/config/service-launch/customer?state=${encodeURIComponent(STATE_NAME)}&city=${encodeURIComponent(CITY)}`;
  let catPath = '/service-catalog/categories';
  if (PHONE) catPath += `?phone=${encodeURIComponent(PHONE)}`;

  let adminRes;
  let customerRes;
  let catRes;
  try {
    [adminRes, customerRes, catRes] = await Promise.all([
      fetchJson(adminPath),
      fetchJson(customerPath),
      fetchJson(catPath),
    ]);
  } catch (e) {
    console.error('API fetch failed:', e.message);
    console.error('Run with network access or set API_BASE_URL to local backend.');
    process.exit(1);
  }

  const adminServices = adminRes.body?.services || [];
  const categories = catRes.body?.categories || [];
  const quickTiles = categoriesToTiles(categories);
  const sourceQuickServices = buildSourceQuickServices(quickTiles);

  const visible = customerRes.body?.services?.visible || [];
  const comingSoon = customerRes.body?.services?.comingSoon || [];
  const hidden = customerRes.body?.services?.hidden || [];
  const customerTotal = visible.length + comingSoon.length + hidden.length;

  const catalog = adminRes.body?.services
    ? adminServices.map((s) => ({
        serviceId: s.serviceId || s.id,
        displayName: s.displayName || s.serviceName,
        effectiveStatus: s.effectiveStatus,
      }))
    : [];
  const simAfter = catalog.length
    ? simulateAllServicesTiles(catalog, sourceQuickServices)
    : null;
  const simBefore =
    visible.length > 0 || comingSoon.length > 0
      ? simulateAppendFromLaunchLists(visible, comingSoon, sourceQuickServices)
      : null;
  const renderedCount = simBefore ? simBefore.resultTiles.length : sourceQuickServices.length;

  console.log('--- COUNTS ---');
  console.log(`1. Admin catalog count: ${adminServices.length}`);
  console.log(
    `2. Customer API count: ${customerTotal} (visible=${visible.length} comingSoon=${comingSoon.length} hidden=${hidden.length})`
  );
  console.log(`3. Rendered tile count AFTER fix sim (petFilter=all): ${simAfter ? simAfter.resultTiles.length : 'n/a'}`);
  if (simAfter) {
    console.log(`   - Services for You (primary): ${simAfter.primary.length}`);
    console.log(`   - More Services (secondary): ${simAfter.secondary.length}`);
  }
  const renderedBefore = simBefore ? simBefore.resultTiles.length : renderedCount;
  console.log(`3b. Rendered BEFORE fix sim (legacy appendFromLaunchList): ${renderedBefore}`);
  if (simBefore) {
    console.log(`   - Services for You: ${simBefore.primary.length}, More: ${simBefore.secondary.length}`);
  }
  console.log(`4. Category tiles in pool: ${quickTiles.length} (sourceQuickServices: ${sourceQuickServices.length})`);
  console.log('');

  const customerKeys = new Set([
    ...visible.map((s) => normalizeServiceKey(s.serviceId)),
    ...comingSoon.map((s) => normalizeServiceKey(s.serviceId)),
    ...hidden.map((s) => normalizeServiceKey(s.serviceId)),
  ]);

  console.log('--- PER-SERVICE TABLE (admin catalog) ---');
  console.log(
    'serviceId | displayName | effectiveStatus | customerBucket | tileMatch | mappedScreen | exclusion'
  );

  const missingFromRendered = [];
  const rows = [];

  for (const svc of adminServices) {
    const serviceId = svc.serviceId || svc.id;
    const sid = normalizeServiceKey(serviceId);
    const displayName = svc.displayName || svc.serviceName || serviceId;
    const effectiveStatus = svc.effectiveStatus || 'hidden';
    const customerBucket = bucketCustomerService(serviceId, customerRes.body);

    const matchingTile = findMatchingTileForLaunchId(serviceId, [
      ...sourceQuickServices,
      ...QUICK_SERVICES_TILES,
    ]);
    const tileMatch = matchingTile ? 'y' : 'n';
    const mappedScreen = matchingTile
      ? matchingTile.screen
      : mapLaunchServiceIdToCustomerHomeScreen(serviceId);

    let exclusion = 'OK_SHOWN';
    if (customerBucket === 'absent') {
      exclusion = 'NOT_IN_CUSTOMER_API';
    } else if (customerBucket === 'hidden') {
      exclusion = 'HIDDEN_GEO';
    } else if (tileMatch === 'n') {
      exclusion = 'NO_TILE_MATCH';
    } else if (simBefore) {
      const dropped = simBefore.dropped.find((d) => d.serviceId === sid);
      if (dropped?.reason === 'DEDUPED_SCREEN') exclusion = 'DEDUPED_SCREEN';
      else if (dropped?.reason === 'NO_TILE_MATCH') exclusion = 'NO_TILE_MATCH';
    }

    const renderedBefore =
      simBefore &&
      (customerBucket === 'visible' || customerBucket === 'comingSoon') &&
      simBefore.resultTiles.some((t) => normalizeServiceKey(t.launchServiceId) === sid);
    if (!renderedBefore && (customerBucket === 'visible' || customerBucket === 'comingSoon')) {
      if (exclusion === 'OK_SHOWN') exclusion = 'NO_TILE_MATCH_OR_DEDUPED';
    }
    if (
      simBefore &&
      !simBefore.resultTiles.find((t) => normalizeServiceKey(t.launchServiceId) === sid) &&
      (customerBucket === 'visible' || customerBucket === 'comingSoon' || customerBucket === 'hidden')
    ) {
      missingFromRendered.push({
        serviceId,
        displayName,
        effectiveStatus,
        customerBucket,
        exclusion,
        mappedScreen,
      });
    }

    rows.push({
      serviceId,
      displayName,
      effectiveStatus,
      customerBucket,
      tileMatch,
      mappedScreen,
      exclusion,
    });
    console.log(
      `${serviceId} | ${displayName} | ${effectiveStatus} | ${customerBucket} | ${tileMatch} | ${mappedScreen} | ${exclusion}`
    );
  }

  // Customer API ids not in admin catalog
  const adminIds = new Set(adminServices.map((s) => normalizeServiceKey(s.serviceId || s.id)));
  const extraCustomer = [...customerKeys].filter((k) => !adminIds.has(k));
  if (extraCustomer.length) {
    console.log('');
    console.log('Customer API serviceIds NOT in admin catalog:', extraCustomer.join(', '));
  }

  console.log('');
  console.log('--- MISSING vs RENDERED (admin catalog, not shown in All Services sim) ---');
  for (const m of missingFromRendered) {
    console.log(`- ${m.serviceId} (${m.displayName}): ${m.exclusion} [admin=${m.effectiveStatus}, bucket=${m.customerBucket}]`);
  }

  console.log('');
  console.log('--- CHECKLIST ---');
  console.log(
    `Customer endpoint keys-only: customerTotal=${customerTotal} adminCatalog=${adminServices.length} => ${customerTotal < adminServices.length ? 'CONFIRMED gap (customer only returns platform_settings keys)' : 'same count or customer has more'}`
  );
  if (simBefore?.dropped?.length) {
    console.log('Dropped by legacy appendFromLaunchList:', JSON.stringify(simBefore.dropped, null, 2));
  }
  if (simAfter) {
    const afterIds = new Set(simAfter.resultTiles.map((t) => normalizeServiceKey(t.launchServiceId)));
    const stillMissing = adminServices.filter(
      (s) => !afterIds.has(normalizeServiceKey(s.serviceId || s.id))
    );
    console.log(`After-fix sim missing vs admin: ${stillMissing.length}`);
    stillMissing.forEach((s) => console.log(`  - ${s.serviceId}`));
  }
  console.log(
    `Hidden omitted from UI when visible+comingSoon exist: ${hidden.length} hidden services NOT passed to appendFromLaunchList`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
