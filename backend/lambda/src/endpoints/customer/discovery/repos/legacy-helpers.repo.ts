/**
 * Discovery shared helpers (move-only from service-discovery.customer.ts).
 */
import { Hono } from 'hono';
import { select, query, insert } from '../../../../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../../utils/entity-extractor';
import { isValidUUID } from '../../../../types/entities';
import { getDiscoveryRules, type DiscoveryRuleSet } from '../../../../lib/rule-engine';
import { resolveVendorById, getVendorIdsForAvailabilityLookup, getVendorIdentityId } from '../../../vendor/endpoints/vendorProfile.vendor';
import { taxCalculationService } from '../../../../lib/services/tax-calculation-service';
import { discountCalculationService } from '../../../../lib/services/discount-calculation-service';
import { CATEGORY_ROLES } from '../../constants';
import { extractS3KeyFromUrl, regeneratePresignedUrl } from '../../../constants/helper';
import { getCustomerCoordinates, resolveCustomerIdFromPhone } from '../../../../utils/customer-coordinates';
import {
  seedFinitePackagesMissingSessionsForScope,
  type SqlClient,
} from '../../../../utils/package-session-sync';
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
import {
  acceptableAvailabilityStylesForSlot,
  normalizeAvailabilityServiceStyle,
} from '../../../../utils/availability-service-styles';
import {
  vendorGalleryDrivesListingPhoto,
  getVendorListingPhotoUrl,
} from '../../../../utils/vendor-listing-photo';
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

export { getCustomerCoordinates, resolveCustomerIdFromPhone };

/**
 * Calculate distance between two coordinates (Haversine formula).
 * Kept for backward-compat with the SQL-level distance_km enrichment paths.
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return haversineKm(lat1, lon1, lat2, lon2);
}

export function parsePositiveKm(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * at_home discovery: travel radius (solo / Advanced Availability) or business coverage from center (service_distance_km).
 */
export function vendorHomeServiceRadiusKm(row: {
  service_radius?: unknown;
  service_distance_km?: unknown;
}): number | null {
  return parsePositiveKm(row.service_radius) ?? parsePositiveKm(row.service_distance_km);
}

export function discoveryCustomerRadiusKm(opts: {
  rules: DiscoveryRuleSet;
  serviceStyleNorm: string;
  radiusFromQuery?: string | null;
}): number | null {
  if (opts.radiusFromQuery) {
    const n = parseInt(opts.radiusFromQuery, 10);
    return Number.isFinite(n) ? n : null;
  }
  if (opts.serviceStyleNorm === 'at_home') return null;
  if (opts.serviceStyleNorm === 'tele') return opts.rules.discovery_radius_km_tele ?? 0;
  return opts.rules.discovery_radius_km ?? 50;
}

