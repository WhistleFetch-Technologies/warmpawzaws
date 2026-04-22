'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { VendorBookingManagement } from '@/components/vendor/VendorBookingManagement';
import { VendorRouteShell } from '@/components/vendor/layout/VendorRouteShell';
import { isTokenExpired, clearVendorSession } from '@/lib/session-utils';

function BookingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const walkSessionsFocus = searchParams.get('walkSessions') === '1';
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [vendorData, setVendorData] = useState<any>(null);

  // Auth protection
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken') || localStorage.getItem('vendorSessionToken');
    const storedPhone = localStorage.getItem('vendorPhone');
    
    if (!storedToken || !storedPhone || isTokenExpired(storedToken)) {
      clearVendorSession();
      window.location.replace('/auth');
      return;
    }
    
    // Get vendor data from localStorage
    const storedVendorData = localStorage.getItem('vendorData');
    if (storedVendorData) {
      try {
        setVendorData(JSON.parse(storedVendorData));
      } catch (e) {
        console.error('Error parsing vendor data:', e);
      }
    }
    
    setIsAuthenticated(true);
    setIsChecking(false);
  }, []);

  const handleBack = () => {
    if (walkSessionsFocus) {
      router.push('/');
      return;
    }
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
  const vendorId = typeof window !== 'undefined' ? localStorage.getItem('vendorId') || '' : '';
  const effectiveVendorData = vendorData || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('vendorData') || '{}') : {});

  const headerTitle =
    effectiveVendorData?.businessName ||
    effectiveVendorData?.fullName ||
    'Bookings';
  const headerSubtitle = effectiveVendorData?.address || 'India';

  return (
    <VendorRouteShell title={headerTitle} subtitle={headerSubtitle} onBack={handleBack}>
      <VendorBookingManagement
        embedded
        walkSessionsFocus={walkSessionsFocus}
        vendorId={vendorId}
        vendorData={effectiveVendorData}
        onBack={handleBack}
        chatEnabled={true}
        vendorPhone={effectiveVendorData?.phone || effectiveVendorData?.mobile}
        vendorName={
          effectiveVendorData?.fullName ||
          effectiveVendorData?.businessName ||
          effectiveVendorData?.business_name
        }
      />
    </VendorRouteShell>
  );
}

export default function BookingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <BookingsPageContent />
    </Suspense>
  );
}