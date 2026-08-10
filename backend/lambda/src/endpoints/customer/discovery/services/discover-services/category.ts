import { DistanceResolver } from '../../../../../lib/utils/vendor-customer-distance';
import {
  appendVetDiscoveryCategoryAliasKeys,
  appendWalkerDiscoveryCategoryAliasKeys,
  catTextRequestsBehaviorHub,
} from '../../../../../lib/discovery-vendor-query';
import { getDiscoveryVendorListSchemaFlags } from '../../../../../utils/discovery-vendor-list-setup';
import * as discover_servicesRepo from '../../repos/discover-services.repo';
import { columnExists } from '../../repos/legacy-helpers.repo';
import type { DiscoverCategoryContext, DiscoverServicesParsed } from './types';

const isUuid = (s?: string) =>
  !!s &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

export async function buildDiscoverCategoryContext(
  parsed: DiscoverServicesParsed
): Promise<DiscoverCategoryContext> {
  const { category, roleId, customerLat, customerLng, customerApproximateDiscover } = parsed;

  const rawCategoryKeys: string[] = [];
  if (category) rawCategoryKeys.push(String(category));
  if (roleId) rawCategoryKeys.push(String(roleId));
  appendVetDiscoveryCategoryAliasKeys(rawCategoryKeys, category);
  appendWalkerDiscoveryCategoryAliasKeys(rawCategoryKeys, category);
  appendWalkerDiscoveryCategoryAliasKeys(rawCategoryKeys, roleId);
  const catTextExact: string[] = rawCategoryKeys.filter(k => !isUuid(k)).map(k => k.toLowerCase());
  const catTextLike: string[] = catTextExact.map(k => `%${k}%`);
  const catUUIDs: string[] = rawCategoryKeys.filter(k => isUuid(k));
  const isVetCategoryDiscovery = catTextExact.some((c) =>
    ['vet', 'vet care', 'veterinary', 'veterinarian'].includes(c)
  );

  /** Solo sitters often lack vendor_availability_v2 rows; still show them if they have published at_home services. */
  const sittingDiscoveryRelaxed = Boolean(
    catTextExact.some((c) =>
      ['sitting', 'pet_sitter', 'sitter', 'sitter_solo'].includes(c)
    ) ||
      (Boolean(roleId) &&
        ['pet_sitter', 'sitter', 'sitter_solo', 'pet_sitter_solo', 'pet_sitter_saas'].includes(
          String(roleId).toLowerCase().replace(/-/g, '_')
        ))
  );

  /** Pet boarding list uses category=boarding / roleId=pet_boarding; some centers have at_center rows with empty vs.category */
  const boardingDiscoverySearch =
    catTextExact.some((c) => ['boarding', 'pet_boarding'].includes(c)) ||
    (roleId &&
      ['pet_boarding', 'boarding'].includes(String(roleId).toLowerCase().replace(/-/g, '_')));

  /**
   * Nutrition: catalog/custom rows may leave vs.category empty while vendors.role is pet_nutritionist / nutritionist
   * (mirrors boardingRoleUncategorizedOr so experts still appear in discovery).
   */
  const nutritionDiscoverySearch =
    catTextExact.some(
      (c) =>
        ['nutrition', 'nutritionist', 'pet_nutritionist', 'pet nutritionist'].includes(c) ||
        c.includes('nutritionist') ||
        c === 'pet nutrition' ||
        (c.length >= 8 && c.startsWith('nutrition'))
    ) ||
    (roleId &&
      ['pet_nutritionist', 'nutritionist', 'nutritionist_center', 'nutritionist_solo'].includes(
        String(roleId).toLowerCase().replace(/-/g, '_')
      ));

  /**
   * Training hub (?category=training): vendor_services often use "Behavioral" while discovery filters on "training".
   * Mirror nutrition/boarding: alias category text + allow empty category for trainer/behaviorist roles.
   */
  const trainingDiscoverySearch =
    !sittingDiscoveryRelaxed &&
    catTextExact.some((c) => c === 'training' || c.includes('training'));

  /**
   * Behavioral hub (`?category=behaviourist`): services are usually tagged `training` / `behavioral` / blank
   * (same as the training hub). The literal `behaviourist` category on `vendor_services` is rare, so without
   * these OR branches behaviorists disappear from UniversalServicesByStyle / home flow.
   */
  const behaviorHubDiscoverySearch =
    !sittingDiscoveryRelaxed && catTextRequestsBehaviorHub(catTextExact);

  /** Dog walk add-on for non-walker accounts: category may be blank or still "vet" / "grooming". */
  const walkerCategoryDiscoveryOr =
    !sittingDiscoveryRelaxed &&
    catTextExact.some((c) => ['walker', 'walking', 'dog_walker', 'pet_walker'].includes(c))
      ? ` OR (
              vs.service_style = 'at_home'
              AND (
                LOWER(COALESCE(vs.service_name, '')) LIKE '%dog%walk%'
                OR LOWER(COALESCE(vs.service_name, '')) LIKE '%pet%walk%'
                OR (
                  LOWER(COALESCE(vs.service_name, '')) LIKE '%walk%'
                  AND LOWER(COALESCE(vs.service_name, '')) NOT LIKE '%walk-in%'
                )
              )
              AND (
                TRIM(COALESCE(vs.category, '')) = ''
                OR LOWER(COALESCE(vs.category, '')) = ANY(ARRAY['vet', 'veterinarian', 'veterinary', 'vet care', 'grooming', 'other']::text[])
              )
            )`
      : '';

  /**
   * Boarding discovery: custom rows may store the hub only in `vendor_services.category_id` (text `vs.category` empty).
   * Text filters alone miss those rows — especially for pet_sitter / multi-role vendors offering at_center boarding.
   */
  const hasVsCategoryIdDiscover = await columnExists('vendor_services', 'category_id');
  let boardingCustomCategoryIdOrSql = '';
  if (boardingDiscoverySearch && hasVsCategoryIdDiscover) {
    const slugRes = await discover_servicesRepo.dbDiscoverServices0().catch(() => ({ rows: [] as { id: string }[] }));
    const ids = (slugRes.rows || []).map((r: any) => r?.id).filter(Boolean);
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const clean = ids.filter((id: string) => UUID_RE.test(String(id).trim()));
    if (clean.length > 0) {
      const uuidList = clean.map((id) => `'${String(id).trim()}'::uuid`).join(', ');
      boardingCustomCategoryIdOrSql = `
                OR (
                  COALESCE(vs.is_custom_service, false) = true
                  AND vs.category_id IS NOT NULL
                  AND vs.category_id = ANY(ARRAY[${uuidList}]::uuid[])
                )`;
    }
  }

  let trainingCustomCategoryIdOrSql = '';
  if (trainingDiscoverySearch && hasVsCategoryIdDiscover) {
    const slugResTraining = await discover_servicesRepo.dbDiscoverServices1().catch(() => ({ rows: [] as { id: string }[] }));
    const idsT = (slugResTraining.rows || []).map((r: any) => r?.id).filter(Boolean);
    const UUID_RE_T =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const cleanT = idsT.filter((id: string) => UUID_RE_T.test(String(id).trim()));
    if (cleanT.length > 0) {
      const uuidListT = cleanT.map((id) => `'${String(id).trim()}'::uuid`).join(', ');
      trainingCustomCategoryIdOrSql = `
                OR (
                  COALESCE(vs.is_custom_service, false) = true
                  AND vs.category_id IS NOT NULL
                  AND vs.category_id = ANY(ARRAY[${uuidListT}]::uuid[])
                )`;
    }
  }

  let walkerCustomCategoryIdOrSql = '';
  const walkerHubFetch =
    !sittingDiscoveryRelaxed &&
    catTextExact.some((c) => ['walker', 'walking', 'dog_walker', 'pet_walker'].includes(c));
  if (walkerHubFetch && hasVsCategoryIdDiscover) {
    const slugResWalk = await discover_servicesRepo
      .dbDiscoverServicesWalkingCategories()
      .catch(() => ({ rows: [] as { id: string }[] }));
    const idsW = (slugResWalk.rows || []).map((r: any) => r?.id).filter(Boolean);
    const UUID_RE_W =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const cleanW = idsW.filter((id: string) => UUID_RE_W.test(String(id).trim()));
    if (cleanW.length > 0) {
      const uuidListW = cleanW.map((id) => `'${String(id).trim()}'::uuid`).join(', ');
      walkerCustomCategoryIdOrSql = `
                OR (
                  COALESCE(vs.is_custom_service, false) = true
                  AND vs.category_id IS NOT NULL
                  AND vs.category_id = ANY(ARRAY[${uuidListW}]::uuid[])
                )`;
    }
  }

  const { hasLogoUrl, hasVendorSpecializationsCol } = await getDiscoveryVendorListSchemaFlags();
  const logoCol = hasLogoUrl ? 'v.logo_url' : 'NULL';
  const vendorSpecsJsonbSql = hasVendorSpecializationsCol ? 'v.specializations' : 'NULL::jsonb';

  const distResolverDiscover = new DistanceResolver(customerLat, customerLng, customerApproximateDiscover);

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
    walkerCategoryDiscoveryOr,
    boardingCustomCategoryIdOrSql,
    trainingCustomCategoryIdOrSql,
    walkerCustomCategoryIdOrSql,
    hasLogoUrl,
    hasVendorSpecializationsCol,
    logoCol,
    vendorSpecsJsonbSql,
    distResolverDiscover,
  };
}
