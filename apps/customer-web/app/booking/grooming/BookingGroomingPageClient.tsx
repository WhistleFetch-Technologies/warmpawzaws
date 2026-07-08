'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GroomingBookingRouter } from '@/components/customer/grooming/GroomingBookingRouter';
import {
  SEARCH_GROOMING_BOOKING_INTENT_KEY,
  type SearchGroomingBookingIntent,
} from '@/lib/search-booking-launch';

function readGroomingBookingIntent(): SearchGroomingBookingIntent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SEARCH_GROOMING_BOOKING_INTENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SearchGroomingBookingIntent;
  } catch {
    return null;
  }
}

function BookingGroomingContent() {
  const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null);
  const [intent, setIntent] = useState<SearchGroomingBookingIntent | null>(null);

  useEffect(() => {
    setPhone(localStorage.getItem('customerPhone'));
    setIntent(readGroomingBookingIntent());
  }, []);

  const returnUrl = intent?.returnSearchUrl || '/search?category=grooming';

  const handleBack = useCallback(() => {
    router.push(returnUrl);
  }, [router, returnUrl]);

  const handleNavigate = useCallback(
    (screen: string, data?: Record<string, unknown>) => {
      if (screen === 'booking-details' || screen === 'booking-confirmation') {
        const bookingId = data?.bookingId;
        if (bookingId) {
          router.push(`/bookings?highlight=${encodeURIComponent(String(bookingId))}`);
        }
        return;
      }
      if (screen === 'my-bookings') {
        router.push('/bookings');
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
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600">Please login to book a service</p>
            <Link
              href="/auth"
              className="mt-4 inline-block rounded-full bg-orange-500 px-6 py-2 text-white"
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
        <p className="mt-2 text-sm text-gray-600">Pick a groomer from search to start booking.</p>
        <Link
          href="/search?category=grooming"
          className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#FF8C42] px-8 py-3 font-medium text-white"
        >
          Search groomers
        </Link>
      </div>
    );
  }

  const vendorId = intent.vendorId;
  const groomer =
    intent.groomer ||
    (intent.vendorName
      ? { id: vendorId, vendorId, name: intent.vendorName, businessName: intent.vendorName }
      : undefined);

  return (
    <GroomingBookingRouter
      phone={phone}
      vendorId={vendorId}
      groomer={groomer}
      serviceId={intent.serviceId}
      serviceName={intent.serviceName}
      serviceType={intent.serviceType || 'grooming'}
      serviceStyle={intent.serviceStyle || 'at_center'}
      vendorName={intent.vendorName}
      price={intent.price}
      duration={intent.duration}
      onBack={handleBack}
      onNavigate={handleNavigate}
      onViewBooking={handleViewBooking}
    />
  );
}

export function BookingGroomingPageClient() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[100dvh] max-w-md items-center justify-center text-sm text-gray-600">
          Loading booking…
        </div>
      }
    >
      <BookingGroomingContent />
    </Suspense>
  );
}
