'use client';

import { MyBookings } from '@/components/customer/booking/MyBookings';
import { goBackOrReplace } from '@/lib/go-back-or-replace';
import { useCustomerNavigation } from '@/lib/navigation/use-customer-navigation';
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
      nav.goToAuth();
    }
  }, [sessionChecked, phone, nav]);

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
    return null;
  }

  const backToHome = () => goBackOrReplace(router, '/');

  return (
    <MyBookings
      phone={phone}
      onBack={backToHome}
      onCloseToHome={backToHome}
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

