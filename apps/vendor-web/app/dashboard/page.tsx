'use client';

import { useRouter } from 'next/navigation';
import { VendorDashboardScreen } from '@/components/vendor/dashboard/VendorDashboardScreen';

export default function DashboardPage() {
  const router = useRouter();

  const handleNavigate = (screen: string, data?: any) => {
    console.log(`[DashboardPage] Navigating to: ${screen}`, data);

    // Map screen names to Next.js routes
    const routeMap: Record<string, string> = {
      'bookings': '/bookings',
      'services': '/services',
      'staff': '/staff',
      'schedule': '/schedule',
      'analytics': '/analytics',
      'settings': '/settings',
      'booking-detail': '/bookings/[id]',
    };

    const route = routeMap[screen];
    if (route) {
      if (screen === 'booking-detail' && data?.bookingId) {
        router.push(`/bookings/${data.bookingId}`);
      } else {
        router.push(route);
      }
    } else {
      console.warn(`[DashboardPage] No route mapping found for screen: ${screen}`);
    }
  };

  // Get vendor data from localStorage (set by session management)
  const vendorData = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('vendorData') || '{}') : {};
  const vendorId = typeof window !== 'undefined' ? localStorage.getItem('vendorId') || '' : '';

  return (
    <VendorDashboardScreen
      vendorId={vendorId}
      vendorData={vendorData}
      onNavigate={handleNavigate}
    />
  );
}