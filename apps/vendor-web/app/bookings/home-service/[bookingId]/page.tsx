/**
 * Dynamic segment kept for dev / bookmarks; production navigation uses
 * /bookings/home-service?bookingId=… (see ../page.tsx).
 */
import { Suspense } from 'react';
import HomeServiceTrackingPageClient from './HomeServiceTrackingPageClient';
import { HomeServiceTrackingLoadingFallback } from '../HomeServiceTrackingLoadingFallback';

export async function generateStaticParams() {
  return [{ bookingId: 'placeholder' }];
}

export const dynamicParams = true;

export default function HomeServiceTrackingPage() {
  return (
    <Suspense fallback={<HomeServiceTrackingLoadingFallback />}>
      <HomeServiceTrackingPageClient />
    </Suspense>
  );
}
