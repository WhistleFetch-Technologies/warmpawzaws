import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerContentPagesSlugGet0(title, slug, content, category, is_published, metadata, created_at, queryParams) {
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
      )
}

export async function dbCustomerContentPagesSlugGet1(title, slug, content, category, is_published, metadata, created_at) {
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

export async function dbCustomerContentPagesSlugGet2(title, is_published) {
  return await query(
          `SELECT slug, title, is_published, category FROM content_pages ORDER BY updated_at DESC LIMIT 20`
        )
}