/** Role ids used by hub fallback vendor search → discover-services parity context. */
export function hubContextForVendorSearch(
  roleId: string | undefined,
  serviceStyleRaw: string | undefined
): HubDiscoveryContext {
  const roleKey = String(roleId || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  const fromSlug = hubSlugToDiscoveryContext(roleKey);
  const styleNorm = normalizeServiceStyle(serviceStyleRaw || fromSlug?.serviceStyle || 'at_center') || 'at_center';

  const roleAliases: Record<string, HubDiscoveryContext> = {
    pet_groomer: { discoverCategory: 'grooming', serviceStyle: 'at_center', roleId: 'pet_groomer' },
    groomer: { discoverCategory: 'grooming', serviceStyle: 'at_center', roleId: 'pet_groomer' },
    trainer_center: { discoverCategory: 'training', serviceStyle: 'at_center', roleId: 'trainer_center' },
    trainer: { discoverCategory: 'training', serviceStyle: 'at_center', roleId: 'trainer_center' },
    veterinarian: { discoverCategory: 'vet', serviceStyle: 'at_center', roleId: 'veterinarian' },
    vet_clinic: { discoverCategory: 'vet', serviceStyle: 'at_center', roleId: 'veterinarian' },
    pet_boarding: { discoverCategory: 'boarding', serviceStyle: 'at_center', roleId: 'pet_boarding' },
    pet_cafe: { discoverCategory: 'cafe', serviceStyle: 'at_center', roleId: 'pet_cafe' },
    pet_resort: { discoverCategory: 'resort', serviceStyle: 'at_center', roleId: 'pet_resort' },
  };

  const base = fromSlug || roleAliases[roleKey] || {
    discoverCategory: roleKey || 'all',
    serviceStyle: styleNorm as HubDiscoveryContext['serviceStyle'],
    roleId: roleId || undefined,
  };

  return {
    ...base,
    serviceStyle: styleNorm as HubDiscoveryContext['serviceStyle'],
    roleId: base.roleId || roleId || undefined,
  };
}

export function providerWithinRadiusKm(
  distanceKm: number | null | undefined,
  capKm: number,
  allowUnknownDistance: boolean
): boolean {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return allowUnknownDistance;
  return distanceKm <= capKm;
}

/** Align with problem-grid specialization keys (slug, spaced label, normalized). */
export function normalizeSpecializationDiscoveryKey(value: string): string {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

/**
 * All synonym clusters: tile slug → every slug/display variant that
 * `specialization_master` might store, plus spaced variants.
 * Add new clusters whenever a new tile ID is added to the customer app.
 */
const SPECIALIZATION_SYNONYM_CLUSTERS: string[][] = [
  // ── Behavioral ──────────────────────────────────────────────────────────
  ['barking', 'excessive_barking', 'excessive barking', 'vocalization'],
  ['separation_anxiety', 'separation anxiety'],
  ['fear_phobia', 'fear_phobias', 'fear & phobias', 'fear and phobias', 'fear phobia', 'fear phobias'],
  ['destructive', 'destructive_behavior', 'destructive behavior'],
  ['resource_guarding', 'resource guarding', 'possessive', 'possessive_behavior', 'possessive behavior'],
  // ── Nutrition ────────────────────────────────────────────────────────────
  ['diet_plan', 'diet plan', 'custom_diet', 'custom diet', 'custom_diet_plans', 'custom diet plans', 'diet_planning', 'diet planning'],
  ['weight_management', 'weight management'],
  ['allergies', 'allergy_diet', 'allergy diet', 'food_allergies', 'food allergies', 'allergy'],
  ['puppy_nutrition', 'puppy nutrition'],
  ['senior_nutrition', 'senior nutrition', 'senior_pet_nutrition', 'senior pet nutrition'],
  ['special_diet', 'special diet', 'prescription_diet', 'prescription diet', 'medical_diet', 'medical diet'],
  // ── Training ─────────────────────────────────────────────────────────────
  ['potty_training', 'potty training', 'house_training', 'house training'],
  ['basic_obedience', 'basic obedience', 'obedience'],
  ['socialization', 'socialisation'],
  ['aggression', 'aggression_management', 'aggression management'],
  // ── Vet ──────────────────────────────────────────────────────────────────
  ['dermatology', 'skin_care', 'skin care'],
  ['cardiology', 'heart_care', 'heart care'],
  ['ophthalmology', 'eye_care', 'eye care'],
  ['dentistry', 'dental', 'dental_care', 'dental care'],
  ['surgery', 'surgical'],
  ['vaccination', 'vaccinations', 'immunization'],
  ['lab_diagnostics', 'lab diagnostics', 'lab_and_diagnostics', 'lab & diagnostics', 'diagnostics'],
  ['general', 'general_health', 'general health'],
  ['palliative', 'palliative_care', 'palliative care', 'end_of_life', 'end of life'],
  ['reproductive', 'reproductive_breeding', 'reproductive & breeding', 'breeding'],
  ['neurology', 'neuro'],
  ['orthopedics', 'bone_joint', 'bone & joint', 'bone and joint'],
  // ── Grooming ─────────────────────────────────────────────────────────────
  ['bath_only', 'bath_brush', 'bath & brush', 'bath service', 'bath_and_brush'],
  ['full_grooming', 'complete grooming', 'full grooming'],
  ['hair_trim', 'hair_trimming', 'hair trimming', 'haircut_styling', 'haircut & styling', 'hair styling'],
  ['nail_care', 'nail_trimming', 'nail trimming'],
  ['deshedding', 'de_shedding', 'de-shedding', 'shedding_control', 'shedding control'],
  ['spa_treatment', 'spa_wellness', 'spa & wellness', 'spa treatment'],
];

/** Normalise a slug by replacing any non-alphanumeric run with a single underscore. */
export function aggressiveNormalizeSlug(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function collectSpecializationDiscoveryKeys(raw: string | null | undefined): string[] {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return [];
  const out = new Set<string>();
  out.add(trimmed.toLowerCase());
  const underscored = normalizeSpecializationDiscoveryKey(trimmed); // spaces/dashes → _
  if (underscored) out.add(underscored);
  const spaced = underscored.replace(/_/g, ' ');
  if (spaced) out.add(spaced);
  const aggressive = aggressiveNormalizeSlug(trimmed);
  if (aggressive) out.add(aggressive);

  // Expand via synonym clusters
  for (const cluster of SPECIALIZATION_SYNONYM_CLUSTERS) {
    const normCluster = cluster.map(aggressiveNormalizeSlug);
    if (normCluster.includes(aggressive) || cluster.map(s => s.toLowerCase()).includes(trimmed.toLowerCase())) {
      for (const s of cluster) {
        out.add(s.toLowerCase());
        out.add(aggressiveNormalizeSlug(s));
        out.add(aggressiveNormalizeSlug(s).replace(/_/g, ' '));
      }
      break;
    }
  }
  return Array.from(out).filter(Boolean);
}

/**
 * Expand a single specialization filter value into every form a vendor row
 * might have stored: UUID (specialization_master.id), slug
 * (specialization_master.specialization_id), display name, and
 * underscore/space variants.
 *
 * Vendors save the value emitted by the SpecializationSelector, which is the
 * UUID for newer rows but historically has been the slug or display name. The
 * customer side meanwhile may pass any of these forms. To keep
 * specialisation discovery symmetrical, we always look up the canonical
 * record in specialization_master and merge every variant into the key list.
 */
export async function resolveSpecializationDiscoveryKeys(raw: string | null | undefined): Promise<string[]> {
  const baseKeys = collectSpecializationDiscoveryKeys(raw);
  if (baseKeys.length === 0) return baseKeys;

  const trimmed = String(raw || '').trim();
  if (!trimmed) return baseKeys;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const isUuid = UUID_RE.test(trimmed);

  try {
    /**
     * Query specialization_master using ALL synonym keys (not just the raw input).
     * This is the critical fix: when the tile slug is `barking` but the DB row has
     * `specialization_id='excessive_barking'` (or `display_name='Excessive Barking'`),
     * the old query missed it — the UUID was never added → vendor not found.
     *
     * We now query using:
     *   $1 = array of all synonym keys (exact lower-trim match)
     *   $2 = same array (regexp_replace normalization: 'Excessive Barking' → 'excessive_barking')
     * Plus UUID lookup when input is a UUID.
     */
    const smRes = await query(
      `SELECT id::text AS id, specialization_id, name, display_name
       FROM specialization_master
       WHERE is_active = true
         AND (
           ${isUuid ? `id::text = $3 OR ` : ''}
           LOWER(TRIM(COALESCE(specialization_id, ''))) = ANY($1::text[])
           OR LOWER(TRIM(COALESCE(name, ''))) = ANY($1::text[])
           OR LOWER(TRIM(COALESCE(display_name, ''))) = ANY($1::text[])
           OR regexp_replace(LOWER(TRIM(COALESCE(specialization_id, ''))), '[^a-z0-9]+', '_', 'g') = ANY($2::text[])
           OR regexp_replace(LOWER(TRIM(COALESCE(name, ''))), '[^a-z0-9]+', '_', 'g') = ANY($2::text[])
           OR regexp_replace(LOWER(TRIM(COALESCE(display_name, ''))), '[^a-z0-9]+', '_', 'g') = ANY($2::text[])
         )
       LIMIT 20`,
      isUuid
        ? [baseKeys, baseKeys, trimmed]
        : [baseKeys, baseKeys]
    );
    const merged = new Set<string>(baseKeys);
    for (const row of smRes?.rows || []) {
      for (const val of [row.id, row.specialization_id, row.name, row.display_name]) {
        if (!val) continue;
        const v = String(val).trim();
        if (!v) continue;
        merged.add(v.toLowerCase());
        const norm = normalizeSpecializationDiscoveryKey(v);
        if (norm) {
          merged.add(norm);
          merged.add(norm.replace(/_/g, ' '));
        }
        const aggr = aggressiveNormalizeSlug(v);
        if (aggr) {
          merged.add(aggr);
          merged.add(aggr.replace(/_/g, ' '));
        }
      }
    }
    return Array.from(merged).filter(Boolean);
  } catch {
    return baseKeys;
  }
}

/** ILIKE patterns for specialization keys; escape % and _ so slugs like bath_brush match literally. */
export function specializationDiscoveryIlikePatterns(keys: string[]): string[] {
  const patterns = new Set<string>();
  for (const k of keys) {
    const esc = k.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    patterns.add(`%${esc}%`);
  }
  return Array.from(patterns);
}

/**
 * Restrict vendors to those who offer the specialization via:
 * - profile declarations (vendor_specializations / vendors.specializations / metadata), OR
 * - a published vendor_service that tags the specialization (custom packages store
 *   metadata.specialization_ids — e.g. Puppy Monthly Package → puppy_walk).
 * Strict mode: vendors without any matching declaration/offering are filtered OUT.
 * Appends two params: text[] exact (lower trim), text[] ILIKE patterns.
 */
export function sqlVendorMatchesDeclaredSpecialization(paramBase: number): string {
  const a = paramBase;       // text[] exact keys (lower-trimmed)
  const b = paramBase + 1;   // text[] ILIKE patterns
  return `
          AND (
            /* ── 1. vendor_specializations: stored value is in exact key list ── */
            EXISTS (
              SELECT 1 FROM vendor_specializations vsp
              WHERE vsp.vendor_id = v.id
                AND (
                  LOWER(TRIM(vsp.specialization)) = ANY($${a}::text[])
                  OR vsp.specialization ILIKE ANY($${b}::text[])
                )
            )
            /* ── 2. vendor_specializations stores UUID → look up in specialization_master ──
             *  The SpecializationSelector saves spec.id (UUID).  The customer tile slug won't
             *  literally appear in the stored UUID, so we JOIN to specialization_master and
             *  match on the master row's slug/name against the customer's query keys.
             */
            OR EXISTS (
              SELECT 1 FROM vendor_specializations vsp2
              JOIN specialization_master sm
                ON sm.is_active = true
                   AND (
                     sm.id::text = vsp2.specialization
                     OR LOWER(TRIM(sm.specialization_id)) = LOWER(TRIM(vsp2.specialization))
                     OR LOWER(TRIM(sm.name))              = LOWER(TRIM(vsp2.specialization))
                     OR LOWER(TRIM(sm.display_name))      = LOWER(TRIM(vsp2.specialization))
                   )
              WHERE vsp2.vendor_id = v.id
                AND (
                  sm.id::text = ANY($${a}::text[])
                  OR LOWER(TRIM(sm.specialization_id)) = ANY($${a}::text[])
                  OR LOWER(TRIM(sm.name))              = ANY($${a}::text[])
                  OR LOWER(TRIM(sm.display_name))      = ANY($${a}::text[])
                  OR regexp_replace(LOWER(TRIM(sm.specialization_id)), '[^a-z0-9]+', '_', 'g') = ANY($${a}::text[])
                  OR regexp_replace(LOWER(TRIM(sm.name)),              '[^a-z0-9]+', '_', 'g') = ANY($${a}::text[])
                  OR regexp_replace(LOWER(TRIM(sm.display_name)),      '[^a-z0-9]+', '_', 'g') = ANY($${a}::text[])
                )
            )
            /* ── 3. vendors.specializations JSONB stores UUID or slug ── */
            OR (
              v.specializations IS NOT NULL
              AND v.specializations::text NOT IN ('[]', 'null', '')
              AND (
                v.specializations::text ILIKE ANY($${b}::text[])
                OR EXISTS (
                  SELECT 1
                  FROM jsonb_array_elements_text(
                    CASE
                      WHEN jsonb_typeof(v.specializations) = 'array' THEN v.specializations
                      ELSE '[]'::jsonb
                    END
                  ) elem(val)
                  JOIN specialization_master sm2
                    ON sm2.is_active = true
                       AND (
                         sm2.id::text = elem.val
                         OR LOWER(TRIM(sm2.specialization_id)) = LOWER(TRIM(elem.val))
                         OR LOWER(TRIM(sm2.name))              = LOWER(TRIM(elem.val))
                         OR LOWER(TRIM(sm2.display_name))      = LOWER(TRIM(elem.val))
                       )
                  WHERE (
                    sm2.id::text = ANY($${a}::text[])
                    OR LOWER(TRIM(sm2.specialization_id)) = ANY($${a}::text[])
                    OR regexp_replace(LOWER(TRIM(sm2.specialization_id)), '[^a-z0-9]+', '_', 'g') = ANY($${a}::text[])
                    OR regexp_replace(LOWER(TRIM(sm2.display_name)),      '[^a-z0-9]+', '_', 'g') = ANY($${a}::text[])
                  )
                )
              )
            )
            /* ── 4. vendors.metadata.specializations (legacy string/JSON) ── */
            OR (
              v.metadata IS NOT NULL
              AND v.metadata->'specializations' IS NOT NULL
              AND (v.metadata->'specializations')::text NOT IN ('null', '[]', '')
              AND (v.metadata->'specializations')::text ILIKE ANY($${b}::text[])
            )
            /* ── 5. Published vendor_services tag the specialization (custom packages) ── */
            OR EXISTS (
              SELECT 1 FROM vendor_services vs_spec
              WHERE vs_spec.vendor_id = v.id
                AND (vs_spec.is_enabled = true OR vs_spec.is_enabled IS NULL)
                AND (vs_spec.publish_status IN ('published','auto_published') OR vs_spec.publish_status IS NULL)
                AND (
                  (
                    vs_spec.metadata IS NOT NULL
                    AND (
                      (
                        jsonb_typeof(vs_spec.metadata->'specialization_ids') = 'array'
                        AND EXISTS (
                          SELECT 1
                          FROM jsonb_array_elements_text(vs_spec.metadata->'specialization_ids') sid(val)
                          WHERE LOWER(TRIM(sid.val)) = ANY($${a}::text[])
                             OR sid.val ILIKE ANY($${b}::text[])
                             OR EXISTS (
                               SELECT 1 FROM specialization_master sm_vs
                               WHERE sm_vs.is_active = true
                                 AND (
                                   sm_vs.id::text = sid.val
                                   OR LOWER(TRIM(sm_vs.specialization_id)) = LOWER(TRIM(sid.val))
                                 )
                                 AND (
                                   sm_vs.id::text = ANY($${a}::text[])
                                   OR LOWER(TRIM(sm_vs.specialization_id)) = ANY($${a}::text[])
                                   OR regexp_replace(LOWER(TRIM(sm_vs.specialization_id)), '[^a-z0-9]+', '_', 'g') = ANY($${a}::text[])
                                   OR regexp_replace(LOWER(TRIM(sm_vs.display_name)), '[^a-z0-9]+', '_', 'g') = ANY($${a}::text[])
                                 )
                             )
                        )
                      )
                      OR (
                        jsonb_typeof(vs_spec.metadata->'specializations') = 'array'
                        AND EXISTS (
                          SELECT 1
                          FROM jsonb_array_elements_text(vs_spec.metadata->'specializations') sid2(val)
                          WHERE LOWER(TRIM(sid2.val)) = ANY($${a}::text[])
                             OR sid2.val ILIKE ANY($${b}::text[])
                        )
                      )
                      OR (vs_spec.metadata->'specialization_ids')::text ILIKE ANY($${b}::text[])
                      OR (vs_spec.metadata->'specializations')::text ILIKE ANY($${b}::text[])
                    )
                  )
                  OR EXISTS (
                    SELECT 1 FROM service_catalog sc_spec
                    WHERE sc_spec.id = vs_spec.service_id
                      AND sc_spec.specialization_ids IS NOT NULL
                      AND EXISTS (
                        SELECT 1
                        FROM unnest(sc_spec.specialization_ids) AS cat_sid(val)
                        WHERE LOWER(TRIM(cat_sid.val)) = ANY($${a}::text[])
                           OR cat_sid.val ILIKE ANY($${b}::text[])
                      )
                  )
                )
            )
          )`;
}

type VendorRowForSpecBundle = {
  vendor_id: string;
  metadata?: unknown;
  /** Populated when `vendors.specializations` column exists (alias in SQL). */
  v_specs_jsonb?: unknown;
};

/**
 * Load merged vendor specialization keys (vendor_specializations + JSONB + metadata)
 * and resolve human-readable labels via specialization_master (one batched query).
 * Used by GET /customer/discover-services and GET /customer/services/by-style so the
 * customer app can show badges/filters and match tile labels to stored UUIDs/slugs.
 */
export async function batchLoadVendorSpecializationsForDiscovery(
  rows: VendorRowForSpecBundle[]
): Promise<Map<string, { raw: string[]; displayLabels: string[] }>> {
  const out = new Map<string, { raw: string[]; displayLabels: string[] }>();
  if (!rows?.length) return out;

  const idList = [...new Set(rows.map((r) => String(r.vendor_id || '').trim()).filter(Boolean))];
  if (idList.length === 0) return out;

  const metaSpecsByVendor = new Map<string, string[]>();
  const jsonbSpecsByVendor = new Map<string, string[]>();

  for (const row of rows) {
    const vid = String(row.vendor_id || '').trim();
    if (!vid) continue;

    try {
      const meta =
        typeof row.metadata === 'string' ? JSON.parse(row.metadata || '{}') : (row.metadata || {});
      const m = (meta as any)?.specializations;
      if (Array.isArray(m)) {
        const arr = m
          .map((x: any) =>
            typeof x === 'string' ? x.trim() : String(x?.id ?? x ?? '').trim()
          )
          .filter(Boolean);
        if (arr.length) metaSpecsByVendor.set(vid, arr);
      }
    } catch {
      /* non-fatal */
    }

    if (row.v_specs_jsonb != null) {
      try {
        let arr: string[] = [];
        if (Array.isArray(row.v_specs_jsonb)) {
          arr = row.v_specs_jsonb.map((x: any) => String(x).trim()).filter(Boolean);
        } else if (typeof row.v_specs_jsonb === 'string') {
          const parsed = JSON.parse(row.v_specs_jsonb || '[]');
          arr = Array.isArray(parsed) ? parsed.map((x: any) => String(x).trim()).filter(Boolean) : [];
        }
        if (arr.length) jsonbSpecsByVendor.set(vid, arr);
      } catch {
        /* non-fatal */
      }
    }
  }

  let tableRows: { vendor_id: string; specialization: string }[] = [];
  try {
    const res = await query(
      `SELECT vendor_id::text AS vendor_id, specialization
       FROM vendor_specializations
       WHERE vendor_id = ANY($1::uuid[])`,
      [idList]
    );
    tableRows = (res.rows || []) as { vendor_id: string; specialization: string }[];
  } catch {
    tableRows = [];
  }

  const tableByVendor = new Map<string, string[]>();
  for (const r of tableRows) {
    const vid = String(r.vendor_id || '').trim();
    const s = String(r.specialization || '').trim();
    if (!vid || !s) continue;
    if (!tableByVendor.has(vid)) tableByVendor.set(vid, []);
    tableByVendor.get(vid)!.push(s);
  }

  const rawByVendor = new Map<string, string[]>();
  for (const vid of idList) {
    const fromTable = tableByVendor.get(vid) || [];
    const fromJsonb = jsonbSpecsByVendor.get(vid) || [];
    const fromMeta = metaSpecsByVendor.get(vid) || [];
    /** Union all sources (deduped) — facility sync can lag one store; discovery must not drop specs. */
    const merged: string[] = [...fromTable, ...fromJsonb, ...fromMeta];

    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const x of merged) {
      const k = String(x).trim();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      deduped.push(k);
    }
    rawByVendor.set(vid, deduped);
  }

  const allRaw = new Set<string>();
  for (const arr of rawByVendor.values()) {
    for (const x of arr) allRaw.add(x);
  }

  const labelByRaw = new Map<string, string>();
  const keys = Array.from(allRaw).filter((k) => k.length > 0);
  if (keys.length > 0) {
    try {
      const res = await query(
        `SELECT DISTINCT ON (q.inval)
            q.inval AS raw_in,
            COALESCE(
              NULLIF(TRIM(sm.display_name), ''),
              NULLIF(TRIM(sm.name), ''),
              NULLIF(TRIM(sm.specialization_id), ''),
              q.inval
            ) AS lbl
         FROM unnest($1::text[]) AS q(inval)
         LEFT JOIN specialization_master sm
           ON sm.is_active = true
          AND (
                sm.id::text = TRIM(q.inval)
             OR LOWER(TRIM(sm.specialization_id)) = LOWER(TRIM(q.inval))
             OR LOWER(TRIM(sm.name)) = LOWER(TRIM(q.inval))
             OR LOWER(TRIM(sm.display_name)) = LOWER(TRIM(q.inval))
             OR regexp_replace(LOWER(TRIM(sm.specialization_id)), '[^a-z0-9]+', '_', 'g')
                = regexp_replace(LOWER(TRIM(q.inval)), '[^a-z0-9]+', '_', 'g')
          )
         ORDER BY q.inval, sm.id NULLS LAST`,
        [keys]
      );
      for (const r of res.rows || []) {
        const rawIn = String((r as any).raw_in || '').trim();
        if (!rawIn) continue;
        labelByRaw.set(rawIn, String((r as any).lbl || rawIn));
      }
      for (const k of keys) {
        if (!labelByRaw.has(k)) labelByRaw.set(k, k);
      }
    } catch {
      for (const k of keys) labelByRaw.set(k, k);
    }
  }

  for (const vid of idList) {
    const raw = rawByVendor.get(vid) || [];
    const displayLabels = raw.map((k) => labelByRaw.get(k) || k);
    out.set(vid, { raw, displayLabels });
  }

  return out;
}

/**
 * Safely parse operating_hours from the vendors table.
 * Returns the parsed object if valid JSON, or null if it's plain text / malformed.
 * This prevents crashes when a vendor has human-readable text like "Open Daily: 9-6"
 * instead of a proper JSON schedule object.
 */
export function safeParseOperatingHours(raw: any): Record<string, any> | null {
  if (!raw) return null;
  if (typeof raw === 'object') return raw; // already parsed (e.g. from JSONB column)
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' ? parsed : null;
  } catch {
    console.warn('[ServiceDiscovery] Skipping non-JSON operating_hours:', raw.substring(0, 60));
    return null;
  }
}

/** vendors.metadata may arrive as JSONB object or serialized string depending on driver/path. */
export function parseVendorMetadata(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, any>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, any>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function vendorAmenitiesFromMetadata(
  metadata: Record<string, any>,
  vendorRow?: { amenities?: unknown }
): { amenities: string[]; customAmenities: string[] } {
  const rawAmenities = metadata.amenities ?? vendorRow?.amenities;
  const rawCustom = metadata.customAmenities ?? metadata.custom_amenities;
  const amenities = Array.isArray(rawAmenities)
    ? rawAmenities.map((a) => String(a).trim()).filter(Boolean)
    : [];
  const customAmenities = Array.isArray(rawCustom)
    ? rawCustom.map((a) => String(a).trim()).filter(Boolean)
    : [];
  return { amenities, customAmenities };
}

/** Parse vendor_services.metadata (JSONB or string) for customer listings. */
export function parseVendorServiceMetadataForCustomer(vsMetadata: unknown): Record<string, any> {
  if (!vsMetadata) return {};
  if (typeof vsMetadata === 'object' && !Array.isArray(vsMetadata)) {
    return vsMetadata as Record<string, any>;
  }
  if (typeof vsMetadata === 'string') {
    try {
      const p = JSON.parse(vsMetadata);
      return typeof p === 'object' && p !== null && !Array.isArray(p) ? (p as Record<string, any>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Custom vendor packages store flags under metadata.isPackage and sessions under metadata.packageDetails.
 * Aligns customer API with vendor dashboard shape (business + solo).
 */
export function vendorServicePackagePresentationForCustomer(
  metadata: Record<string, any>,
  durationFallback: number
): { isPackage: boolean; packageDetails: Record<string, any> | undefined } {
  const pdRaw = metadata?.packageDetails;
  const pkg =
    pdRaw && typeof pdRaw === 'object' && !Array.isArray(pdRaw) ? ({ ...pdRaw } as Record<string, any>) : {};
  const pkgSessions = pkg.totalSessions ?? pkg.total_sessions;
  const legacySessions = metadata?.totalSessions ?? metadata?.total_sessions;
  const totalSessionsNum = Number(pkgSessions ?? legacySessions);
  const hasSessionBundle = Number.isFinite(totalSessionsNum) && totalSessionsNum > 0;
  const isPackage =
    Boolean(metadata?.isPackage) ||
    metadata?.type === 'package' ||
    metadata?.packageType === 'session' ||
    hasSessionBundle;

  if (!isPackage) return { isPackage: false, packageDetails: undefined };

  const validityDays =
    pkg.validityDays ??
    pkg.validity_days ??
    metadata?.validityDays ??
    metadata?.validity_days ??
    pkg.packageDuration;
  const sessionDuration =
    Number(
      pkg.sessionDuration ??
        pkg.session_duration ??
        metadata?.sessionDuration ??
        durationFallback
    ) || durationFallback;
  const priceNum = Number(pkg.price ?? pkg.packagePrice ?? metadata?.price);
  const packageDetails: Record<string, any> = {
    ...pkg,
    totalSessions:
      Number.isFinite(totalSessionsNum) && totalSessionsNum > 0
        ? totalSessionsNum
        : pkg.totalSessions ?? pkg.total_sessions,
    validityDays: validityDays ?? undefined,
    sessionDuration,
  };
  if (Number.isFinite(priceNum) && !Number.isNaN(priceNum)) {
    packageDetails.price = priceNum;
  }
  return { isPackage: true, packageDetails };
}

/** PG/client may return boolean or 't'/'f'. Unknown/null → treat as online (do not hide vendors). */
export function vendorRowIsOnline(isOnline: unknown): boolean {
  if (isOnline === false || isOnline === 'f' || isOnline === 'false' || isOnline === 0 || isOnline === '0') {
    return false;
  }
  return true;
}

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

export function vendorRoleIsTrainingHub(name: string | null | undefined): boolean {
  if (!name) return false;
  return TRAINING_HUB_ROLE_NAMES_LOWER.includes(String(name).toLowerCase().trim());
}

/**
 * Customer **Behavioral** hub only (`?category=behaviourist`). Narrower than {@link TRAINING_HUB_ROLE_NAMES_LOWER}
 * so empty-category / training-category shortcuts do not surface every obedience trainer.
 */
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

export function vendorRoleIsBehaviorHub(name: string | null | undefined): boolean {
  if (!name) return false;
  return BEHAVIOR_HUB_ROLE_NAMES_LOWER.includes(String(name).toLowerCase().trim());
}

const WALKER_HUB_ROLE_NAMES_LOWER: readonly string[] = [
  'walker',
  'walker_solo',
  'pet_walker',
  'dog_walker',
];

export function vendorRoleIsWalkerHub(name: string | null | undefined): boolean {
  if (!name) return false;
  return WALKER_HUB_ROLE_NAMES_LOWER.includes(String(name).toLowerCase().trim());
}

// ✅ Using helper functions from constants/helper.ts instead of duplicate implementations

/** Flatten metadata.gallery / facility_photos entries (strings or { url, key, … }). */
export function flattenMetadataGalleryItems(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const t = item.trim();
      if (t) out.push(t);
      continue;
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const o = item as Record<string, unknown>;
      const cand =
        o.url ??
        o.photoUrl ??
        o.photo_url ??
        o.src ??
        o.imageUrl ??
        o.image ??
        o.photo;
      if (typeof cand === 'string' && cand.trim()) {
        out.push(cand.trim());
        continue;
      }
      if (typeof o.key === 'string' && o.key.trim()) {
        out.push(o.key.trim());
      }
    }
  }
  return out;
}

/** Dedupe gallery inputs by S3 key / path so the same object is not presigned twice. */
export function dedupeGalleryInputsPreserveOrder(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const trimmed = u.trim();
    if (!trimmed) continue;
    let norm =
      extractS3KeyFromUrl(trimmed) ||
      (() => {
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          try {
            return new URL(trimmed).pathname.replace(/^\/+/, '') || trimmed.split('?')[0];
          } catch {
            return trimmed.split('?')[0];
          }
        }
        return trimmed.split('?')[0].split('#')[0];
      })();
    norm = (norm || trimmed).toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(trimmed);
  }
  return out;
}

/**
 * Turn one facility/gallery metadata value into a fresh presigned GET URL (or public URL / fallback).
 * Mirrors GET /customer/facility photo logic so GET /customer/vendor can return the same shape.
 */
export async function resolveOneFacilityPhotoToPresignedUrl(
  vendorId: string,
  photoItem: string,
  // Dynamic import('@aws-sdk/client-s3') is not typed as namespace in this project; runtime has S3Client.
  s3Client: { send: (command: unknown) => Promise<unknown> },
  BUCKET_NAME: string
): Promise<string | null> {
  try {
    if (!photoItem || typeof photoItem !== 'string') {
      return null;
    }

    let fileKey = photoItem.trim();

    if (photoItem.includes('.s3.') && photoItem.includes('.amazonaws.com/')) {
      const urlParts = photoItem.split('.amazonaws.com/');
      if (urlParts.length > 1) {
        fileKey = urlParts[1].split('?')[0].split('#')[0];
      }
    } else if (
      photoItem.includes('?') &&
      (photoItem.includes('X-Amz') || photoItem.includes('AWSAccessKeyId'))
    ) {
      const urlParts = photoItem.split('?')[0];
      const vendorsIndex = urlParts.indexOf('vendors/');
      if (vendorsIndex >= 0) {
        // Use the key embedded in the URL — do not rewrite to route param vendorId (may be identity id).
        fileKey = urlParts.substring(vendorsIndex);
      }
    } else if (photoItem.startsWith('vendors/')) {
      // Stored S3 key — use as-is (upload-photos writes vendors/{vendors.id}/facility/...).
      fileKey = fileKey.split('?')[0].split('#')[0];
    } else if (photoItem.startsWith('http://') || photoItem.startsWith('https://')) {
      return photoItem;
    }

    if (!fileKey || fileKey.length === 0) {
      console.warn(`[FACILITY-PHOTOS] Could not extract file key from:`, photoItem);
      return null;
    }

    const s3: any = await import('@aws-sdk/client-s3');
    const { GetObjectCommand, HeadObjectCommand } = s3;
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

    try {
      const headCommand = new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
      });
      await s3Client.send(headCommand);
    } catch (headError: any) {
      if (headError.name === 'NotFound' || headError.$metadata?.httpStatusCode === 404) {
        console.warn(`[FACILITY-PHOTOS] Object not found in S3: ${fileKey}`);
        return null;
      }
      console.warn(`[FACILITY-PHOTOS] Error checking object existence: ${fileKey}`, headError?.message);
    }

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
    });

    const presignedUrl = await getSignedUrl(s3Client as any, command, { expiresIn: 604800 });

    if (!presignedUrl || typeof presignedUrl !== 'string' || !presignedUrl.startsWith('https://')) {
      console.error(`[FACILITY-PHOTOS] Invalid presigned URL generated for ${fileKey}`);
      return null;
    }

    return presignedUrl;
  } catch (error: any) {
    console.error(
      `[FACILITY-PHOTOS] Error generating presigned URL for ${photoItem}:`,
      error?.message || error
    );
    if (photoItem && (photoItem.startsWith('http://') || photoItem.startsWith('https://'))) {
      return photoItem;
    }
    return null;
  }
}

