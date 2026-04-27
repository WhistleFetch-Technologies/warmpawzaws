import { BookingPageClient } from './BookingPageClient';

// `output: 'export'` requires at least one segment; build uses `placeholder` only for the HTML shell.
// BookingPageClient resolves the real id from `usePathname()` so `/booking/<uuid>` works after client nav or SPA fallback.
export async function generateStaticParams() {
  return [{ serviceId: 'placeholder' }];
}

// Allow dynamic params at runtime (client-side navigation)
export const dynamicParams = true;

export default function BookingPage({ params }: { params: { serviceId: string } }) {
  return <BookingPageClient serviceId={params.serviceId} />;
}

