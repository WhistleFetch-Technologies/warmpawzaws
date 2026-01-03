import { BookingPageClient } from './BookingPageClient';

// Required for static export with dynamic routes
// Return placeholder - actual navigation happens client-side
export async function generateStaticParams() {
  return [{ serviceId: 'placeholder' }];
}

// Allow dynamic params at runtime (client-side navigation)
export const dynamicParams = true;

export default function BookingPage({ params }: { params: { serviceId: string } }) {
  return <BookingPageClient serviceId={params.serviceId} />;
}

