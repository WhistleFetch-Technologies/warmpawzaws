/**
 * Shared vendor_services EXISTS + category SQL for discover-services and GET /search hub browse.
 * Single source of truth — keep search and discover vendor sets aligned.
 */

import { query } from '../database/rds-connection';
import { acceptableStylesForService, normalizeServiceStyle } from './search-discovery-parity';

/** `roles.name` values for the customer Training hub (trainers + behaviorists). */
const TRAINING_HUB_ROLE_NAMES_LOWER: readonly string[] = [
  'trainer',
  'pet_trainer',
  'trainer_solo',
  'trainer_center',
  'training_center',
  'training_solo',
  'behaviorist_solo',
  'behaviorist_center',
  'behaviourist',
  'behaviourist_solo',
  'behaviourist_center',
];

export const TRAINING_HUB_ROLE_SQL_IN_LIST = TRAINING_HUB_ROLE_NAMES_LOWER.map((n) => `'${n}'`).join(
  ', '
);

const BEHAVIOR_HUB_ROLE_NAMES_LOWER: readonly string[] = [
  'behaviorist',
  'behaviorist_solo',
  'behaviorist_center',
  'behaviourist',
  'behaviourist_solo',
  'behaviourist_center',
  'pet_behaviourist',
  'dog_behaviourist',
  'pet_behaviorist',
];

export const BEHAVIOR_HUB_ROLE_SQL_IN_LIST = BEHAVIOR_HUB_ROLE_NAMES_LOWER.map((n) => `'${n}'`).join(
  ', '
);

export function catTextRequestsBehaviorHub(catTextExact: string[]): boolean {
  return catTextExact.some((c) => {
    const x = String(c).toLowerCase().trim();
    return (
      x === 'behaviourist' ||
      x === 'behaviorist' ||
      x === 'behavior' ||
      x === 'behavioral' ||
      x === 'behaviour' ||
      x === 'behavioural' ||
      x === 'pet_behaviourist' ||
      x === 'dog_behaviourist' ||
      x.includes('behaviou')
    );
  });
}

export function sqlTrainingCategoryAliasOrVs(vsAlias = 'vs'): string {
  return `(
        LOWER(TRIM(COALESCE(${vsAlias}.category, ''))) IN (
          'behavioral','behaviour','behavioural','behaviourist','behavior','behavior_modification'
        )
        OR LOWER(TRIM(COALESCE(${vsAlias}.category, ''))) LIKE '%behavior%'
        OR LOWER(TRIM(COALESCE(${vsAlias}.category, ''))) LIKE '%behaviour%'
      )`;
}

export function sqlVendorDiscoverableStatus(vAlias = 'v'): string {
  return `(
    LOWER(TRIM(COALESCE(${vAlias}.status::text, ''))) IN ('approved', 'active', 'activated')
    OR (
      LOWER(TRIM(COALESCE(${vAlias}.status::text, ''))) = 'pending'
      AND LOWER(TRIM(COALESCE(${vAlias}.vendor_type::text, ''))) = 'solo'
    )
  )`;
}

export function sqlVendorOnlineForCustomerDiscovery(vAlias = 'v'): string {
  return `COALESCE(${vAlias}.is_online, true) = true`;
}

export function sqlVendorServiceDiscoverable(vsAlias = 'vs', allowNullEnabled = false): string {
  const enabled = allowNullEnabled
    ? `(${vsAlias}.is_enabled = true OR ${vsAlias}.is_enabled IS NULL)`
    : `${vsAlias}.is_enabled = true`;
  const pub = `(
    ${vsAlias}.publish_status IS NULL
    OR LOWER(TRIM(COALESCE(${vsAlias}.publish_status::text, ''))) IN ('published', 'auto_published', 'draft')
  )`;
  return `(${enabled}) AND ${pub}`;
}

export function sqlVendorAvailabilityOrNotConfigured(vAlias = 'v'): string {
  return `(
    EXISTS (
      SELECT 1
      FROM vendor_availability_v2 va
      WHERE
        (va.vendor_id = ${vAlias}.id OR va.vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = ${vAlias}.id OR phone = ${vAlias}.phone))
        AND COALESCE(va.is_available, true) = true
    )
    OR NOT EXISTS (
      SELECT 1
      FROM vendor_availability_v2 va0
      WHERE va0.vendor_id = ${vAlias}.id
         OR va0.vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = ${vAlias}.id OR phone = ${vAlias}.phone)
    )
  )`;
}

