import { Suspense } from 'react';
import { TrackingPageClient } from './TrackingPageClient';

// Required for static export with dynamic routes
export async function generateStaticParams() {
  return [{ orderId: 'placeholder' }];
}

// Allow dynamic params at runtime (client-side navigation)
export const dynamicParams = true;

export default function TrackOrderPage({ params }: { params: { orderId: string } }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
        </div>
      }
    >
      <TrackingPageClient orderId={params.orderId} />
    </Suspense>
  );
}
