'use client';

import { useRouter } from 'next/navigation';
import { PerformanceMetricsScreen } from '@/components/vendor/analytics/PerformanceMetricsScreen';

export default function AnalyticsPage() {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  // Get vendor data from localStorage
  const vendorId = typeof window !== 'undefined' ? localStorage.getItem('vendorId') || '' : '';

  return (
    <PerformanceMetricsScreen
      vendorId={vendorId}
      onBack={handleBack}
    />
  );
}