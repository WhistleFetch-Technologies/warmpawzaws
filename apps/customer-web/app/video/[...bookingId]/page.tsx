'use client';

import { VideoPageClient } from '../[bookingId]/VideoPageClient';
import { useParams } from 'next/navigation';

// Required for static export - catch-all route handles any booking ID
export async function generateStaticParams() {
  // Return empty array - catch-all route generates a single page for all paths
  return [];
}

// Allow dynamic params at runtime (client-side navigation)
export const dynamicParams = true;

// Catch-all route for static export compatibility
// This generates a single page that handles all booking IDs: /video/[...bookingId]
// The bookingId is extracted from the URL path client-side
export default function VideoPage() {
  const params = useParams();
  // Catch-all params come as an array
  const bookingIdArray = params?.bookingId as string[] | string | undefined;
  const bookingId = Array.isArray(bookingIdArray) 
    ? bookingIdArray[0] 
    : (bookingIdArray || '');
  
  // Fallback: extract from URL path if params don't work
  const bookingIdFromPath = typeof window !== 'undefined' 
    ? window.location.pathname.match(/\/video\/([^/?]+)/)?.[1] 
    : null;
  
  const finalBookingId = bookingId || bookingIdFromPath || '';
  
  return <VideoPageClient bookingId={finalBookingId} />;
}
