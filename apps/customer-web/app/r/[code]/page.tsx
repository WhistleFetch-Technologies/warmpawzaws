import { ReferralRedirectClient } from './ReferralRedirectClient';

/** Static export shell — real referral codes hydrate client-side from the URL path. */
export async function generateStaticParams() {
  return [{ code: 'placeholder' }];
}

export const dynamicParams = true;

export default function ReferralRedirectPage({ params }: { params: { code?: string } }) {
  return <ReferralRedirectClient code={params?.code} />;
}
