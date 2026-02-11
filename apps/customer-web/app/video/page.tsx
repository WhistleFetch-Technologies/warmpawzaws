/**
 * Customer Video Call Page (Query Param Fallback)
 * Route: /video?bookingId=...
 *
 * Static export friendly: use query params instead of dynamic path.
 */

import { VideoPageClient } from './[bookingId]/VideoPageClient';

export default function VideoPage() {
  return <VideoPageClient />;
}