/** Presign all facility gallery items for customer display; deduped and order-stable. */
export async function presignCustomerFacilityGalleryUrls(vendorId: string, rawInput: unknown[]): Promise<string[]> {
  const items = dedupeGalleryInputsPreserveOrder(flattenMetadataGalleryItems(rawInput));
  if (items.length === 0) return [];

  const photos = await mapWithConcurrency(items, 3, async (photoItem) => {
    const resolved = await resolveImageForContext(photoItem, {
      assetType: 'facility',
      ownerId: vendorId,
      vendorId,
      context: 'list',
      migrate: true,
      persist: {
        kind: 'vendor_facility_photo',
        vendorId,
        legacyValue: photoItem,
      },
    });
    return resolved?.displayUrl ?? null;
  });

  return photos.filter((url): url is string => url !== null && url !== undefined && url.length > 0);
}

import { columnExists } from '../../../../utils/schema-probes';
export { columnExists };

/**
 * Migration 737 adds vendors.service_distance_km. Many environments (dev / not-yet-migrated)
 * still miss it, so reference it through this helper which falls back to NULL when absent.
 * Returns a SELECT fragment that always exposes `service_radius` + `service_distance_km`.
 */
export async function vendorDistanceSelectColumnsSql(vAlias = 'v'): Promise<string> {
  const hasServiceDistanceKm = await columnExists('vendors', 'service_distance_km');
  return hasServiceDistanceKm
    ? `${vAlias}.service_radius, ${vAlias}.service_distance_km`
    : `${vAlias}.service_radius, NULL::numeric AS service_distance_km`;
}

