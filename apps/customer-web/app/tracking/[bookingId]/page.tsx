import { TrackingPageClient } from './TrackingPageClient';

// Required for static export with dynamic routes
export async function generateStaticParams() {
  return [{ bookingId: 'placeholder' }];
}

// Allow dynamic params at runtime (client-side navigation)
export const dynamicParams = true;

export default function TrackingPage({ params }: { params: { bookingId: string } }) {
  return <TrackingPageClient bookingId={params.bookingId} />;
}
