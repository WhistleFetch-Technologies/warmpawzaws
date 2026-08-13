'use client';

import { MyBookings } from '@/components/customer/booking/MyBookings';
import { goBackFromBookingsPage } from '@/lib/go-back-or-replace';
import { useCustomerNavigation } from '@/lib/navigation/use-customer-navigation';
import { AuthGateLoadingShell } from '@/components/AuthGateLoadingShell';
import { redirectWithHardFallback } from '@/lib/auth-gate-redirect';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function BookingsPageInner() {
  const router = useRouter();
  const nav = useCustomerNavigation();
  const searchParams = useSearchParams();
  const reviewBookingId = searchParams.get('reviewBookingId');
  const [phone, setPhone] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const storedPhone = localStorage.getItem('customerPhone');
    setPhone(storedPhone);
    setSessionChecked(true);
  }, []);

  useEffect(() => {
    if (sessionChecked && !phone) {
      redirectWithHardFallback(router, '/auth');
    }
  }, [sessionChecked, phone, router]);

  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50/40">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4" />
          <p className="text-gray-600">Loading…</p>
        </div>
      </div>
    );
  }

  if (!phone) {
    return <AuthGateLoadingShell />;
  }

  const backToPrevious = () => goBackFromBookingsPage(router);

  return (
    <MyBookings
      phone={phone}
      onBack={backToPrevious}
      onCloseToHome={() => nav.goToHome()}
      reviewBookingIdFromUrl={reviewBookingId}
    />
  );
}

export default function BookingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-orange-50/40 p-6 text-gray-600">
          Loading…
        </div>
      }
    >
      <BookingsPageInner />
    </Suspense>
  );
}

