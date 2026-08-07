'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { VetBookingRouter } from '@/components/customer/vet/VetBookingRouter';
import {
  SEARCH_BOOKING_INTENT_KEY,
  type SearchVetBookingIntent,
} from '@/lib/search-booking-launch';
import { buildVendorShareAppPath } from '@/lib/vendor-profile-share';

function readBookingIntent(): SearchVetBookingIntent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SEARCH_BOOKING_INTENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SearchVetBookingIntent;
  } catch {
    return null;
  }
}

function BookingVetContent() {
  const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null);
  const [intent, setIntent] = useState<SearchVetBookingIntent | null>(null);

  useEffect(() => {
    setPhone(localStorage.getItem('customerPhone'));
    setIntent(readBookingIntent());
  }, []);

  const returnUrl = intent?.returnSearchUrl || '/search';

  const handleBack = useCallback(() => {
    router.push(returnUrl);
  }, [router, returnUrl]);

  const handleNavigate = useCallback(
    (screen: string, data?: Record<string, unknown>) => {
      if (screen === 'purchase-package' && data?.vendorId) {
        const vendorId = String(data.vendorId);
        const path = buildVendorShareAppPath(vendorId, {
          persona: 'vet',
          serviceStyle: 'at_center',
          intent: 'book',
        });
        router.push(path.replace('/vendor/placeholder', `/vendor/${encodeURIComponent(vendorId)}`));
        return;
      }
      if (screen === 'my-bookings') {
        router.push('/bookings');
        return;
      }
      if (screen === 'home') {
        router.push('/');
        return;
      }
      if (screen === 'shop') {
        router.push('/shop');
        return;
      }
      if (screen === 'profile') {
        router.push('/profile');
        return;
      }
    },
    [router]
  );

  const handleViewBooking = useCallback(
    (bookingId: string) => {
      router.push(`/bookings?highlight=${encodeURIComponent(bookingId)}`);
    },
    [router]
  );

  if (phone === null || intent === null) {
    if (phone === null) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-gray-600">Please login to book a service</p>
            <Link
              href="/auth"
              className="mt-4 inline-block px-6 py-2 bg-orange-500 text-white rounded-full"
            >
              Login
            </Link>
          </div>
        </div>
      );
    }
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center bg-stone-100 px-6 text-center">
        <p className="text-lg font-semibold text-gray-900">No booking session</p>
        <p className="mt-2 text-sm text-gray-600">
          Pick a service from search to start clinic booking.
        </p>
        <Link
          href="/search"
          className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#FF8C42] px-8 py-3 font-medium text-white"
        >
          Search services
        </Link>
      </div>
    );
  }

  const clinic = intent.clinic;
  const vendorId = intent.vendorId || clinic?.id;

  return (
    <VetBookingRouter
      phone={phone}
      vendorId={vendorId}
      clinicId={vendorId}
      vendorName={intent.vendorName}
      selectedService={intent.service}
      serviceId={intent.serviceId}
      serviceName={intent.serviceName}
      serviceStyle={intent.serviceStyle}
      serviceType={intent.serviceType}
      price={intent.price}
      duration={intent.duration}
      appointmentsMode={intent.appointmentsMode === true}
      onBack={handleBack}
      onNavigate={handleNavigate}
      onViewBooking={handleViewBooking}
    />
  );
}

export function BookingVetPageClient() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[100dvh] max-w-md items-center justify-center text-sm text-gray-600">
          Loading booking…
        </div>
      }
    >
      <BookingVetContent />
    </Suspense>
  );
}
