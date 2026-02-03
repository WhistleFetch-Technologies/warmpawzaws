'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { VendorDashboardScreen } from '@/components/vendor/dashboard/BussinesProvider/VendorDashboardScreen';
import { isTokenExpired, clearVendorSession } from '@/lib/session-utils';

export default function DashboardPage() {
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
      'specialized': '/specialized',
      'adoption': '/specialized',
      'relocation': '/specialized',
      'holidays': '/specialized',
      'breeder': '/specialized',
      'diagnostics': '/medical/diagnostics',
      'lab-orders': '/medical/diagnostics',
      'lab-tests': '/medical/diagnostics',
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