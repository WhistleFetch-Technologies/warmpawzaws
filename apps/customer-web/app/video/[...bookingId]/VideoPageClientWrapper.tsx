'use client';

import { VideoPageClient } from '../[bookingId]/VideoPageClient';

/** Client wrapper: reads bookingId from URL if needed and renders VideoPageClient */
export default function VideoPageClientWrapper({ bookingId: bookingIdProp }: { bookingId: string }) {
  const bookingIdFromPath =
    typeof window !== 'undefined'
      ? window.location.pathname.match(/\/video\/([^/?]+)/)?.[1]
      : null;
  const finalBookingId = bookingIdProp || bookingIdFromPath || '';
  return <VideoPageClient bookingId={finalBookingId} />;
}
