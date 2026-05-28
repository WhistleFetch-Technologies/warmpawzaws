import BannerVendorDeepLinkClient from '@/components/customer/BannerVendorDeepLinkClient';
import { BANNER_DEEP_LINK_PERSONAS } from '@/lib/banner-cta-parse';

type PageProps = {
  params: { persona: string; vendorSlug?: string[] };
};

/** Static export: placeholder slug; real vendor names resolve client-side (same as pet-boarding vendor URLs). */
export async function generateStaticParams() {
  return BANNER_DEEP_LINK_PERSONAS.flatMap((persona) => [
    { persona, vendorSlug: ['placeholder'] },
  ]);
}

export default function BannerVendorDeepLinkPage({ params }: PageProps) {
  return (
    <BannerVendorDeepLinkClient
      persona={params.persona}
      vendorSlug={params.vendorSlug}
    />
  );
}
