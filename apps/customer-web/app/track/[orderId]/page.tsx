import { TrackingPageClient } from './TrackingPageClient';

// Required for static export with dynamic routes
export async function generateStaticParams() {
  return [{ orderId: 'placeholder' }];
}

// Allow dynamic params at runtime (client-side navigation)
export const dynamicParams = true;

export default function TrackOrderPage({ params }: { params: { orderId: string } }) {
  return <TrackingPageClient orderId={params.orderId} />;
}
