'use client';

export const dynamic = 'force-dynamic';

import React from 'react';
import { useRouter } from 'next/navigation';
import { VendorAnalytics } from '@/components/vendor/VendorAnalytics';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-orange-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Analytics</h1>
              <p className="text-sm text-gray-500 mt-1">View your business performance metrics</p>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Component */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <VendorAnalytics
          vendorId={vendorId}
          onBack={() => router.back()}
        />
      </div>
    </div>
  );
}
