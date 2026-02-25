import { TrackingPageClient } from './TrackingPageClient';

// Required for static export with dynamic routes
export async function generateStaticParams() {
  return [{ bookingId: 'placeholder' }];
}

// Allow dynamic params at runtime (client-side navigation)
export const dynamicParams = true;

// Server component that renders client component
// TrackingPageClient will extract bookingId from URL path directly (for static export compatibility)
export default function TrackingPage({ params }: { params: { bookingId?: string } }) {
  return <TrackingPageClient bookingId={params?.bookingId ?? ''} />;
}
