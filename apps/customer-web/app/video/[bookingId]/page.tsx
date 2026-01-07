import { VideoPageClient } from './VideoPageClient';

// Required for static export with dynamic routes
export async function generateStaticParams() {
  return [{ bookingId: 'placeholder' }];
}

// Allow dynamic params at runtime (client-side navigation)
export const dynamicParams = true;

export default function VideoPage({ params }: { params: { bookingId: string } }) {
  return <VideoPageClient bookingId={params.bookingId} />;
}
