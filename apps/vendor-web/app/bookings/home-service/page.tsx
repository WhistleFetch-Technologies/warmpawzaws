/**
 * Static entry for home-service live tracking (S3 + CloudFront safe).
 * Real booking id is passed as ?bookingId=… so a single HTML artifact exists at export.
 */
import { Suspense } from 'react';
import HomeServiceTrackingPageClient from './[bookingId]/HomeServiceTrackingPageClient';
import { HomeServiceTrackingLoadingFallback } from './HomeServiceTrackingLoadingFallback';

export default function HomeServiceTrackingQueryPage() {
  return (
    <Suspense fallback={<HomeServiceTrackingLoadingFallback />}>
      <HomeServiceTrackingPageClient />
    </Suspense>
  );
}
