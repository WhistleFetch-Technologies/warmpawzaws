import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerContentPagesSlugGet0(placeholders, slug, queryParams) {
  return await query(
        `SELECT 
          id,
          title,
          slug,
          content,
          category,
          is_published,
          metadata,
          created_at,
          updated_at
        FROM content_pages
        WHERE slug IN (${placeholders}) AND is_published = true
        LIMIT 1`,
        queryParams
      );
}

export async function dbCustomerContentPagesSlugGet1(slug) {
  return await query(
          `SELECT 
            id,
            title,
            slug,
            content,
            category,
            is_published,
            metadata,
            created_at,
            updated_at
          FROM content_pages
          WHERE LOWER(TRIM(slug)) = LOWER(TRIM($1)) AND is_published = true
          LIMIT 1`,
          [slug]
        )
}

export async function dbCustomerContentPagesSlugGet2() {
  return await query(
          `SELECT slug, title, is_published, category FROM content_pages ORDER BY updated_at DESC LIMIT 20`
        )
}

