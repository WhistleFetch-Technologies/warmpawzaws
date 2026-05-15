import ContentPageClient from './ContentPageClient';

// Enable static export with a placeholder slug
export async function generateStaticParams() {
  return [{ slug: 'placeholder' }];
}

export const dynamicParams = true;

export default function ContentPage({ params }: { params: { slug?: string } }) {
  const rawSlug = params?.slug as string | undefined;
  const slug = rawSlug ? decodeURIComponent(rawSlug) : '';
  return <ContentPageClient slug={slug} />;
}
