import { Suspense } from 'react';
import TrackingContent from './TrackingContent';

// Required for static export with dynamic routes
export function generateStaticParams() {
  return [];
}

export default function OrderTrackingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <TrackingContent />
    </Suspense>
  );
}
