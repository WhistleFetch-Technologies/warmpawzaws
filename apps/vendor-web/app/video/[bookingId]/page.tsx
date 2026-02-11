/**
 * Vendor Video Call Page
 * Route: /video/[bookingId]
 *
 * When vendor accepts an incoming call from TeleCallNotification, they are
 * navigated here (same window) so the video call opens in-app with session intact.
 */

import { VideoPageClient } from './VideoPageClient';

// Server component wrapper - generateStaticParams must be in server component
export async function generateStaticParams() {
  // Return empty array - this allows any booking ID to work
  // The page will be generated as a fallback and handle routing client-side
  return [];
}

// Allow dynamic params at runtime (client-side navigation)
export const dynamicParams = true;

// Server component that renders client component
// VideoPageClient will extract bookingId from URL path directly
export default function VideoPage({ params }: { params: { bookingId?: string } }) {
  // Pass params to client component, but VideoPageClient will also read from URL
  return <VideoPageClient bookingId={params?.bookingId} />;
}
