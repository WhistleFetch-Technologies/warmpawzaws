/**
 * Admin APIs for ecommerce subcategory mapping rules + rebuild.
 */

import { Hono } from 'hono';
import { query } from '../../../database/rds-connection';
import { isValidUUID } from '../../../utils/uuid-validation';
import {
  rebuildProductCategoryLinksForParent,
  ruleMatchesProduct,
  type CategoryRuleRow,
} from '../../../utils/product-subcategory-classifier';

function parseKeywordList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((k) => String(k ?? '').trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[\n,]+/)
      .map((k) => k.trim())
      .filter(Boolean);
  }
  return [];
}

export function registerEcommerceCategoryRulesEndpoints(app: Hono) {
  /**
   * GET /admin/ecommerce/categories/:categoryId/rules
   */
  app.get('/admin/ecommerce/categories/:categoryId/rules', async (c) => {
    try {
      const categoryId = c.req.param('categoryId');
      if (!isValidUUID(categoryId)) {
        return c.json({ error: 'Invalid category id' }, 400);
      }

      const cat = await query(
        `SELECT id::text AS id, name, parent_category_id::text AS parent_category_id
         FROM ecommerce_categories WHERE id = $1::uuid LIMIT 1`,
        [categoryId]
      );
      const row = cat.rows[0] as
        | { id: string; name: string; parent_category_id: string | null }
        | undefined;
      if (!row) return c.json({ error: 'Category not found' }, 404);
      if (!row.parent_category_id) {
        return c.json({
          success: true,
          rules: null,
          message: 'Mapping rules apply to subcategories only',
        });
      }

      const rulesRes = await query(
        `SELECT id::text AS id,
                subcategory_id::text AS subcategory_id,
                COALESCE(include_keywords, '{}') AS include_keywords,
                COALESCE(exclude_keywords, '{}') AS exclude_keywords,
                COALESCE(brand_includes, '{}') AS brand_includes,
                is_active,
                created_at,
                updated_at
         FROM ecommerce_category_rules
         WHERE subcategory_id = $1::uuid
         LIMIT 1`,
        [categoryId]
      );

      return c.json({
        success: true,
        category: row,
        rules: rulesRes.rows[0] ?? {
          subcategory_id: categoryId,
          include_keywords: [],
          exclude_keywords: [],
          brand_includes: [],
          is_active: true,
        },
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('ecommerce_category_rules') || (error as { code?: string }).code === '42P01') {
        return c.json({ error: 'Category rules not available until migration 1088 is applied' }, 503);
      }
      console.error('[admin category rules GET]', error);
      return c.json({ error: msg }, 500);
    }
  });

  /**
   * PUT /admin/ecommerce/categories/:categoryId/rules
   * Save rules only — does not rebuild existing product links.
   */
  app.put('/admin/ecommerce/categories/:categoryId/rules', async (c) => {
    try {
      const categoryId = c.req.param('categoryId');
      if (!isValidUUID(categoryId)) {
        return c.json({ error: 'Invalid category id' }, 400);
      }

      const cat = await query(
        `SELECT id::text AS id, parent_category_id::text AS parent_category_id
         FROM ecommerce_categories WHERE id = $1::uuid LIMIT 1`,
        [categoryId]
      );
      const row = cat.rows[0] as { id: string; parent_category_id: string | null } | undefined;
      if (!row) return c.json({ error: 'Category not found' }, 404);
      if (!row.parent_category_id) {
        return c.json({ error: 'Rules can only be saved on subcategories' }, 400);
      }

      const body = await c.req.json();
      const includeKeywords = parseKeywordList(body.include_keywords ?? body.includeKeywords);
      const excludeKeywords = parseKeywordList(body.exclude_keywords ?? body.excludeKeywords);
      const brandIncludes = parseKeywordList(body.brand_includes ?? body.brandIncludes);
      const isActive = body.is_active !== false && body.isActive !== false;

      const upsert = await query(
        `INSERT INTO ecommerce_category_rules (
           subcategory_id, include_keywords, exclude_keywords, brand_includes, is_active, created_at, updated_at
         ) VALUES ($1::uuid, $2::text[], $3::text[], $4::text[], $5, NOW(), NOW())
         ON CONFLICT (subcategory_id) DO UPDATE SET
           include_keywords = EXCLUDED.include_keywords,
           exclude_keywords = EXCLUDED.exclude_keywords,
           brand_includes = EXCLUDED.brand_includes,
           is_active = EXCLUDED.is_active,
           updated_at = NOW()
         RETURNING id::text AS id,
                   subcategory_id::text AS subcategory_id,
                   include_keywords,
                   exclude_keywords,
                   brand_includes,
                   is_active,
                   updated_at`,
        [categoryId, includeKeywords, excludeKeywords, brandIncludes, isActive]
      );

      return c.json({
        success: true,
        rules: upsert.rows[0],
        message: 'Rules saved. Use Rebuild mappings to update existing products.',
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[admin category rules PUT]', error);
      return c.json({ error: msg }, 500);
    }
  });

  /**
   * POST /admin/ecommerce/categories/:categoryId/rules/preview
   * Dry-run match against parent catalog using provided or saved rules.
   */
  app.post('/admin/ecommerce/categories/:categoryId/rules/preview', async (c) => {
    try {
      const categoryId = c.req.param('categoryId');
      if (!isValidUUID(categoryId)) {
        return c.json({ error: 'Invalid category id' }, 400);
      }

      const cat = await query(
        `SELECT id::text AS id, name, parent_category_id::text AS parent_category_id
         FROM ecommerce_categories WHERE id = $1::uuid LIMIT 1`,
        [categoryId]
      );
      const row = cat.rows[0] as
        | { id: string; name: string; parent_category_id: string | null }
        | undefined;
      if (!row?.parent_category_id) {
        return c.json({ error: 'Preview requires a subcategory' }, 400);
      }

      const body = await c.req.json().catch(() => ({}));
      let rule: CategoryRuleRow;

      if (
        body.include_keywords != null ||
        body.includeKeywords != null ||
        body.exclude_keywords != null ||
        body.brand_includes != null
      ) {
        rule = {
          subcategory_id: categoryId,
          include_keywords: parseKeywordList(body.include_keywords ?? body.includeKeywords),
          exclude_keywords: parseKeywordList(body.exclude_keywords ?? body.excludeKeywords),
          brand_includes: parseKeywordList(body.brand_includes ?? body.brandIncludes),
        };
      } else {
        const saved = await query(
          `SELECT subcategory_id::text AS subcategory_id,
                  COALESCE(include_keywords, '{}') AS include_keywords,
                  COALESCE(exclude_keywords, '{}') AS exclude_keywords,
                  COALESCE(brand_includes, '{}') AS brand_includes
           FROM ecommerce_category_rules
           WHERE subcategory_id = $1::uuid AND is_active = true
           LIMIT 1`,
          [categoryId]
        );
        const s = saved.rows[0] as CategoryRuleRow | undefined;
        if (!s) {
          return c.json({ success: true, count: 0, samples: [], message: 'No saved rules' });
        }
        rule = s;
      }

      const products = await query(
        `SELECT id::text AS id, name, description, brand
         FROM products
         WHERE category_id = $1::uuid
         ORDER BY updated_at DESC NULLS LAST
         LIMIT 2000`,
        [row.parent_category_id]
      );

      const matched: { id: string; name: string }[] = [];
      for (const p of products.rows as {
        id: string;
        name?: string;
        description?: string;
        brand?: string;
      }[]) {
        if (ruleMatchesProduct(rule, p.name, p.description, p.brand)) {
          matched.push({ id: p.id, name: String(p.name ?? '') });
        }
      }

      return c.json({
        success: true,
        count: matched.length,
        scanned: products.rows.length,
        samples: matched.slice(0, 25),
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[admin category rules preview]', error);
      return c.json({ error: msg }, 500);
    }
  });

  /**
   * POST /admin/ecommerce/categories/:categoryId/rules/rebuild
   * Rebuild AUTO links for all products under this subcategory's parent.
   */
  app.post('/admin/ecommerce/categories/:categoryId/rules/rebuild', async (c) => {
    try {
      const categoryId = c.req.param('categoryId');
      if (!isValidUUID(categoryId)) {
        return c.json({ error: 'Invalid category id' }, 400);
      }

      const cat = await query(
        `SELECT id::text AS id, parent_category_id::text AS parent_category_id
         FROM ecommerce_categories WHERE id = $1::uuid LIMIT 1`,
        [categoryId]
      );
      const row = cat.rows[0] as { id: string; parent_category_id: string | null } | undefined;
      if (!row) return c.json({ error: 'Category not found' }, 404);

      const parentId = row.parent_category_id || row.id;
      const result = await rebuildProductCategoryLinksForParent(parentId);

      return c.json({
        success: true,
        parentCategoryId: parentId,
        processed: result.processed,
        linked: result.linked,
        message: `Rebuilt mappings for ${result.processed} products (${result.linked} AUTO links written).`,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[admin category rules rebuild]', error);
      return c.json({ error: msg }, 500);
    }
  });
}
