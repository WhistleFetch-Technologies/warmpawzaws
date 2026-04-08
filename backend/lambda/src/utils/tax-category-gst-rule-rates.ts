import { query } from '../database/rds-connection';
import { toFiniteDbNum } from './tax-category-display-rate';

/**
 * Build max gst_rate per tax category id from gst_rules (Flexible Tax).
 * Uses tax_category_id when set; otherwise matches free-text gr.category to category name.
 */
export async function loadGstRuleRatesByTaxCategoryId(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const mergeRate = (categoryId: string | null | undefined, rate: number) => {
    if (categoryId == null || categoryId === '' || !Number.isFinite(rate) || rate <= 0) return;
    const k = String(categoryId);
    const prev = map.get(k) ?? 0;
    if (rate > prev) map.set(k, rate);
  };

  try {
    const gr = await query(`
      SELECT tax_category_id::text AS tax_category_id, MAX(gst_rate::numeric) AS gst_rate
      FROM gst_rules
      WHERE tax_category_id IS NOT NULL
        AND COALESCE(enabled, true) = true
      GROUP BY tax_category_id
    `);
    for (const r of gr.rows ?? []) {
      const n = toFiniteDbNum(r.gst_rate);
      if (n !== undefined) mergeRate(r.tax_category_id as string, n);
    }
  } catch (e) {
    console.warn('[gst-rule-rates] tax_category_id aggregate failed:', e);
  }

  try {
    const gr2 = await query(`
      SELECT tc.id::text AS tax_category_id, MAX(gr.gst_rate::numeric) AS gst_rate
      FROM tax_categories tc
      INNER JOIN gst_rules gr ON COALESCE(gr.enabled, true) = true
        AND gr.category IS NOT NULL
        AND TRIM(gr.category) <> ''
        AND (
          LOWER(TRIM(gr.category)) = LOWER(TRIM(COALESCE(tc.category_name::text, '')))
          OR LOWER(TRIM(gr.category)) = LOWER(TRIM(COALESCE(tc.name::text, '')))
        )
      GROUP BY tc.id
    `);
    for (const r of gr2.rows ?? []) {
      const n = toFiniteDbNum(r.gst_rate);
      if (n !== undefined) mergeRate(r.tax_category_id as string, n);
    }
  } catch (e) {
    console.warn('[gst-rule-rates] category-name join failed (optional):', e);
  }

  return map;
}
