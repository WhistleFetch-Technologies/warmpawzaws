import VideoPageClientWrapper from './VideoPageClientWrapper';

// Required for static export - must be in server component (no 'use client')
// Uses 'placeholder' to match CloudFront rewrite rule: /video/[uuid] → /video/placeholder.html
export async function generateStaticParams() {
  return [{ bookingId: ['placeholder'] }];
}

export const dynamicParams = true;

export default function VideoPage({ params }: { params: { bookingId?: string[] | string } }) {
  const bookingIdArray = params?.bookingId;
  const bookingId = Array.isArray(bookingIdArray) ? bookingIdArray[0] : (bookingIdArray || '');
  return <VideoPageClientWrapper bookingId={bookingId} />;
}
