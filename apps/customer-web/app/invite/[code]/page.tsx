import { InviteLandingClient } from './InviteLandingClient';

/** Static export shell — real referral codes hydrate client-side from the URL path. */
export async function generateStaticParams() {
  return [{ code: 'placeholder' }];
}

export const dynamicParams = true;

export default function InviteLandingPage({ params }: { params: { code?: string } }) {
  return <InviteLandingClient code={params?.code} />;
}
