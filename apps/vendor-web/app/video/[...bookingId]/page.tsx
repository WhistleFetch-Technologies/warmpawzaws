/**
 * Vendor Video Call Page - Catch-All Route
 * Route: /video/[...bookingId]
 *
 * Catch-all route for static export compatibility.
 * This generates a single page that handles all booking IDs.
 * When vendor accepts an incoming call from TeleCallNotification, they are
 * navigated here (same window) so the video call opens in-app with session intact.
 */

import { VideoPageClient } from '../[bookingId]/VideoPageClient';

// Server component wrapper - generateStaticParams must be in server component
export async function generateStaticParams() {
  // Return empty array - catch-all route generates a single page for all paths
  return [];
}

// Allow dynamic params at runtime (client-side navigation)
export const dynamicParams = true;

// Server component that renders client component
// Catch-all route for static export compatibility
// This generates a single page that handles all booking IDs: /video/[...bookingId]
// VideoPageClient will extract bookingId from URL path directly
export default function VideoPage({ params }: { params: { bookingId?: string[] | string } }) {
  // Catch-all params come as an array, extract first element
  const bookingIdArray = params?.bookingId;
  const bookingId = Array.isArray(bookingIdArray) 
    ? bookingIdArray[0] 
    : (bookingIdArray || '');
  
  // VideoPageClient will also extract bookingId from URL path directly as fallback
  return <VideoPageClient bookingId={bookingId} />;
}
