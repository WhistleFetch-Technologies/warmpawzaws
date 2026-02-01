/**
 * Vendor Video Call Page
 * Route: /video/[bookingId]
 *
 * When vendor accepts an incoming call from TeleCallNotification, they are
 * navigated here (same window) so the video call opens in-app with session intact.
 */

import { VideoPageClient } from './VideoPageClient';

export async function generateStaticParams() {
  return [{ bookingId: 'placeholder' }];
}

export const dynamicParams = true;

export default function VideoPage() {
  return <VideoPageClient />;
}
