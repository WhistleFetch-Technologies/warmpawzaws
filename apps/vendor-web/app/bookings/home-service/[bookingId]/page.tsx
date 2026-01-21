/**
 * Home Service Tracking Page
 * Route: /bookings/home-service/[bookingId]
 * 
 * Vendor page for managing a home service visit:
 * - GPS tracking
 * - Session start/end with OTP
 * - Route recording for walkers
 */

import HomeServiceTrackingPageClient from './HomeServiceTrackingPageClient';

// Required for static export with dynamic routes
export async function generateStaticParams() {
  return [{ bookingId: 'placeholder' }];
}

// Allow dynamic params at runtime (client-side navigation)
export const dynamicParams = true;

export default function HomeServiceTrackingPage() {
  return <HomeServiceTrackingPageClient />;
}