const STYLE_ALIASES: Record<string, string> = {
  at_clinic: 'at_center',
  at_vendor: 'at_center',
  at_center: 'at_center',
  home_visit: 'at_home',
  at_home: 'at_home',
  video_consultation: 'tele',
  online: 'tele',
  tele: 'tele',
};

export function normalizeServiceStyle(style: string | null | undefined): string | null {
  if (!style) return null;
  const key = String(style).toLowerCase().trim().replace(/\s+/g, '_');
  return STYLE_ALIASES[key] || key;
}

export function normalizeServiceStylesArray(styles: any): string[] {
  if (!styles) return [];
  const arr = Array.isArray(styles) ? styles : (styles?.selected ?? styles?.solo ?? []);
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  for (const s of arr) {
    const norm = normalizeServiceStyle(s);
    if (norm && !out.includes(norm)) out.push(norm);
  }
  return out;
}

export function parseRoleConfig(roleConfig: any): any {
  if (!roleConfig) return null;
  try {
    return typeof roleConfig === 'string' ? JSON.parse(roleConfig || '{}') : roleConfig;
  } catch {
    return null;
  }
}

export function roleConfigAllowsStyle(roleConfig: any, serviceStyle: string | null | undefined): boolean {
  const normalized = normalizeServiceStyle(serviceStyle || '') || '';
  if (!normalized) return true;
  const config = parseRoleConfig(roleConfig);
  if (!config) return true;

  // ✅ FIX: Handle nested serviceStyles structure (serviceStyles.solo, serviceStyles.selected, etc.)
  let styles: string[] = [];
  if (config?.serviceStyles) {
    if (Array.isArray(config.serviceStyles)) {
      styles = normalizeServiceStylesArray(config.serviceStyles);
    } else if (typeof config.serviceStyles === 'object') {
      // Handle nested structure: serviceStyles.solo, serviceStyles.selected, etc.
      const nestedStyles = config.serviceStyles.selected || config.serviceStyles.solo || config.serviceStyles.business || [];
      styles = normalizeServiceStylesArray(Array.isArray(nestedStyles) ? nestedStyles : []);
    }
  } else if (config?.service_styles) {
    styles = normalizeServiceStylesArray(config.service_styles);
  }

  if (styles.length === 0) return true;

  // ✅ FIX: For at_center service style, be more permissive
  // If a vendor has a published at_center service (verified by SQL query),
  // they should be discoverable even if role_config doesn't explicitly list it
  // This handles cases where role_config is outdated or incomplete
  if (normalized === 'at_center') {
    // Allow if role_config includes at_center or any of its aliases
    const centerAliases = ['at_center', 'at_vendor', 'at_clinic', 'center', 'clinic'];
    if (styles.some(s => centerAliases.includes(s))) {
      return true;
    }
    // If role_config has serviceStyles defined but doesn't include at_center,
    // still allow it (vendor has published at_center service, so role_config might be outdated)
    // This is safe because the SQL query already verified the vendor has a published at_center service
    console.log('[roleConfigAllowsStyle] Allowing at_center despite role_config not explicitly listing it (vendor has published service)');
    return true;
  }

  // tele / at_home: strict — Admin role catalogue (serviceStyles.selected/solo/business) must list the style.
  // Published vendor_services alone must not bypass role (aligns customer discovery + vendor UI).
  if (normalized === 'tele' || normalized === 'at_home') {
    const teleAliases = ['tele', 'online', 'video_consultation', 'video', 'remote'];
    const atHomeAliases = ['at_home', 'home', 'at_home_visit', 'home_visit'];
    const relevantAliases = normalized === 'tele' ? teleAliases : atHomeAliases;
    return styles.some((s) => relevantAliases.includes(s) || s === normalized);
  }

  const allows = styles.includes(normalized);
  console.log('[roleConfigAllowsStyle] serviceStyle=%s, normalized=%s, styles=%s, allows=%s', serviceStyle, normalized, JSON.stringify(styles), allows);
  return allows;
}

