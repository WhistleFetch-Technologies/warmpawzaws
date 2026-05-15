'use client';

export const dynamic = 'force-dynamic';

import React from 'react';
import { useRouter } from 'next/navigation';
import { VendorAnalytics } from '@/components/vendor/VendorAnalytics';
import { VendorHeader } from '@/components/vendor/VendorHeader';

export default function AnalyticsPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const storedVendorId = localStorage.getItem('vendorId');
    if (!storedVendorId) {
      router.push('/onboarding');
      return;
    }
    setVendorId(storedVendorId);
  }, [router]);

  if (!vendorId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="vendor-page-shell bg-gray-50">
      <div className="vendor-app-column bg-white min-h-screen">
        <VendorHeader
          title="Analytics"
          subtitle="View your business performance metrics"
          onBack={() => router.back()}
        />
        <div className="w-full px-4 py-6 sm:px-6">
          <VendorAnalytics
            vendorId={vendorId}
            onBack={() => router.back()}
            suppressChrome
          />
        </div>
      </div>
    </div>
  );
}
