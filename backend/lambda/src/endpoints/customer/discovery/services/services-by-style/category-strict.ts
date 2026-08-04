import {
  BEHAVIOR_HUB_ROLE_SQL_IN_LIST,
  TRAINING_HUB_ROLE_SQL_IN_LIST,
} from '../../../../../lib/discovery-vendor-query';

export function buildStrictCustomDiscoverySql(
  strictCategoryIds: string[],
  hasVsCategoryIdCol: boolean,
  boardingDiscoverySearchByStyle: boolean,
  trainingDiscoverySearchByStyle: boolean
): string {
  if (strictCategoryIds.length > 0 && hasVsCategoryIdCol) {
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const clean = strictCategoryIds.filter((id) => UUID_RE.test(String(id).trim()));
    if (clean.length === 0) return '';
    const arr = `ARRAY[${clean.map((id) => `'${String(id).trim()}'::uuid`).join(',')}]::uuid[]`;
    if (boardingDiscoverySearchByStyle) {
      return ` AND (
    COALESCE(vs.is_custom_service, false) = false
    OR (
      vs.is_custom_service = true
      AND (
        (vs.category_id IS NOT NULL AND vs.category_id = ANY(${arr}))
        OR LOWER(TRIM(COALESCE(vs.category, ''))) IN ('boarding', 'pet_boarding', 'pet boarding')
      )
    )
  )`;
    }
    if (trainingDiscoverySearchByStyle) {
      return ` AND (
    COALESCE(vs.is_custom_service, false) = false
    OR (
      vs.is_custom_service = true
      AND (
        (vs.category_id IS NOT NULL AND vs.category_id = ANY(${arr}))
        OR LOWER(TRIM(COALESCE(vs.category, ''))) LIKE '%training%'
        OR LOWER(TRIM(COALESCE(vs.category, ''))) IN ('behavioral','behaviour','behavioural','behaviourist','behavior','behavior_modification')
        OR TRIM(COALESCE(vs.category, '')) = ''
        OR LOWER(COALESCE(TRIM(r.name), '')) IN (${TRAINING_HUB_ROLE_SQL_IN_LIST})
      )
    )
  )`;
    }
    return ` AND (
    COALESCE(vs.is_custom_service, false) = false
    OR (
      vs.is_custom_service = true
      AND vs.category_id IS NOT NULL
      AND vs.category_id = ANY(${arr})
    )
  )`;
  }
  if (trainingDiscoverySearchByStyle && hasVsCategoryIdCol) {
    return ` AND (
    COALESCE(vs.is_custom_service, false) = false
    OR (
      vs.is_custom_service = true
      AND (
        LOWER(TRIM(COALESCE(vs.category, ''))) LIKE '%training%'
        OR LOWER(TRIM(COALESCE(vs.category, ''))) IN ('behavioral','behaviour','behavioural','behaviourist','behavior','behavior_modification')
        OR TRIM(COALESCE(vs.category, '')) = ''
        OR LOWER(COALESCE(TRIM(r.name), '')) IN (${TRAINING_HUB_ROLE_SQL_IN_LIST})
      )
    )
  )`;
  }
  if (boardingDiscoverySearchByStyle && hasVsCategoryIdCol) {
    return ` AND (
    COALESCE(vs.is_custom_service, false) = false
    OR (
      vs.is_custom_service = true
      AND LOWER(TRIM(COALESCE(vs.category, ''))) IN ('boarding', 'pet_boarding', 'pet boarding')
    )
  )`;
  }
  return '';
}