export function acceptableStylesForService(serviceStyle: string | null | undefined): string[] {
  const normalized = normalizeServiceStyle(serviceStyle || '') || '';
  if (!normalized) return [];
  if (normalized === 'at_center') return ['at_center', 'at_vendor', 'at_clinic'];
  if (normalized === 'tele') return ['tele', 'online', 'video_consultation'];
  if (normalized === 'at_home') return ['at_home', 'home_visit'];
  return [normalized];
}

/** Prefer dedicated boarding disclaimer columns; fall back to vendor metadata (legacy). */
export function resolveBoardingDisclaimerFromVendor(vendorRow: any, metadata: Record<string, any>): {
  disclaimer: string;
  disclaimerPoints: string[];
} {
  let points: string[] = [];
  const raw = vendorRow?.boarding_disclaimer_points;
  if (Array.isArray(raw)) {
    points = raw.map((x: unknown) => String(x ?? '').trim()).filter(Boolean);
  } else if (raw && typeof raw === 'object') {
    try {
      const arr = Array.isArray(raw) ? raw : JSON.parse(JSON.stringify(raw));
      if (Array.isArray(arr)) {
        points = arr.map((x: unknown) => String(x ?? '').trim()).filter(Boolean);
      }
    } catch {
      /* ignore */
    }
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) {
        points = p.map((x: unknown) => String(x ?? '').trim()).filter(Boolean);
      }
    } catch {
      /* ignore */
    }
  }
  if (points.length === 0 && Array.isArray(metadata?.disclaimerPoints)) {
    points = metadata.disclaimerPoints.map((x: unknown) => String(x ?? '').trim()).filter(Boolean);
  }
  if (points.length === 0 && typeof metadata?.disclaimer === 'string' && metadata.disclaimer.trim()) {
    points = metadata.disclaimer
      .split(/\n+/)
      .map((line: string) => line.trim())
      .filter(Boolean);
  }
  const text =
    typeof vendorRow?.boarding_disclaimer === 'string' && vendorRow.boarding_disclaimer.trim()
      ? String(vendorRow.boarding_disclaimer)
      : points.length > 0
        ? points.join('\n')
        : (metadata.disclaimer || '');
  // If DB has prose in boarding_disclaimer but points array is empty, still return bullets for UIs that only read disclaimerPoints.
  let disclaimerPoints = points;
  if (disclaimerPoints.length === 0 && typeof text === 'string' && text.trim()) {
    disclaimerPoints = text
      .split(/\n+/)
      .map((line: string) => line.trim())
      .filter(Boolean);
  }
  return { disclaimer: text, disclaimerPoints };
}

/** Map canonical role names to customer-facing discovery categories (align with CustomerHomeComplete tiles). */
export function getCategoryFromRole(roleId: string): string {
  const roleCategoryMap: Record<string, string> = {
    // Vet
    'vet_clinic': 'vet', 'veterinarian': 'vet', 'vet_solo': 'vet', 'vet': 'vet',
    // Grooming
    'grooming_salon': 'grooming', 'pet_groomer': 'grooming', 'groomer': 'grooming', 'groomer_solo': 'grooming', 'groomer_center': 'grooming', 'grooming_solo': 'grooming',
    // Training
    'trainer': 'training', 'pet_trainer': 'training', 'trainer_solo': 'training', 'trainer_center': 'training', 'training_center': 'training', 'training_solo': 'training', 'solo': 'training',
    // Walker
    'dog_walker': 'walker', 'pet_walker': 'walker', 'walker': 'walker', 'walker_solo': 'walker', 'walking': 'walker',
    // Boarding
    'boarding': 'boarding', 'boarding_resort': 'boarding', 'pet_boarding': 'boarding', 'pet_boarder': 'boarding', 'pet_daycare': 'boarding',
    // Nutrition
    'nutritionist': 'nutrition', 'pet_nutritionist': 'nutrition', 'nutritionist_center': 'nutrition', 'nutritionist_solo': 'nutrition',
    // Adoption (shelter / adoption center)
    'adoption_center': 'adoption', 'ngo': 'adoption', 'shelter': 'adoption', 'pet_shelter': 'adoption', 'pet_adoption_center': 'adoption',
    // Shop / marketplace
    'seller': 'shop', 'pet_store': 'shop', 'pet_products_store': 'shop',
    // Diagnostics / lab
    'diagnostics_center': 'diagnostics', 'diagnostics_provider': 'diagnostics', 'diagnostics_solo': 'diagnostics',
    // Pharmacy, cafe, photography, insurance, ambulance, breeder, relocation, resort, holiday, sunset
    'pharmacy': 'pharmacy', 'pet_pharmacy': 'pharmacy',
    'cafe': 'cafes', 'pet_cafe': 'cafes',
    'photographer': 'photography', 'pet_photographer': 'photography',
    'insurance': 'insurance', 'pet_insurance': 'insurance',
    'ambulance': 'ambulance', 'pet_ambulance': 'ambulance',
    'breeder': 'breeder', 'pet_breeder': 'breeder',
    'relocation': 'relocation', 'pet_taxi': 'relocation', 'pet_transport': 'relocation', 'pet_relocation': 'relocation',
    'resort': 'resort', 'pet_resort': 'resort',
    'holiday': 'holiday',
    'sunset': 'sunset', 'pet_sunset_services': 'sunset',
    'event_organizer': 'events', 'pet_event_organizer': 'events',
    // Behaviourist, sitting
    'behaviourist': 'behaviourist',
    'pet_behaviourist': 'behaviourist',
    'behaviourist_solo': 'behaviourist',
    'behaviourist_center': 'behaviourist',
    'behaviorist': 'behaviourist',
    'behaviorist_solo': 'behaviourist',
    'behaviorist_center': 'behaviourist',
    'dog_behaviourist': 'behaviourist',
    'pet_behaviorist': 'behaviourist',
    'pet_sitter': 'sitting', 'sitter': 'sitting', 'sitter_solo': 'sitting',
  };
  return roleCategoryMap[roleId] || roleCategoryMap[roleId?.toLowerCase?.()] || 'other';
}

/** DB-driven: role names that have at least one approved/active vendor with any published service.
 * Aligned with admin active vendors: no r.is_active filter so walker/trainer/groomer/vet all appear. */
export async function getDiscoverableRoleNames(): Promise<string[]> {
  const result = await query(`
    SELECT DISTINCT r.name AS role_name
    FROM vendors v
    INNER JOIN roles r ON v.role_id = r.id
    WHERE ${sqlVendorDiscoverableStatus('v')}
      AND ${sqlVendorOnlineForCustomerDiscovery('v')}
      AND v.is_active = true
      AND EXISTS (
        SELECT 1 FROM vendor_services vs
        WHERE vs.vendor_id = v.id
          AND ${sqlVendorServiceDiscoverable('vs', false)}
      )
    ORDER BY r.name
  `);
  return (result.rows || []).map((r: any) => r.role_name).filter(Boolean);
}

