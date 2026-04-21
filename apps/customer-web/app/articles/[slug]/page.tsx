import LegacySlugRedirectClient from './LegacySlugRedirectClient';

function decodeSlug(raw: string | undefined): string {
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Pre-render one HTML per article slug so deep links like `/articles/pu_tra` exist on S3.
 * Each page immediately redirects to `/articles?slug=…` (single-shell detail view).
 */
export async function generateStaticParams() {
  const base =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
  const url = `${String(base).replace(/\/+$/, '')}/customer/articles?limit=500`;
  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return [{ slug: 'placeholder' }];
    const j = (await res.json()) as { articles?: { slug?: string; id?: string }[] };
    const rows = Array.isArray(j.articles) ? j.articles : [];
    const slugs = new Set<string>();
    for (const a of rows) {
      const s = (a?.slug || a?.id || '').toString().trim();
      if (s) slugs.add(s);
    }
    const out = [...slugs].map((slug) => ({ slug }));
    return out.length ? out : [{ slug: 'placeholder' }];
  } catch {
    return [{ slug: 'placeholder' }];
  }
}

export const dynamicParams = true;

export default function CustomerArticleLegacySlugPage({
  params,
}: {
  params: { slug?: string };
}) {
  const slug = decodeSlug(typeof params?.slug === 'string' ? params.slug : '');
  return <LegacySlugRedirectClient slug={slug} />;
}
