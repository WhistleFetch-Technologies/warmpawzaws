'use client';

/**
 * Home Service Settings / Service Radius Page
 * Route: /schedule/radius
 * 
 * Allows vendors to configure:
 * - Service radius for home visits
 * - Current location
 * - Operating hours
 * - Availability settings
 */

import { useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { HomeServiceSettings } from '@/components/vendor/settings/HomeServiceSettings';

function ServiceRadiusContent() {
  const router = useRouter();
  
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get vendorId from localStorage (URL params removed to avoid useSearchParams issue)
    const storedVendorId = localStorage.getItem('vendorId');
    
    if (storedVendorId) {
      setVendorId(storedVendorId);
    }
    setLoading(false);
  }, []);

  const handleBack = () => {
    router.back();
  };

  const handleSave = () => {
    // Return to schedule page after save
    router.push('/schedule');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!vendorId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-500 font-medium">Vendor ID not found</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <HomeServiceSettings
      vendorId={vendorId}
      onBack={handleBack}
      onSave={handleSave}
    />
  );
}

export default function ServiceRadiusPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <ServiceRadiusContent />
    </Suspense>
  );
}
