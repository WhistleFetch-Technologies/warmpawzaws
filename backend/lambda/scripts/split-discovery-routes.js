/**
 * Mechanical splitter for service-discovery.customer.ts (move-only).
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../src/endpoints/customer/customerEndpoint/service-discovery.customer.ts');
const OUT = path.join(__dirname, '../src/endpoints/customer/discovery');

const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);

// --- legacy-helpers.ts (lines 19-1902) ---
let helperLines = lines.slice(18, 1902).join('\n');
// export top-level functions not already exported
helperLines = helperLines.replace(/\n(async )?function /g, '\nexport $1function ');
helperLines = helperLines.replace(/\nexport export /g, '\nexport ');
// keep existing export async function getCoordinates
helperLines = helperLines.replace(/\nexport export async function getCoordinates/g, '\nexport async function getCoordinates');

const helpersPath = path.join(OUT, 'shared', 'legacy-helpers.ts');
fs.mkdirSync(path.dirname(helpersPath), { recursive: true });
fs.writeFileSync(
  helpersPath,
  `/**\n * Discovery shared helpers (move-only from service-discovery.customer.ts).\n */\n${helperLines}\n`
);

// Collect exported symbol names from helpers
const exportedNames = new Set();
for (const m of helperLines.matchAll(/export (?:async )?function ([A-Za-z0-9_]+)/g)) {
  exportedNames.add(m[1]);
}
// also export { getCustomerCoordinates } line
for (const m of helperLines.matchAll(/export \{ ([^}]+) \}/g)) {
  m[1].split(',').forEach((s) => {
    const n = s.trim().split(/\s+as\s+/)[0].trim();
    if (n) exportedNames.add(n);
  });
}

const ROUTES = [
  { name: 'discovery-meta', start: 1910, end: 1968 },
  { name: 'discovery-count', start: 1969, end: 2012 },
  { name: 'debug-training-vendors', start: 2013, end: 2203 },
  { name: 'debug-at-center-vendors', start: 2204, end: 2321 },
  { name: 'customer-services', start: 2322, end: 2422 },
  { name: 'customer-services-platform', start: 2423, end: 2612 },
  { name: 'discover-services', start: 2613, end: 3303 },
  { name: 'vendor-available-slots', start: 3304, end: 4652 },
  { name: 'vendor-services', start: 4653, end: 5049 },
  { name: 'public-vendor-profile', start: 5050, end: 5063 },
  { name: 'customer-vendor-profile', start: 5064, end: 5082 },
  { name: 'vendors-search', start: 5083, end: 5395 },
  { name: 'autocomplete', start: 5396, end: 5448 },
  { name: 'radar-providers', start: 5449, end: 5505 },
  { name: 'discover-by-problem', start: 5506, end: 5730 },
  { name: 'vendor-facility-get', start: 5731, end: 5849 },
  { name: 'vendor-facility-put', start: 5850, end: 6088 },
  { name: 'vendor-facility-upload', start: 6089, end: 6290 },
  { name: 'customer-facility', start: 6291, end: 6435 },
  { name: 'clinic-vendor-services', start: 6436, end: 6533 },
  { name: 'services-by-style', start: 6534, end: 7302 },
  { name: 'vendors-list', start: 7303, end: 7412 },
  { name: 'pricing-quote', start: 7413, end: 7586 },
  { name: 'diagnostics-vendor-by-phone', start: 7587, end: 7704 },
  { name: 'diagnostics-approve-vendor', start: 7705, end: 7739 },
];

const STATIC_IMPORTS = `import { select, query, insert } from '../../../../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../../utils/entity-extractor';
import { isValidUUID } from '../../../../types/entities';
import { getDiscoveryRules, type DiscoveryRuleSet } from '../../../../lib/rule-engine';
import { resolveVendorById, getVendorIdsForAvailabilityLookup, getVendorIdentityId } from '../../../vendor/endpoints/vendorProfile.vendor';
import { taxCalculationService } from '../../../../lib/services/tax-calculation-service';
import { discountCalculationService } from '../../../../lib/services/discount-calculation-service';
import { CATEGORY_ROLES } from '../../constants';
import { extractS3KeyFromUrl, regeneratePresignedUrl } from '../../../constants/helper';
import { getCustomerCoordinates, resolveCustomerIdFromPhone } from '../../../../utils/customer-coordinates';
import { seedFinitePackagesMissingSessionsForScope, type SqlClient } from '../../../../utils/package-session-sync';
import { sqlPackagePurchaseActiveForListing } from '../../../../utils/package-session-eligibility';
import { DistanceResolver, haversineKm, formatDistanceKm } from '../../../../lib/utils/vendor-customer-distance';
import {
  appendVetDiscoveryCategoryAliasKeys,
  buildDiscoveryVendorExistsSql,
  sqlVendorAvailabilityOrNotConfigured,
  sqlVendorDiscoverableStatus,
  sqlVendorOnlineForCustomerDiscovery,
  sqlVendorServiceDiscoverable,
  sqlVendorServicesHubCategoryFilter,
  vendorServicesHubCategoryBindParams,
  sqlVetHubExcludeNonVetServices,
  sqlVetHubPlaceholderCategoryOr,
  VET_HUB_PLACEHOLDER_CATEGORY_ROLES_SQL,
  isVetHubCategoryRequest,
  TRAINING_HUB_ROLE_SQL_IN_LIST,
  BEHAVIOR_HUB_ROLE_SQL_IN_LIST,
  catTextRequestsBehaviorHub,
  sqlTrainingCategoryAliasOrVs,
} from '../../../../lib/discovery-vendor-query';
import { acceptableAvailabilityStylesForSlot, normalizeAvailabilityServiceStyle } from '../../../../utils/availability-service-styles';
import { vendorGalleryDrivesListingPhoto, getVendorListingPhotoUrl } from '../../../../utils/vendor-listing-photo';
import {
  addDaysToYmd,
  dayOfWeekFromYmd,
  DEFAULT_MIN_NOTICE_MINUTES,
  formatNextAvailableDisplay,
  isSlotPastInIst,
  ymdInIst,
} from '../../../../utils/ist-scheduling';
import {
  filterSearchResultsByDiscoveryRules,
  hubSlugToDiscoveryContext,
  loadVendorRadiusMetaByIds,
  type HubDiscoveryContext,
} from '../../../../lib/search-discovery-parity';
import {
  uploadDisplayImage,
  ImageProcessingError,
  FACILITY_MAX_PHOTOS,
  mapWithConcurrency,
  resolveImageForContext,
} from '../../../../services/image';
`;

function usedHelperImports(block) {
  const used = [];
  for (const name of exportedNames) {
    const re = new RegExp(`\\b${name}\\b`);
    if (re.test(block)) used.push(name);
  }
  return used.sort();
}

function pascalFromKebab(s) {
  return s.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

fs.mkdirSync(path.join(OUT, 'routes'), { recursive: true });
const registerFns = [];

for (const r of ROUTES) {
  const block = lines.slice(r.start - 1, r.end).join('\n');
  const fnName = `register${pascalFromKebab(r.name)}Route`;
  registerFns.push({ fnName, file: r.name });
  const helperImports = usedHelperImports(block);
  const helperImportLine =
    helperImports.length > 0
      ? `import {\n  ${helperImports.join(',\n  ')},\n} from '../shared/legacy-helpers';\n`
      : '';

  const routeFile = `import type { Hono } from 'hono';
${STATIC_IMPORTS}
${helperImportLine}
export function ${fnName}(app: Hono) {
${block}
}
`;
  fs.writeFileSync(path.join(OUT, 'routes', `${r.name}.route.ts`), routeFile);
}

const indexImports = registerFns
  .map(({ fnName, file }) => `import { ${fnName} } from './routes/${file}.route';`)
  .join('\n');
const indexCalls = registerFns.map(({ fnName }) => `  ${fnName}(app);`).join('\n');

fs.writeFileSync(
  path.join(OUT, 'index.ts'),
  `import type { Hono } from 'hono';
${indexImports}

export { getCoordinates } from './shared/legacy-helpers';

export function registerServiceDiscoveryEndpoints(app: Hono) {
${indexCalls}
}
`
);

console.log('Discovery split:', ROUTES.length, 'routes,', exportedNames.size, 'helper exports');
