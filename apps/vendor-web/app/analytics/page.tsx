'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PerformanceMetricsScreen } from '@/components/vendor/analytics/PerformanceMetricsScreen';
import { requireVendorSessionOrRedirect } from '@/lib/session-utils';

export default function AnalyticsPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    void (async () => {
      const ok = await requireVendorSessionOrRedirect();
      if (ok) {
        setIsAuthenticated(true);
        setIsChecking(false);
      }
    })();
  }, []);

  const handleBack = () => {
    router.back();
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <PerformanceMetricsScreen onBack={handleBack} />;
}
