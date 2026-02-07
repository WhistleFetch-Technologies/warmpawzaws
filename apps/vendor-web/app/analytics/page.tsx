'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PerformanceMetricsScreen } from '@/components/vendor/analytics/PerformanceMetricsScreen';
import { isTokenExpired, clearVendorSession } from '@/lib/session-utils';

export default function AnalyticsPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Auth protection
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken') || localStorage.getItem('vendorSessionToken');
    const storedPhone = localStorage.getItem('vendorPhone');
    
    if (!storedToken || !storedPhone || isTokenExpired(storedToken)) {
      clearVendorSession();
      window.location.replace('/auth');
      return;
    }
    
    setIsAuthenticated(true);
    setIsChecking(false);
  }, []);

  const handleBack = () => {
    router.back();
  };

  // Show loading while checking auth
  if (isChecking || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Get vendor data from localStorage
  const vendorId = localStorage.getItem('vendorId') || '';

  return (
    <PerformanceMetricsScreen
      vendorId={vendorId}
      onBack={handleBack}
    />
  );
}