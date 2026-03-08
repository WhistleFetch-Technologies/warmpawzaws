import { VideoPageClient } from './VideoPageClient';

// Required for output: 'export' - must return at least one param
// Uses 'placeholder' to match CloudFront rewrite rule: /video/[uuid] → /video/placeholder.html
export async function generateStaticParams() {
  return [{ bookingId: 'placeholder' }];
}

// Allow dynamic params at runtime (client-side navigation)
export const dynamicParams = true;

// Server component that renders client component
// VideoPageClient will extract bookingId from URL path directly
export default function VideoPage({ params }: { params: { bookingId?: string } }) {
  // Pass params to client component, but VideoPageClient will also read from URL
  return <VideoPageClient bookingId={params?.bookingId ?? ''} />;
}
