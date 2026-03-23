import ArticleDetailClient from './ArticleDetailClient';

// Enable static export for this dynamic route by providing at least one param
export async function generateStaticParams() {
  return [{ slug: 'placeholder' }];
}

export const dynamicParams = true;

export default function CustomerArticleDetailPage({
  params,
}: {
  params: { slug?: string };
}) {
  const rawSlug = typeof params?.slug === 'string' ? params.slug : '';
  const slug = decodeURIComponent(rawSlug);
  return <ArticleDetailClient slug={slug} />;
}
