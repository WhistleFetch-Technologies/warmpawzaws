/**
 * Shared content_pages article eligibility — customer list + admin banner picker.
 */

import { query } from '../database/rds-connection';

/** Categories shown in customer pet-care / articles experiences and admin banner article picker. */
export const CUSTOMER_VISIBLE_ARTICLE_CATEGORIES = [
  'marketing',
  'tips',
  'article',
  'nutrition',
  'health',
  'grooming',
  'insurance',
  'behavior',
  'legal',
  'help',
  'other',
  'general',
] as const;

export type CustomerVisibleArticleCategory = (typeof CUSTOMER_VISIBLE_ARTICLE_CATEGORIES)[number];

/** Matches customer `WHERE is_published = true` and admin row mapping. */
export function rowIsPublished(raw: unknown): boolean {
  if (raw === true) return true;
  if (raw === 1) return true;
  if (typeof raw === 'string') {
    const t = raw.trim().toLowerCase();
    return t === 'true' || t === '1';
  }
  return false;
}

export function isCustomerVisibleArticleCategory(category: unknown): boolean {
  const cat = String(category ?? '').trim().toLowerCase();
  if (!cat) return false;
  return (CUSTOMER_VISIBLE_ARTICLE_CATEGORIES as readonly string[]).includes(cat);
}

export type PublishedCustomerArticlePicker = {
  pageId: string;
  title: string;
  slug: string;
  category: string;
  isPublished: boolean;
};

export type CustomerArticleListItem = {
  id: string;
  title: string;
  slug: string;
  category: string;
  readTime: string;
  featured: boolean;
  excerpt: string;
  createdAt: string;
  updatedAt: string;
};

export type ListPublishedCustomerArticlesOptions = {
  limit?: number;
  category?: string;
  featured?: boolean;
};

const FEATURED_SQL = `(metadata->>'featured') IN ('true', 't', '1', 'yes')`;

type ContentPageArticleRow = {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  is_published: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function mapRowToPicker(row: ContentPageArticleRow): PublishedCustomerArticlePicker | null {
  const slug = String(row.slug ?? '').trim();
  if (!slug) return null;
  if (!isCustomerVisibleArticleCategory(row.category)) return null;
  if (!rowIsPublished(row.is_published)) return null;
  return {
    pageId: String(row.id ?? ''),
    title: String(row.title ?? '').trim() || 'Untitled article',
    slug,
    category: String(row.category ?? '').trim(),
    isPublished: true,
  };
}

function mapRowToCustomerListItem(row: ContentPageArticleRow): CustomerArticleListItem | null {
  const slug = String(row.slug ?? '').trim();
  if (!slug) return null;
  const text = row.content != null ? String(row.content) : '';
  const excerpt = text.length > 150 ? `${text.slice(0, 150)}...` : text;
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? ''),
    slug,
    category: String(row.category ?? ''),
    readTime: String((metadata as Record<string, unknown>).read_time ?? '5 min'),
    featured: Boolean((metadata as Record<string, unknown>).featured),
    excerpt,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

/**
 * Published customer-visible articles for admin banner picker (no limit by default).
 */
export async function listPublishedCustomerArticles(
  options: ListPublishedCustomerArticlesOptions = {}
): Promise<PublishedCustomerArticlePicker[]> {
  const rows = await queryPublishedContentPageArticleRows(options);
  return rows
    .map(mapRowToPicker)
    .filter((row): row is PublishedCustomerArticlePicker => row != null);
}

/**
 * Published customer-visible articles for GET /customer/articles (with excerpt, featured ordering).
 */
export async function listPublishedCustomerArticlesForCustomer(
  options: ListPublishedCustomerArticlesOptions = {}
): Promise<CustomerArticleListItem[]> {
  const rows = await queryPublishedContentPageArticleRows(options);
  return rows
    .map(mapRowToCustomerListItem)
    .filter((row): row is CustomerArticleListItem => row != null);
}

async function queryPublishedContentPageArticleRows(
  options: ListPublishedCustomerArticlesOptions
): Promise<ContentPageArticleRow[]> {
  const limit = Math.min(Math.max(Number(options.limit ?? 500) || 500, 1), 1000);
  const category = String(options.category ?? '').trim();
  const featured = options.featured === true;

  let articlesQuery = `
    SELECT
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
    WHERE is_published = true
      AND TRIM(COALESCE(slug, '')) <> ''
      AND LOWER(TRIM(COALESCE(category, ''))) = ANY($1::text[])
  `;

  const params: unknown[] = [
    CUSTOMER_VISIBLE_ARTICLE_CATEGORIES.map((c) => c.toLowerCase()),
  ];
  let paramIndex = 2;

  if (category) {
    articlesQuery += ` AND LOWER(TRIM(category)) = LOWER($${paramIndex})`;
    params.push(category);
    paramIndex++;
  }

  if (featured) {
    articlesQuery += ` AND ${FEATURED_SQL}`;
  }

  articlesQuery += ` ORDER BY
    CASE WHEN ${FEATURED_SQL} THEN 0 ELSE 1 END,
    updated_at DESC
    LIMIT $${paramIndex}`;
  params.push(limit);

  const result = await query(articlesQuery, params).catch(() => ({ rows: [] }));
  return (result.rows || []) as ContentPageArticleRow[];
}