const columnExistsCache = new Map<string, boolean>();

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const key = `${tableName}.${columnName}`;
  if (columnExistsCache.has(key)) return columnExistsCache.get(key) as boolean;
  try {
    const res = await query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
       ) as exists`,
      [tableName, columnName]
    );
    const exists = res.rows?.[0]?.exists === true || res.rows?.[0]?.exists === 't';
    columnExistsCache.set(key, exists);
    return exists;
  } catch {
    columnExistsCache.set(key, false);
    return false;
  }
}

export type DiscoveryCategoryKeys = {
  catTextExact: string[];
  catTextLike: string[];
  catUUIDs: string[];
  isVetCategoryDiscovery: boolean;
  sittingDiscoveryRelaxed: boolean;
  boardingDiscoverySearch: boolean;
  nutritionDiscoverySearch: boolean;
  trainingDiscoverySearch: boolean;
  behaviorHubDiscoverySearch: boolean;
};

/**
 * Vet hub discovery: catalog / vendor_services.category labels beyond vet-keyword matches.
 * Narrow allowlist — does not include cross-hub categories (e.g. pet sitter, grooming).
 * Note: "general" is intentionally omitted here; it is role-gated via
 * sqlVetHubPlaceholderCategoryOr / vetCategoryEmptyOr (empty OR general + vet roles only).
 * Treating unrestricted "general" let trainer/walker at_home rows leak into Vet → Home Visit.
 */
export const VET_DISCOVERY_CATEGORY_ALIAS_KEYS: readonly string[] = [
  'vet care',
  'veterinary',
  'veterinarian',
  'veterinary services',
  'diagnostics & lab',
  'diagnostics',
  'diagnostic',
];

/** Roles allowed when vendor_services.category is empty or the placeholder "general". */
export const VET_HUB_PLACEHOLDER_CATEGORY_ROLES_SQL = `('vet_clinic', 'veterinarian', 'vet_solo', 'vet')`;

/**
 * Match empty / "General" service category only for vet-role vendors.
 * `vendorRoleIdExpr` is typically `v.role_id` when the vendor row is already joined.
 */
export function sqlVetHubPlaceholderCategoryOr(
  vsAlias: string,
  vendorRoleIdExpr: string
): string {
  return `(
    (
      TRIM(COALESCE(${vsAlias}.category, '')) = ''
      OR LOWER(TRIM(COALESCE(${vsAlias}.category, ''))) = 'general'
    )
    AND ${vendorRoleIdExpr} IN (
      SELECT id FROM roles
      WHERE LOWER(TRIM(COALESCE(name, ''))) IN ${VET_HUB_PLACEHOLDER_CATEGORY_ROLES_SQL}
    )
  )`;
}

export function appendVetDiscoveryCategoryAliasKeys(rawCategoryKeys: string[], category?: string): void {
  if (category && category.toLowerCase() === 'vet') {
    rawCategoryKeys.push(...VET_DISCOVERY_CATEGORY_ALIAS_KEYS);
  }
}

/** Walker hub: catalog labels beyond literal "walker" (e.g. Walking & Exercise). */
export const WALKER_DISCOVERY_CATEGORY_ALIAS_KEYS: readonly string[] = [
  'walking & exercise',
  'walking',
  'walker',
  'dog walker',
  'pet walker',
  'dog_walker',
  'pet_walker',
];

export function appendWalkerDiscoveryCategoryAliasKeys(rawCategoryKeys: string[], category?: string): void {
  const c = String(category || '')
    .toLowerCase()
    .trim()
    .replace(/-/g, '_');
  if (['walker', 'walking', 'dog_walker', 'pet_walker'].includes(c)) {
    rawCategoryKeys.push(...WALKER_DISCOVERY_CATEGORY_ALIAS_KEYS);
  }
}

/** Grooming hub: catalog / vendor_services.category labels beyond literal "grooming". */
export const GROOMING_DISCOVERY_CATEGORY_ALIAS_KEYS: readonly string[] = [
  'grooming & hygiene',
  'pet_groomer',
  'pet_grooming',
  'pet grooming',
];

/** Roles allowed when vendor_services.category is empty or the placeholder "general". */
export const GROOMING_HUB_PLACEHOLDER_CATEGORY_ROLES_SQL = `(
  'groomer', 'groomer_solo', 'groomer_center',
  'pet_groomer', 'pet_groomer_solo', 'pet_groomer_business'
)`;

export function appendGroomingDiscoveryCategoryAliasKeys(rawCategoryKeys: string[], category?: string): void {
  const c = String(category || '')
    .toLowerCase()
    .trim()
    .replace(/-/g, '_');
  if (c === 'grooming' || c === 'pet_groomer' || c === 'pet_grooming') {
    rawCategoryKeys.push(...GROOMING_DISCOVERY_CATEGORY_ALIAS_KEYS);
  }
}

export function isGroomingHubCategoryRequest(categoryRaw: string): boolean {
  const c = String(categoryRaw).toLowerCase().trim().replace(/-/g, '_');
  return c === 'grooming' || c === 'pet_groomer' || c === 'pet_grooming';
}

export function isVetHubCategoryRequest(categoryRaw: string): boolean {
  const c = String(categoryRaw).toLowerCase().trim().replace(/-/g, '_');
  return c === 'vet' || c === 'veterinary' || c === 'veterinarian' || c === 'vet_clinic';
}

export function isWalkerHubCategoryRequest(categoryRaw: string): boolean {
  const c = String(categoryRaw).toLowerCase().trim().replace(/-/g, '_');
  return ['walker', 'walking', 'dog_walker', 'pet_walker'].includes(c);
}

/**
 * Vet hub: exclude non-vet catalog / category services (grooming, training, walking)
 * even when vs.category = 'general'.
 * Do not match by service_name — catalog has both groom_ear and vet_ear_cleaning_medical.
 */
export function sqlVetHubExcludeNonVetServices(vsAlias = 'vs'): string {
  return `
    AND NOT (
      LOWER(TRIM(COALESCE(${vsAlias}.category, ''))) = ANY(ARRAY[
        'grooming','grooming & hygiene','pet_groomer','pet_grooming',
        'training','training & behavior','training & behaviorist',
        'walking','walking & exercise','walker','pet walker','dog walker',
        'dog_walker','pet_walker'
      ]::text[])
      OR LOWER(TRIM(COALESCE(${vsAlias}.category, ''))) LIKE '%groom%'
      OR LOWER(TRIM(COALESCE(${vsAlias}.category, ''))) LIKE '%train%'
      OR (
        LOWER(TRIM(COALESCE(${vsAlias}.category, ''))) LIKE '%walk%'
        AND LOWER(TRIM(COALESCE(${vsAlias}.category, ''))) NOT LIKE '%walk-in%'
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM service_catalog sc_vet_ex
      WHERE sc_vet_ex.id = ${vsAlias}.service_id
        AND (
          LOWER(TRIM(COALESCE(sc_vet_ex.category_id, ''))) IN ('grooming', 'training', 'walking')
          OR LOWER(TRIM(COALESCE(sc_vet_ex.service_id, ''))) LIKE 'groom_%'
          OR LOWER(TRIM(COALESCE(sc_vet_ex.service_id, ''))) LIKE 'train_%'
          OR LOWER(TRIM(COALESCE(sc_vet_ex.service_id, ''))) LIKE 'walk_%'
          OR LOWER(TRIM(COALESCE(sc_vet_ex.service_id, ''))) LIKE 'behavior_%'
          OR LOWER(TRIM(COALESCE(sc_vet_ex.service_id, ''))) LIKE 'tra-%'
        )
    )`;
}

/** Bind params for hub category filter on GET /customer/vendor/:id/services */
export function vendorServicesHubCategoryBindParams(categoryRaw: string): {
  exact: string[];
  like: string[];
} | null {
  if (isVetHubCategoryRequest(categoryRaw)) {
    const keys = resolveDiscoveryCategoryKeys({ category: 'vet' });
    return { exact: keys.catTextExact, like: keys.catTextLike };
  }
  if (isWalkerHubCategoryRequest(categoryRaw)) {
    const keys = resolveDiscoveryCategoryKeys({ category: 'walker' });
    return { exact: keys.catTextExact, like: keys.catTextLike };
  }
  if (isGroomingHubCategoryRequest(categoryRaw)) {
    const keys = resolveDiscoveryCategoryKeys({ category: 'grooming' });
    return { exact: keys.catTextExact, like: keys.catTextLike };
  }
  return null;
}

/**
 * SQL fragment for vet / walker hub filters on vendor_services (booking API).
 * Caller must push exact + like arrays to queryParams at exactParamIndex and likeParamIndex.
 */
export function sqlVendorServicesHubCategoryFilter(
  categoryRaw: string,
  vsAlias = 'vs',
  exactParamIndex: number,
  likeParamIndex: number
): string | null {
  if (isVetHubCategoryRequest(categoryRaw)) {
    return `
      AND (
        LOWER(COALESCE(${vsAlias}.category,'')) = ANY($${exactParamIndex}::text[])
        OR LOWER(COALESCE(${vsAlias}.category,'')) LIKE ANY($${likeParamIndex}::text[])
        OR (
          (
            TRIM(COALESCE(${vsAlias}.category, '')) = ''
            OR LOWER(TRIM(COALESCE(${vsAlias}.category, ''))) = 'general'
          )
          AND EXISTS (
            SELECT 1 FROM vendors v_hub
            LEFT JOIN roles r_hub ON v_hub.role_id = r_hub.id
            WHERE v_hub.id = ${vsAlias}.vendor_id
              AND LOWER(TRIM(COALESCE(r_hub.name, ''))) IN ${VET_HUB_PLACEHOLDER_CATEGORY_ROLES_SQL}
          )
        )
      )`;
  }
  if (isWalkerHubCategoryRequest(categoryRaw)) {
    return `
      AND (
        LOWER(COALESCE(${vsAlias}.category, '')) = ANY($${exactParamIndex}::text[])
        OR LOWER(COALESCE(${vsAlias}.category, '')) LIKE ANY($${likeParamIndex}::text[])
        OR (
          LOWER(TRIM(COALESCE(${vsAlias}.category, ''))) LIKE '%walker%'
          AND LOWER(TRIM(COALESCE(${vsAlias}.category, ''))) NOT LIKE '%vet%'
        )
        OR (
          ${vsAlias}.service_style = 'at_home'
          AND (
            LOWER(COALESCE(${vsAlias}.service_name, '')) LIKE '%dog%walk%'
            OR LOWER(COALESCE(${vsAlias}.service_name, '')) LIKE '%pet%walk%'
            OR (
              LOWER(COALESCE(${vsAlias}.service_name, '')) LIKE '%walk%'
              AND LOWER(COALESCE(${vsAlias}.service_name, '')) NOT LIKE '%walk-in%'
            )
          )
          AND (
            TRIM(COALESCE(${vsAlias}.category, '')) = ''
            OR LOWER(COALESCE(${vsAlias}.category, '')) = ANY(ARRAY['vet', 'veterinarian', 'veterinary', 'vet care', 'grooming', 'other', 'general']::text[])
          )
        )
      )`;
  }
  if (isGroomingHubCategoryRequest(categoryRaw)) {
    return `
      AND (
        LOWER(COALESCE(${vsAlias}.category,'')) = ANY($${exactParamIndex}::text[])
        OR LOWER(COALESCE(${vsAlias}.category,'')) LIKE ANY($${likeParamIndex}::text[])
        OR (
          (
            TRIM(COALESCE(${vsAlias}.category, '')) = ''
            OR LOWER(TRIM(COALESCE(${vsAlias}.category, ''))) = 'general'
          )
          AND EXISTS (
            SELECT 1 FROM vendors v_hub
            LEFT JOIN roles r_hub ON v_hub.role_id = r_hub.id
            WHERE v_hub.id = ${vsAlias}.vendor_id
              AND LOWER(TRIM(COALESCE(r_hub.name, ''))) IN ${GROOMING_HUB_PLACEHOLDER_CATEGORY_ROLES_SQL}
          )
        )
      )`;
  }
  return null;
}

export function resolveDiscoveryCategoryKeys(opts: {
  category?: string;
  roleId?: string;
  sittingRelaxed?: boolean;
}): DiscoveryCategoryKeys {
  const isUuid = (s?: string) =>
    !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
  const rawCategoryKeys: string[] = [];
  if (opts.category) rawCategoryKeys.push(String(opts.category));
  if (opts.roleId) rawCategoryKeys.push(String(opts.roleId));
  appendVetDiscoveryCategoryAliasKeys(rawCategoryKeys, opts.category);
  appendWalkerDiscoveryCategoryAliasKeys(rawCategoryKeys, opts.category);
  appendGroomingDiscoveryCategoryAliasKeys(rawCategoryKeys, opts.category);
  const catTextExact: string[] = rawCategoryKeys.filter((k) => !isUuid(k)).map((k) => k.toLowerCase());
  const catTextLike: string[] = catTextExact.map((k) => `%${k}%`);
  const catUUIDs: string[] = rawCategoryKeys.filter((k) => isUuid(k));
  const isVetCategoryDiscovery = catTextExact.some((c) =>
    ['vet', 'vet care', 'veterinary', 'veterinarian'].includes(c)
  );

  const sittingDiscoveryRelaxed = Boolean(
    opts.sittingRelaxed ??
      (catTextExact.some((c) => ['sitting', 'pet_sitter', 'sitter', 'sitter_solo'].includes(c)) ||
        (Boolean(opts.roleId) &&
          ['pet_sitter', 'sitter', 'sitter_solo', 'pet_sitter_solo', 'pet_sitter_saas'].includes(
            String(opts.roleId).toLowerCase().replace(/-/g, '_')
          )))
  );

  const boardingDiscoverySearch = Boolean(
    catTextExact.some((c) => ['boarding', 'pet_boarding'].includes(c)) ||
      (opts.roleId &&
        ['pet_boarding', 'boarding'].includes(String(opts.roleId).toLowerCase().replace(/-/g, '_')))
  );

  const nutritionDiscoverySearch = Boolean(
    catTextExact.some(
      (c) =>
        ['nutrition', 'nutritionist', 'pet_nutritionist', 'pet nutritionist'].includes(c) ||
        c.includes('nutritionist') ||
        c === 'pet nutrition' ||
        (c.length >= 8 && c.startsWith('nutrition'))
    ) ||
      (opts.roleId &&
        ['pet_nutritionist', 'nutritionist', 'nutritionist_center', 'nutritionist_solo'].includes(
          String(opts.roleId).toLowerCase().replace(/-/g, '_')
        ))
  );

  const trainingDiscoverySearch =
    !sittingDiscoveryRelaxed && catTextExact.some((c) => c === 'training' || c.includes('training'));

  const behaviorHubDiscoverySearch =
    !sittingDiscoveryRelaxed && catTextRequestsBehaviorHub(catTextExact);

  return {
    catTextExact,
    catTextLike,
    catUUIDs,
    isVetCategoryDiscovery,
    sittingDiscoveryRelaxed,
    boardingDiscoverySearch,
    nutritionDiscoverySearch,
    trainingDiscoverySearch,
    behaviorHubDiscoverySearch,
  };
}

export type BuildDiscoveryVendorExistsOpts = {
  vAlias?: string;
  vsAlias?: string;
  category?: string;
  roleId?: string;
  serviceStyle: string;
  sittingRelaxed?: boolean;
  /** 1-based index for first bind param ($N) in the outer query */
  paramOffset: number;
  /** When true, match countDiscoverableVendors (training center bypass without isAtCenter gate). */
  forVendorCount?: boolean;
  /** Listing discover-services: training center bypass only when at_center. */
  isAtCenter?: boolean;
  /** Listing discover-services: include training category_id OR branch. */
  includeTrainingCategoryIdOr?: boolean;
  /**
   * When true (hub chip browse with no keyword), suppress the broad walkerCategoryDiscoveryOr
   * branch that lets vet/grooming/other-role vendors appear via walk-named services.
   * Only vendors whose category/role actually matches the walker hub are returned.
   */
  strictHubBrowse?: boolean;
};

export type BuildDiscoveryVendorExistsResult = {
  sql: string;
  params: unknown[];
  keys: DiscoveryCategoryKeys;
  acceptableStyles: string[];
  /** Vendor-level availability fragment (empty when skipped for sitting/training/behavior). */
  availabilitySql: string;
};

function pg(n: number): string {
  return `$${n}`;
}

/**
 * EXISTS (vendor_services …) with discover-services category ORs, style, and discoverable predicates.
 * Requires outer query `LEFT JOIN roles r ON v.role_id = r.id` when category ORs reference `r.name`.
 */
export async function buildDiscoveryVendorExistsSql(
  opts: BuildDiscoveryVendorExistsOpts
): Promise<BuildDiscoveryVendorExistsResult> {
  const vAlias = opts.vAlias ?? 'v';
  const vsAlias = opts.vsAlias ?? 'vs';
  const serviceStyleNorm = normalizeServiceStyle(opts.serviceStyle) || opts.serviceStyle;
  const acceptableStyles = acceptableStylesForService(serviceStyleNorm);
  const keys = resolveDiscoveryCategoryKeys({
    category: opts.category,
    roleId: opts.roleId,
    sittingRelaxed: opts.sittingRelaxed,
  });
  const {
    catTextExact,
    catTextLike,
    catUUIDs,
    isVetCategoryDiscovery,
    sittingDiscoveryRelaxed,
    boardingDiscoverySearch,
    nutritionDiscoverySearch,
    trainingDiscoverySearch,
    behaviorHubDiscoverySearch,
  } = keys;

  const isAtCenter =
    opts.isAtCenter ?? serviceStyleNorm === 'at_center';

  const trainingRoleUncategorizedOr = trainingDiscoverySearch
    ? ` OR (LOWER(COALESCE(TRIM(${vsAlias}.category), '')) = '' AND LOWER(COALESCE(TRIM(r.name), '')) IN (${TRAINING_HUB_ROLE_SQL_IN_LIST}))`
    : '';

  const trainingRoleCenterBypassOr =
    trainingDiscoverySearch && (opts.forVendorCount || isAtCenter)
      ? ` OR LOWER(COALESCE(TRIM(r.name), '')) IN (${TRAINING_HUB_ROLE_SQL_IN_LIST})`
      : '';

  const trainingCategoryAliasVendorOr = trainingDiscoverySearch
    ? ` OR ${sqlTrainingCategoryAliasOrVs(vsAlias)}`
    : '';

  const behaviorRoleUncategorizedOr = behaviorHubDiscoverySearch
    ? ` OR (LOWER(COALESCE(TRIM(${vsAlias}.category), '')) = '' AND LOWER(COALESCE(TRIM(r.name), '')) IN (${BEHAVIOR_HUB_ROLE_SQL_IN_LIST}))`
    : '';

  const behaviorCategoryAliasVendorOr = behaviorHubDiscoverySearch
    ? ` OR ${sqlTrainingCategoryAliasOrVs(vsAlias)}`
    : '';

  const behaviorTrainingCategoryVendorOr = behaviorHubDiscoverySearch
    ? ` OR (
              LOWER(TRIM(COALESCE(${vsAlias}.category, ''))) = 'training'
              AND LOWER(TRIM(COALESCE(r.name, ''))) IN (${BEHAVIOR_HUB_ROLE_SQL_IN_LIST})
            )`
    : '';

  const walkerCategoryDiscoveryOr =
    !sittingDiscoveryRelaxed &&
    !opts.strictHubBrowse &&
    catTextExact.some((c) => ['walker', 'walking', 'dog_walker', 'pet_walker'].includes(c))
      ? ` OR (
              ${vsAlias}.service_style = 'at_home'
              AND (
                LOWER(COALESCE(${vsAlias}.service_name, '')) LIKE '%dog%walk%'
                OR LOWER(COALESCE(${vsAlias}.service_name, '')) LIKE '%pet%walk%'
                OR (
                  LOWER(COALESCE(${vsAlias}.service_name, '')) LIKE '%walk%'
                  AND LOWER(COALESCE(${vsAlias}.service_name, '')) NOT LIKE '%walk-in%'
                )
              )
              AND (
                TRIM(COALESCE(${vsAlias}.category, '')) = ''
                OR LOWER(COALESCE(${vsAlias}.category, '')) = ANY(ARRAY['vet', 'veterinarian', 'veterinary', 'vet care', 'grooming', 'other']::text[])
              )
            )`
      : '';

  const hasVsCategoryId = await columnExists('vendor_services', 'category_id');
  let boardingCustomCategoryIdOrSql = '';
  if (boardingDiscoverySearch && hasVsCategoryId) {
    const slugRes = await query(
      `SELECT id::text FROM service_categories
           WHERE COALESCE(is_active, true) = true
             AND (
               LOWER(TRIM(category_id)) = ANY($1::text[])
               OR LOWER(TRIM(name)) = ANY($1::text[])
             )`,
      [['boarding', 'pet_boarding', 'pet boarding']]
    ).catch(() => ({ rows: [] as { id: string }[] }));
    const ids = (slugRes.rows || []).map((r: { id?: string }) => r?.id).filter(Boolean);
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const clean = ids.filter((id): id is string => !!id && UUID_RE.test(String(id).trim()));
    if (clean.length > 0) {
      const uuidList = clean.map((id) => `'${String(id).trim()}'::uuid`).join(', ');
      boardingCustomCategoryIdOrSql = `
                OR (
                  COALESCE(${vsAlias}.is_custom_service, false) = true
                  AND ${vsAlias}.category_id IS NOT NULL
                  AND ${vsAlias}.category_id = ANY(ARRAY[${uuidList}]::uuid[])
                )`;
    }
  }

  let trainingCustomCategoryIdOrSql = '';
  if (
    opts.includeTrainingCategoryIdOr !== false &&
    !opts.forVendorCount &&
    trainingDiscoverySearch &&
    hasVsCategoryId
  ) {
    const slugResTraining = await query(
      `SELECT id::text FROM service_categories
           WHERE COALESCE(is_active, true) = true
             AND (
               LOWER(TRIM(category_id)) = ANY($1::text[])
               OR LOWER(TRIM(name)) = ANY($1::text[])
             )`,
      [['training', 'pet training', 'dog training']]
    ).catch(() => ({ rows: [] as { id: string }[] }));
    const idsT = (slugResTraining.rows || []).map((r: { id?: string }) => r?.id).filter(Boolean);
    const UUID_RE_T =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const cleanT = idsT.filter((id): id is string => !!id && UUID_RE_T.test(String(id).trim()));
    if (cleanT.length > 0) {
      const uuidListT = cleanT.map((id) => `'${String(id).trim()}'::uuid`).join(', ');
      trainingCustomCategoryIdOrSql = `
                OR (
                  COALESCE(${vsAlias}.is_custom_service, false) = true
                  AND ${vsAlias}.category_id IS NOT NULL
                  AND ${vsAlias}.category_id = ANY(ARRAY[${uuidListT}]::uuid[])
                )`;
    }
  }

  const sittingCatalogBoardingNonCustomOr = sittingDiscoveryRelaxed
    ? `OR (
                LOWER(TRIM(COALESCE(${vsAlias}.category,''))) = 'boarding'
                AND COALESCE(${vsAlias}.is_custom_service, false) = false
              )`
    : '';

  const sittingCategoryTypoOr = sittingDiscoveryRelaxed
    ? `OR (
                LOWER(TRIM(COALESCE(${vsAlias}.category, ''))) LIKE '%sitt%'
                AND LOWER(TRIM(COALESCE(${vsAlias}.category, ''))) NOT LIKE '%babysitt%'
              )`
    : '';

  const sittingRoleUncategorizedOr = sittingDiscoveryRelaxed
    ? `OR (
                TRIM(COALESCE(${vsAlias}.category, '')) = ''
                AND COALESCE(${vsAlias}.is_custom_service, false) = false
                AND LOWER(COALESCE(TRIM(r.name), '')) IN ('pet_sitter','sitter','sitter_solo','pet_sitter_solo','pet_sitter_saas')
              )`
    : '';

  const sittingCustomNameOr = sittingDiscoveryRelaxed
    ? `OR (
                COALESCE(${vsAlias}.is_custom_service, false) = true
                AND LOWER(TRIM(COALESCE(${vsAlias}.service_name, ''))) LIKE '%sitt%'
                AND LOWER(TRIM(COALESCE(${vsAlias}.service_name, ''))) NOT LIKE '%babysitt%'
              )`
    : '';

  const sittingExcludeNonSittingSql = sittingDiscoveryRelaxed
    ? `
              AND NOT (
                LOWER(TRIM(COALESCE(${vsAlias}.category, ''))) = ANY(ARRAY[
                  'walking','walker','dog_walker','dog walking','dog walker','dog_walking',
                  'vet','veterinary','veterinarian','vet care','vet_care',
                  'grooming','training','diagnostics','behaviourist','nutrition','daycare','transport'
                ]::text[])
                OR (
                  LOWER(TRIM(COALESCE(${vsAlias}.category, ''))) = 'boarding'
                  AND COALESCE(${vsAlias}.is_custom_service, false) = true
                )
              )`
    : '';

  const boardingRoleUncategorizedOr =
    !sittingDiscoveryRelaxed && boardingDiscoverySearch
      ? ` OR (LOWER(COALESCE(TRIM(${vsAlias}.category), '')) = '' AND LOWER(COALESCE(TRIM(r.name), '')) IN ('boarding', 'pet_boarding'))`
      : '';

  const nutritionRoleUncategorizedOr =
    !sittingDiscoveryRelaxed && nutritionDiscoverySearch
      ? ` OR (LOWER(COALESCE(TRIM(${vsAlias}.category), '')) = '' AND LOWER(COALESCE(TRIM(r.name), '')) IN ('pet_nutritionist','nutritionist','nutritionist_center','nutritionist_solo'))`
      : '';

  const vetCategoryEmptyOr =
    !sittingDiscoveryRelaxed && isVetCategoryDiscovery
      ? ` OR ${sqlVetHubPlaceholderCategoryOr(vsAlias, `${vAlias}.role_id`)}`
      : '';

  const vetExcludeNonVetSql =
    !sittingDiscoveryRelaxed && isVetCategoryDiscovery
      ? sqlVetHubExcludeNonVetServices(vsAlias)
      : '';

  let p = opts.paramOffset;
  const pStyle = pg(p++);
  const pExact = catTextExact.length > 0 ? pg(p++) : null;
  const pLike = catTextExact.length > 0 ? pg(p++) : null;
  const pUuid = catUUIDs.length > 0 ? pg(p++) : null;

  const vendorServiceCategorySql =
    catTextExact.length + catUUIDs.length > 0
      ? sittingDiscoveryRelaxed
        ? `
              AND (
                ${catTextExact.length > 0 ? `LOWER(COALESCE(${vsAlias}.category,'')) = ANY(${pExact}::text[]) OR LOWER(COALESCE(${vsAlias}.category,'')) LIKE ANY(${pLike}::text[])` : `FALSE`}
                ${catTextExact.length > 0 && catUUIDs.length > 0 ? ` OR ` : ``}
                ${catUUIDs.length > 0 ? `COALESCE(${vsAlias}.category,'') = ANY(${pUuid}::text[])` : ``}
                ${sittingCatalogBoardingNonCustomOr}
                ${sittingCategoryTypoOr}
                ${sittingRoleUncategorizedOr}
                ${sittingCustomNameOr}
              )
              ${sittingExcludeNonSittingSql}`
        : `
              AND (
                ${catTextExact.length > 0 ? `LOWER(COALESCE(${vsAlias}.category,'')) = ANY(${pExact}::text[]) OR LOWER(COALESCE(${vsAlias}.category,'')) LIKE ANY(${pLike}::text[])` : `FALSE`}
                ${catTextExact.length > 0 && catUUIDs.length > 0 ? ` OR ` : ``}
                ${catUUIDs.length > 0 ? `COALESCE(${vsAlias}.category,'') = ANY(${pUuid}::text[])` : ``}
                ${boardingRoleUncategorizedOr}
                ${nutritionRoleUncategorizedOr}
                ${trainingRoleUncategorizedOr}
                ${trainingRoleCenterBypassOr}
                ${trainingCategoryAliasVendorOr}
                ${behaviorRoleUncategorizedOr}
                ${behaviorCategoryAliasVendorOr}
                ${behaviorTrainingCategoryVendorOr}
                ${walkerCategoryDiscoveryOr}
                ${vetCategoryEmptyOr}
                ${boardingCustomCategoryIdOrSql}
                ${trainingCustomCategoryIdOrSql}
              )`
      : '';

  const vendorVsDiscoverSql = sqlVendorServiceDiscoverable(vsAlias, sittingDiscoveryRelaxed);
  const vendorVsStyleSql = sittingDiscoveryRelaxed
    ? `(${vsAlias}.service_style = ANY(${pStyle}::text[]) OR ${vsAlias}.service_style IS NULL OR TRIM(COALESCE(${vsAlias}.service_style, '')) = '')`
    : `${vsAlias}.service_style = ANY(${pStyle}::text[])`;

  const params: unknown[] =
    catTextExact.length + catUUIDs.length > 0
      ? catTextExact.length > 0
        ? catUUIDs.length > 0
          ? [acceptableStyles, catTextExact, catTextLike, catUUIDs]
          : [acceptableStyles, catTextExact, catTextLike]
        : [acceptableStyles, [], [], catUUIDs]
      : [acceptableStyles];

  const availabilitySql =
    sittingDiscoveryRelaxed ||
    (!opts.forVendorCount && (trainingDiscoverySearch || behaviorHubDiscoverySearch))
      ? ''
      : `
          AND ${sqlVendorAvailabilityOrNotConfigured(vAlias)}`;

  const sql = `EXISTS (
            SELECT 1
            FROM vendor_services ${vsAlias}
            WHERE ${vsAlias}.vendor_id = ${vAlias}.id
              AND ${vendorVsDiscoverSql}
              AND ${vendorVsStyleSql}
              ${vendorServiceCategorySql}
              ${vetExcludeNonVetSql}
          )`;

  return {
    sql,
    params,
    keys,
    acceptableStyles,
    availabilitySql,
  };
}