/** Role ID aliases: customer web / UI may send alternate spellings; DB uses canonical role names */
const ROLE_ID_ALIASES: Record<string, string> = {
  diagnostic_center: 'diagnostics_center',
  diagnostics: 'diagnostics_center',
};

/** Static role names per category for discovery when DB-driven list is empty. Align with 25 canonical roles. */
const CATEGORY_ROLE_NAMES: Record<string, string[]> = {
  vet: ['veterinarian', 'vet_clinic', 'vet_solo', 'vet'],
  grooming: ['groomer', 'groomer_solo', 'groomer_center', 'grooming_solo', 'pet_groomer'],
  training: ['trainer', 'trainer_solo', 'trainer_center', 'training_center', 'training_solo', 'pet_trainer', 'solo'],
  walker: ['walker', 'walker_solo', 'pet_walker', 'dog_walker'],
  walking: ['walker', 'walker_solo', 'pet_walker', 'dog_walker'],
  boarding: ['boarding', 'pet_boarder', 'pet_daycare', 'pet_boarding'],
  nutrition: ['nutritionist', 'nutritionist_solo', 'nutritionist_center', 'pet_nutritionist'],
  nutritionist: ['nutritionist', 'nutritionist_solo', 'nutritionist_center', 'pet_nutritionist'],
  adoption: ['adoption_center', 'pet_shelter', 'pet_adoption_center'],
  shop: ['seller', 'pet_products_store'],
  diagnostics: ['diagnostics_center', 'diagnostics_provider', 'diagnostics_solo'],
  'lab-diagnostics': ['diagnostics_center', 'diagnostics_provider', 'diagnostics_solo'],
  pharmacy: ['pharmacy', 'pet_pharmacy'],
  cafes: ['cafe', 'pet_cafe'],
  cafe: ['cafe', 'pet_cafe'],
  photography: ['photographer', 'pet_photographer'],
  insurance: ['insurance', 'pet_insurance'],
  ambulance: ['ambulance', 'pet_ambulance'],
  breeder: ['breeder', 'pet_breeder'],
  relocation: ['relocation', 'pet_taxi', 'pet_transport', 'pet_relocation'],
  resort: ['resort', 'pet_resort'],
  holiday: ['holiday'],
  sunset: ['sunset', 'pet_sunset_services'],
  events: ['event_organizer', 'pet_event_organizer'],
  behaviourist: [
    'behaviourist',
    'behaviourist_solo',
    'behaviourist_center',
    'pet_behaviourist',
    'behaviorist',
    'behaviorist_solo',
    'behaviorist_center',
    'dog_behaviourist',
    'pet_behaviorist',
  ],
  sitting: ['pet_sitter', 'sitter_solo', 'sitter'],
};

/** Resolve target role names for discovery: from category or roleId, restricted to DB-discoverable roles.
 * When category/roleId is provided: return ALL discoverable roles in that category (e.g. walker → walker_solo, pet_walker, dog_walker).
 * Falls back to static CATEGORY_ROLE_NAMES when no discoverable roles exist so new vendors are still queryable. */
export async function resolveTargetRolesForDiscovery(category?: string | null, roleId?: string | null): Promise<string[]> {
  const discoverable = await getDiscoverableRoleNames();
  let rawCategory = category?.toLowerCase().trim() || (roleId ? getCategoryFromRole(roleId) : null);
  // Normalize customer tile categoryIds to discovery category (e.g. lab-diagnostics → diagnostics for role lookup)
  if (rawCategory === 'lab-diagnostics') { rawCategory = 'diagnostics' };
  const effectiveCategory = rawCategory && getCategoryFromRole(rawCategory) !== 'other' ? getCategoryFromRole(rawCategory) : rawCategory;
  if (effectiveCategory) {
    const fromDb = discoverable.filter((role) => getCategoryFromRole(role) === effectiveCategory);
    if (fromDb.length > 0) return fromDb;
    // Support both normalized and raw (e.g. lab-diagnostics, cafes) for customer tile categoryIds
    return CATEGORY_ROLE_NAMES[effectiveCategory] || CATEGORY_ROLE_NAMES[rawCategory!] || [];
  }
  if (roleId) {
    const lower = roleId.toLowerCase().trim();
    const canonical = ROLE_ID_ALIASES[lower] || lower;
    const match = discoverable.find((r) => r.toLowerCase() === canonical || r.toLowerCase() === lower);
    return match ? [match] : [];
  }
  return discoverable;
}

export async function getCoordinates(
  source: 'customer' | 'vendor',
  identifier: string,
  phone?: string
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    if (source === 'customer') {
      // Customer: Use existing getCustomerCoordinates function
      const customerId = identifier.includes('-') ? identifier : null; // UUID format check
      const customerPhone = customerId ? null : (identifier || phone || null);
      return await getCustomerCoordinates(customerPhone, customerId);
    } else {
      // Vendor: Query vendors table with separate latitude/longitude columns
      const vendorId = identifier;

      const vendorResult = await query(
        `SELECT latitude, longitude 
         FROM vendors 
         WHERE id = $1 
         LIMIT 1`,
        [vendorId]
      );

      if (vendorResult.rows.length === 0) {
        console.warn('[getCoordinates] No vendor found', { vendorId });
        return null;
      }

      const vendor = vendorResult.rows[0];

      if (vendor.latitude != null && vendor.longitude != null) {
        const latitude = parseFloat(String(vendor.latitude));
        const longitude = parseFloat(String(vendor.longitude));

        console.log('[getCoordinates] Extracted from vendor columns', {
          vendorId,
          latitude,
          longitude
        });

        return { latitude, longitude };
      }

      console.warn('[getCoordinates] Vendor has no coordinates', {
        vendorId,
        hasLat: vendor.latitude != null,
        hasLng: vendor.longitude != null,
      });

      return null;
    }
  } catch (error) {
    console.error('[getCoordinates] Unexpected error', {
      error: error instanceof Error ? error.message : String(error),
      source,
      identifier,
    });
    return null;
  }
}
/** 
 * Get next available slot for a vendor from vendor_availability_v2.
 * Returns null if no availability set.
 * Display format:
 * - Today: "Today 2:00 PM"
 * - Tomorrow: "Tomorrow 2:00 PM"
 * - This week (2-6 days): "Wed 2:00 PM"
 * - Next week+: "Feb 28, 2:00 PM"
 */
