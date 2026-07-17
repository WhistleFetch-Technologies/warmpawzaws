import type { Context } from 'hono';
import { executecustomerContentPagesSlugGet } from './customer_content_pages_slug_get.service';

/**
 * GET /customer/articles/:slug — remaps content page payload to article shape
 * (same slug param as /customer/content/pages/:slug).
 */
export async function executecustomerArticlesSlugGet(c: Context) {
  try {
    let slug = c.req.param('slug') || '';
    try {
      slug = slug ? decodeURIComponent(slug) : '';
    } catch {
      // keep raw slug if decode fails
    }
    if (!slug) {
      return c.json({ success: false, error: 'Slug is required' }, 400);
    }

    const pageResponse = await executecustomerContentPagesSlugGet(c);
    const data: { success?: boolean; page?: Record<string, unknown>; error?: string } =
      await pageResponse.json().catch(() => ({}));

    if (!pageResponse.ok || !data?.success || !data?.page) {
      const status =
        pageResponse.status === 404 ? 404 : pageResponse.status >= 400 ? pageResponse.status : 404;
      return c.json(
        { success: false, error: data?.error || 'Article not found' },
        status as 400 | 404 | 500
      );
    }

    const p = data.page;
    return c.json({
      success: true,
      article: {
        id: p.id,
        title: p.title,
        slug: p.slug,
        content: p.content,
        category: p.category,
        readTime: p.readTime,
        featured: p.featured,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch article';
    console.error('[customer/articles/:slug]', message);
    return c.json({ success: false, error: message }, 500);
  }
}