export async function getNextAvailableSlot(
  vendorId: string,
  phone: string,
  serviceStyleFilter?: string[]
): Promise<{ date: string; time: string; display: string } | null> {
  try {
    const now = new Date();
    const todayYmd = ymdInIst(now);
    const SLOT_DURATION = 30; // minutes - atomic slot size

    // Build query to get availability WINDOWS (start + end time) for slot generation
    let va2Query = `
      SELECT day_of_week,
             COALESCE(time_window_start, start_time) as start_time,
             COALESCE(time_window_end, end_time) as end_time
      FROM vendor_availability_v2
      WHERE (vendor_id = $1 OR vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = $1 OR phone = $2))
        AND (is_available IS NULL OR is_available = true)
    `;
    const params: any[] = [vendorId, phone || ''];

    if (serviceStyleFilter && serviceStyleFilter.length > 0) {
      // ✅ FIX: Dynamically check which columns exist to avoid "column does not exist" errors
      // Dev/UAT may only have service_styles (array), while prod may have both service_style and service_styles
      let styleConditions: string[] = [];
      let cols: { has_service_styles?: boolean; has_service_style?: boolean; has_service_type?: boolean } = {};
      try {
        const colCheck = await query(`
          SELECT 
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_availability_v2' AND column_name = 'service_styles') as has_service_styles,
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_availability_v2' AND column_name = 'service_style') as has_service_style,
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_availability_v2' AND column_name = 'service_type') as has_service_type
        `);
        cols = colCheck.rows[0] || {};
        if (cols.has_service_styles) styleConditions.push(`COALESCE(service_styles, ARRAY[]::text[]) && $3::text[]`);
        if (cols.has_service_style) styleConditions.push(`service_style = ANY($3::text[])`);
        if (cols.has_service_type) styleConditions.push(`service_type = ANY($3::text[])`);
      } catch (_) {
        // Fallback to just service_styles (safest, present in both dev and prod)
        styleConditions = [`COALESCE(service_styles, ARRAY[]::text[]) && $3::text[]`];
        cols = { has_service_styles: true };
      }
      if (styleConditions.length > 0) {
        // Legacy rows: style columns unset → treat as matching any requested style (discovery already scoped vendor_services by style)
        const legacyParts: string[] = [];
        if (cols.has_service_type) legacyParts.push('service_type IS NULL');
        if (cols.has_service_style) legacyParts.push('service_style IS NULL');
        if (cols.has_service_styles) {
          legacyParts.push('(service_styles IS NULL OR cardinality(service_styles) = 0)');
        }
        const legacyOr =
          legacyParts.length > 0 ? ` OR (${legacyParts.join(' AND ')})` : '';
        va2Query += ` AND (${styleConditions.join(' OR ')}${legacyOr})`;
      }
      params.push(serviceStyleFilter);
    }

    va2Query += ` ORDER BY day_of_week ASC, COALESCE(time_window_start, start_time) ASC`;

    const va2 = await query(va2Query, params);
    if (!va2.rows || va2.rows.length === 0) return null;

    // ✅ ENHANCED: Check up to 14 days ahead, generating 30-min slots and checking bookings
    // This ensures the "next available slot" is truly available (not already booked)

    // Helper: convert HH:MM to minutes
    const toMin = (t: any): number => {
      const s = (t || '09:00').toString();
      const clean = s.includes('T') ? s.split('T')[1].substring(0, 5) : s.substring(0, 5);
      const [h, m] = clean.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    // Resolve vendor ID for bookings query (bookings use vendors.id, not vendor_identity.id)
    let bookingsVendorId = vendorId;
    try {
      const viCheck = await query(
        `SELECT vendor_id FROM vendor_identity WHERE id = $1 LIMIT 1`,
        [vendorId]
      );
      if (viCheck.rows && viCheck.rows.length > 0 && viCheck.rows[0].vendor_id) {
        bookingsVendorId = viCheck.rows[0].vendor_id;
      }
    } catch (_) { /* use original vendorId */ }

    for (let dayOffset = 0; dayOffset <= 13; dayOffset++) {
      const dateStr = addDaysToYmd(todayYmd, dayOffset);
      const checkDayOfWeek = dayOfWeekFromYmd(dateStr);

      // Find availability windows for this day of week
      const dayWindows = va2.rows.filter((r: any) => Number(r.day_of_week) === checkDayOfWeek);
      if (dayWindows.length === 0) continue;

      // ✅ CRITICAL: Get booked slot times for this date (atomic: only start times matter)
      let bookedTimes: Set<string> = new Set();
      try {
        const bookResult = await query(
          `SELECT booking_time FROM bookings
           WHERE vendor_id = $1 AND booking_date = $2
             AND status NOT IN ('cancelled', 'rejected', 'no_show')`,
          [bookingsVendorId, dateStr]
        );
        for (const b of (bookResult.rows || [])) {
          const t = b.booking_time;
          let timeStr: string;
          if (typeof t === 'string') {
            timeStr = t.includes('T') ? t.split('T')[1].substring(0, 5) : t.substring(0, 5);
          } else {
            timeStr = String(t).substring(0, 5);
          }
          bookedTimes.add(timeStr);
        }
      } catch (_) { /* no bookings = all slots free */ }

      // Generate 30-min slots from availability windows and find first non-booked
      for (const window of dayWindows) {
        const winStart = toMin(window.start_time);
        const winEnd = toMin(window.end_time);

        let currentMinutes = winStart;
        while (currentMinutes + SLOT_DURATION <= winEnd) {
          const timeStr = `${String(Math.floor(currentMinutes / 60)).padStart(2, '0')}:${String(currentMinutes % 60).padStart(2, '0')}`;

          // Skip if past (for today) — IST + min notice buffer
          if (isSlotPastInIst(dateStr, timeStr, DEFAULT_MIN_NOTICE_MINUTES, now)) {
            currentMinutes += SLOT_DURATION;
            continue;
          }

          // ✅ CRITICAL: Skip if this slot is already booked (atomic check)
          if (bookedTimes.has(timeStr)) {
            currentMinutes += SLOT_DURATION;
            continue;
          }

          const display = formatNextAvailableDisplay(dateStr, timeStr, todayYmd);

          return {
            date: dateStr,
            time: timeStr,
            display,
          };
        }
      }
    }

    return null; // No available slot found in next 14 days
  } catch (err: any) {
    console.error('[getNextAvailableSlot] ERROR vendor=%s: %s', vendorId?.substring(0, 8), err?.message || err);
    return null;
  }
}

/** Clean service description: strip wrapping quotes, trim whitespace */
export function cleanDescription(desc: string | null | undefined): string | undefined {
  if (!desc || typeof desc !== 'string') return undefined;
  let cleaned = desc.trim();
  // Strip wrapping double-quotes from catalog descriptions
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }
  // Unescape internal escaped quotes
  cleaned = cleaned.replace(/\\"/g, '"');
  // Unescape newlines (service_catalog stores \n as \\n)
  cleaned = cleaned.replace(/\\n/g, '\n');
  return cleaned || undefined;
}

/** Deduplicate services array by service name + style (safety measure) */
export function deduplicateServices(services: any[]): any[] {
  const seen = new Map<string, any>();
  for (const service of services) {
    // Use service_name + service_style as key (not ID, because database may have duplicate rows with different IDs)
    const serviceName = service.name || service.service_name || service.serviceName || '';
    const serviceStyle = service.serviceStyle || service.service_style || '';
    const key = `${serviceName}_${serviceStyle}`.toLowerCase().trim();

    if (key && !seen.has(key)) {
      seen.set(key, service);
    } else if (key && seen.has(key)) {
      const prev = seen.get(key)!;
      const pkgScore = (s: any) =>
        (s?.isPackage ? 2 : 0) +
        (s?.metadata &&
        typeof s.metadata === 'object' &&
        (s.metadata.isPackage || s.metadata.packageDetails || s.metadata.type === 'package')
          ? 1
          : 0);
      if (pkgScore(service) > pkgScore(prev)) {
        seen.set(key, service);
        continue;
      }
      // Duplicate found - log warning but keep first occurrence
      console.warn(`[Deduplication] Duplicate service detected: ${key} (ID: ${service.id || service.serviceId || 'unknown'}). Keeping first occurrence.`);
    } else if (!key) {
      // No key available - use ID as fallback
      const fallbackKey = service.id || service.serviceId || `unknown_${Math.random()}`;
      if (!seen.has(fallbackKey)) {
        seen.set(fallbackKey, service);
      }
    }
  }
  return Array.from(seen.values());
}

/**
 * Enrich vendor_services rows for customer discovery lists (by-style, discover-services)
 * with the same isPackage / packageDetails semantics as GET /customer/vendor/:id/services.
 */
export function mapVendorServiceRowForCustomerDiscoveryList(s: any): any {
  const rawPrice =
    s.custom_price != null && s.custom_price !== ''
      ? parseFloat(String(s.custom_price))
      : parseFloat(String(s.price ?? 0));
  const duration = Number(s.duration ?? s.duration_minutes ?? s.custom_duration ?? 30) || 30;
  const metadata = parseVendorServiceMetadataForCustomer(s.vs_metadata);
  const { isPackage, packageDetails } = vendorServicePackagePresentationForCustomer(metadata, duration);
  let price = Number.isFinite(rawPrice) ? rawPrice : 0;
  if (isPackage && packageDetails) {
    const pkgPrice = Number(packageDetails.price);
    if (Number.isFinite(pkgPrice) && pkgPrice >= 0 && (!Number.isFinite(price) || price <= 0)) {
      price = pkgPrice;
    }
  }
  return {
    id: s.id,
    serviceId: s.service_id,
    name: s.service_name,
    serviceName: s.service_name,
    price,
    duration,
    description: cleanDescription(s.description),
    category: s.category_name,
    categoryName: s.category_name,
    catalogCategoryId: s.catalog_category_id ?? s.category_id ?? null,
    catalogServiceId: s.catalog_service_id ?? null,
    serviceStyle: s.service_style || null,
    service_style: s.service_style || null,
    metadata,
    isPackage,
    packageDetails: isPackage ? packageDetails : undefined,
    publishStatus: s.publish_status,
    isEnabled: s.is_enabled !== false && s.is_enabled !== 'f' && s.is_enabled !== 'false',
  };
}

/**
 * Count vendors that match GET /customer/discover-services base SQL + the same minRating
 * and radius behaviour as the listing endpoint (without per-vendor enrichment).
 */
export async function countDiscoverableVendorsForDiscoveryQuery(opts: {
  serviceStyleRaw: string;
  category?: string;
  roleId?: string;
  latitude: string | null;
  longitude: string | null;
  radiusQ?: string;
  maxDistanceQ?: string;
  minRatingQ?: string;
  specialization?: string | null;
}): Promise<number> {
  const serviceStyleNorm = normalizeServiceStyle(opts.serviceStyleRaw) || opts.serviceStyleRaw;
  const category = opts.category;
  const roleId = opts.roleId;

  const rules = await getDiscoveryRules(
    roleId || category || 'all',
    'discover',
    serviceStyleNorm as string,
    category || undefined
  );
  const radius = discoveryCustomerRadiusKm({
    rules,
    serviceStyleNorm,
    radiusFromQuery: opts.radiusQ,
  });
  const maxDistanceKm = opts.maxDistanceQ ? parseFloat(opts.maxDistanceQ) : null;
  const minRatingVal = opts.minRatingQ ? parseFloat(opts.minRatingQ) : null;

  const acceptableStyles = acceptableStylesForService(serviceStyleNorm);
  const customerLat = opts.latitude ? parseFloat(opts.latitude) : null;
  const customerLng = opts.longitude ? parseFloat(opts.longitude) : null;

  const vendorExists = await buildDiscoveryVendorExistsSql({
    category,
    roleId,
    serviceStyle: serviceStyleNorm,
    paramOffset: 1,
    forVendorCount: true,
  });
  const { sittingDiscoveryRelaxed } = vendorExists.keys;
  const vendorParams: any[] = [...vendorExists.params];

  const specKeysCount = await resolveSpecializationDiscoveryKeys((opts.specialization || '').trim());
  let specializationCountFragment = '';
  if (specKeysCount.length > 0) {
    const p0 = vendorParams.length + 1;
    specializationCountFragment = sqlVendorMatchesDeclaredSpecialization(p0);
    vendorParams.push(
      specKeysCount.map((k) => k.trim().toLowerCase()),
      specializationDiscoveryIlikePatterns(specKeysCount)
    );
  }

  const vendorDistanceColsCount = await vendorDistanceSelectColumnsSql('v');
  const vendorListSql = `
        SELECT v.id AS vendor_id,
               v.latitude, v.longitude,
               ${vendorDistanceColsCount},
               COALESCE((SELECT AVG(rating) FROM reviews WHERE vendor_id = v.id), 0)::float AS avg_rating
        FROM vendors v
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE v.is_active = true
          AND ${sqlVendorDiscoverableStatus('v')}
          AND ${sqlVendorOnlineForCustomerDiscovery('v')}
          ${specializationCountFragment}
          AND ${vendorExists.sql}
          ${vendorExists.availabilitySql}
      `;

  const vendorRows = await query(vendorListSql, vendorParams);
  let candidates = vendorRows.rows as {
    vendor_id: string;
    latitude: unknown;
    longitude: unknown;
    service_radius?: unknown;
    service_distance_km?: unknown;
    avg_rating: unknown;
  }[];

  if (minRatingVal != null && minRatingVal > 0) {
    candidates = candidates.filter((row) => parseFloat(String(row.avg_rating ?? 0)) >= minRatingVal);
  }

  if (customerLat != null && customerLng != null) {
    const platformHome = rules.discovery_radius_km_home ?? 10;
    if (serviceStyleNorm === 'at_home') {
      const withinRadius = candidates.filter((row) => {
        const lat = row.latitude != null ? parseFloat(String(row.latitude)) : null;
        const lng = row.longitude != null ? parseFloat(String(row.longitude)) : null;
        if (lat == null || lng == null) return true;
        const dist = calculateDistance(customerLat, customerLng, lat, lng);
        const vendorCap = vendorHomeServiceRadiusKm(row) ?? platformHome;
        const cap =
          maxDistanceKm != null && Number.isFinite(maxDistanceKm)
            ? Math.min(maxDistanceKm, vendorCap)
            : radius != null && radius > 0
              ? Math.min(radius, vendorCap)
              : vendorCap;
        return dist <= cap;
      });
      if (withinRadius.length > 0) {
        candidates = withinRadius;
      } else if (!sittingDiscoveryRelaxed) {
        candidates = withinRadius;
      }
    } else {
      const effectiveMaxKm =
        maxDistanceKm ?? (radius != null && radius > 0 ? radius : null);
      if (effectiveMaxKm != null) {
        const withinRadius = candidates.filter((row) => {
          const lat = row.latitude != null ? parseFloat(String(row.latitude)) : null;
          const lng = row.longitude != null ? parseFloat(String(row.longitude)) : null;
          if (lat == null || lng == null) return true;
          const dist = calculateDistance(customerLat, customerLng, lat, lng);
          return dist <= effectiveMaxKm;
        });
        if (withinRadius.length > 0) {
          candidates = withinRadius;
        } else if (!sittingDiscoveryRelaxed) {
          candidates = withinRadius;
        }
      }
    }
  }

  return candidates.length;
}

type CustomerVendorProfileBundle = {
  success: true;
  vendor: Record<string, unknown>;
  services: unknown[];
  reviews: unknown[];
  staff: unknown[];
};

export async function fetchCustomerVendorProfileBundle(vendorId: string): Promise<CustomerVendorProfileBundle | null> {
  const vendor = await resolveVendorById(vendorId);
  if (!vendor) return null;
  const resolvedVendorId = vendor.id;

  const roles = await select('roles', { id: vendor.role_id });
  const role = roles[0];

  const serviceColumns = await query(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'services' AND column_name = 'is_global'`
  );
  const hasIsGlobal = serviceColumns.rows.length > 0;

  const services = await query(
    `SELECT s.*, vs.custom_price, vs.custom_duration, vs.is_enabled, vs.service_style
     FROM services s
     LEFT JOIN vendor_services vs ON s.id = vs.service_id AND vs.vendor_id = $1
     WHERE (vs.vendor_id = $1${hasIsGlobal ? ' OR s.is_global = true' : ''})
     AND s.is_active = true
     AND (vs.is_enabled IS NULL OR vs.is_enabled = true)
     ORDER BY s.name`,
    [resolvedVendorId]
  );

  const reviews = await query(
    `SELECT r.*, c.full_name as customer_name
     FROM reviews r
     LEFT JOIN customers c ON r.customer_id = c.id
     WHERE r.vendor_id = $1 
     AND r.is_approved = true
     ORDER BY r.created_at DESC
     LIMIT 20`,
    [resolvedVendorId]
  );

  const avgRating = reviews.rows.length > 0
    ? reviews.rows.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.rows.length
    : 0;

  const staff = await query(
    `SELECT s.* FROM staff s
     WHERE s.vendor_id = $1 
     AND s.is_active = true
     ORDER BY s.name`,
    [resolvedVendorId]
  );

  let vendorSpecializations: string[] = [];
  try {
    const specRes = await query(`SELECT specialization FROM vendor_specializations WHERE vendor_id = $1`, [resolvedVendorId]);
    vendorSpecializations = (specRes.rows || []).map((r: any) => r.specialization).filter(Boolean);
  } catch (_) { }
  if (vendorSpecializations.length === 0 && vendor.specializations) {
    try {
      vendorSpecializations = Array.isArray(vendor.specializations)
        ? vendor.specializations
        : JSON.parse(vendor.specializations || '[]');
    } catch (_) { }
  }

  let vendorServiceStyles: string[] = [];
  try {
    const styleRes = await query(
      `SELECT DISTINCT service_style FROM vendor_services
       WHERE vendor_id = $1 AND is_enabled = true AND (publish_status IN ('published','auto_published') OR publish_status IS NULL)
       AND service_style IS NOT NULL`,
      [resolvedVendorId]
    );
    vendorServiceStyles = (styleRes.rows || []).map((r: any) => normalizeServiceStyle(r.service_style)).filter(Boolean) as string[];
  } catch (_) { }

  const vendorMeta = parseVendorMetadata(vendor.metadata);

  let facilityPhotos: string[] = [];
  try {
    const raw = vendorMeta.facility_photos || vendorMeta.photos || [];
    const rawArr = Array.isArray(raw) ? raw : [];
    facilityPhotos = await presignCustomerFacilityGalleryUrls(resolvedVendorId, rawArr);
  } catch (_) {
    facilityPhotos = [];
  }

  const profileSpecMap = await batchLoadVendorSpecializationsForDiscovery([
    {
      vendor_id: String(vendor.id),
      metadata: vendor.metadata,
      v_specs_jsonb: (vendor as { specializations?: unknown }).specializations,
    },
  ]);
  const profileSpecializationLabels =
    profileSpecMap.get(String(vendor.id))?.displayLabels ?? [];
  const specializationsForProfile =
    profileSpecializationLabels.length > 0
      ? profileSpecializationLabels
      : vendorSpecializations.length > 0
        ? vendorSpecializations
        : Array.isArray(vendorMeta.specializations)
          ? vendorMeta.specializations.map((s: unknown) => String(s).trim()).filter(Boolean)
          : [];

  const boardingDiscProfile = resolveBoardingDisclaimerFromVendor(vendor, vendorMeta || {});

  return {
    success: true,
    vendor: {
      id: vendor.id,
      businessName: vendor.business_name,
      ownerName: vendor.owner_name,
      roleId: vendor.role_id,
      roleName: role?.name,
      category: getCategoryFromRole(
        String(role?.name || '')
          .toLowerCase()
          .replace(/-/g, '_')
      ),
      address: vendor.address,
      city: vendor.city,
      state: vendor.state,
      pincode: vendor.pincode,
      phone: vendor.phone,
      email: vendor.email,
      latitude: vendor.latitude,
      longitude: vendor.longitude,
      rating: avgRating,
      totalReviews: reviews.rows.length,
      operatingHours: safeParseOperatingHours(vendor.operating_hours),
      description: vendor.description || '',
      qualifications: vendor.qualifications || null,
      experienceYears:
        vendor.experience_years != null && vendor.experience_years !== ''
          ? Number(vendor.experience_years)
          : null,
      photoUrl: await getVendorListingPhotoUrl(vendor),
      vendorType: vendor.vendor_type === 'solo' ? 'solo' : 'business',
      /** Solo/professional profile field — vendors.experience_years (saved in vendor-web). */
      experience_years: vendor.experience_years ?? null,
      experienceYears: vendor.experience_years ?? null,
      qualifications: vendor.qualifications ?? null,
      specializations: specializationsForProfile,
      serviceStyles: vendorServiceStyles,
      facilityPhotos,
      boardingDisclaimer: boardingDiscProfile.disclaimer,
      boardingDisclaimerPoints: boardingDiscProfile.disclaimerPoints,
      ...vendorAmenitiesFromMetadata(vendorMeta, vendor),
    },
    services: services.rows,
    reviews: reviews.rows,
    staff: staff.rows,
  };
}

const GUEST_VENDOR_STAFF_OMIT = new Set([
  'phone',
  'email',
  'bank_account',
  'bank_account_number',
  'ifsc',
  'ifsc_code',
  'pan',
  'pan_number',
  'aadhar',
  'aadhaar',
  'password',
  'password_hash',
]);

export function guestSafeCustomerName(raw: unknown): string {
  const name = String(raw ?? '').trim();
  if (!name) return 'Customer';
  const first = name.split(/\s+/)[0];
  return first || 'Customer';
}

/** Strip PII / internal fields for anonymous vendor share profile reads. */
export function sanitizeGuestVendorProfileBundle(bundle: CustomerVendorProfileBundle) {
  const vendor = { ...bundle.vendor };
  delete vendor.phone;
  delete vendor.email;
  delete vendor.ownerName;

  const services = (bundle.services || []).map((row: any) => {
    const s = { ...row };
    delete s.vendor_id;
    delete s.created_by;
    delete s.updated_by;
    return s;
  });

  const reviews = (bundle.reviews || []).map((row: any) => ({
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    created_at: row.created_at,
    customer_name: guestSafeCustomerName(row.customer_name),
  }));

  const staff = (bundle.staff || []).map((row: any) => {
    const s: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row || {})) {
      if (GUEST_VENDOR_STAFF_OMIT.has(key)) continue;
      if (/bank|ifsc|pan|aadhaar|password/i.test(key)) continue;
      s[key] = value;
    }
    return s;
  });

  return {
    success: true as const,
    vendor,
    services,
    reviews,
    staff,
  };
}
