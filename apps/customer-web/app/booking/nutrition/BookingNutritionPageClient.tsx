'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { NutritionistBookingRouter } from '@/components/customer/nutrition/NutritionistBookingRouter';
import {
  SEARCH_NUTRITION_BOOKING_INTENT_KEY,
  type SearchNutritionBookingIntent,
} from '@/lib/search-booking-launch';

function readNutritionBookingIntent(): SearchNutritionBookingIntent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SEARCH_NUTRITION_BOOKING_INTENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SearchNutritionBookingIntent;
  } catch {
    return null;
  }
}

function BookingNutritionContent() {
  const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null);
  const [intent, setIntent] = useState<SearchNutritionBookingIntent | null>(null);

  useEffect(() => {
    setPhone(localStorage.getItem('customerPhone'));
    setIntent(readNutritionBookingIntent());
  }, []);

  const returnUrl = intent?.returnSearchUrl || '/search?category=nutritionist';

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
      if (screen === 'nutrition-meal-plans' && data?.vendorId) {
        router.push(`/nutrition/meal-plans?vendorId=${encodeURIComponent(String(data.vendorId))}`);
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
        <p className="mt-2 text-sm text-gray-600">Pick a nutritionist from search to start booking.</p>
        <Link
          href="/search?category=nutritionist"
          className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#FF8C42] px-8 py-3 font-medium text-white"
        >
          Search nutritionists
        </Link>
      </div>
    );
  }

  const vendorId = intent.vendorId;
  const nutritionist =
    intent.nutritionist ||
    (intent.vendorName ? { id: vendorId, vendorId, name: intent.vendorName, businessName: intent.vendorName } : undefined);

  return (
    <NutritionistBookingRouter
      phone={phone}
      vendorId={vendorId}
      nutritionist={nutritionist}
      serviceType={intent.category || 'pet_nutritionist'}
      serviceStyle={intent.serviceStyle || 'at_center'}
      onBack={handleBack}
      onNavigate={handleNavigate}
      onViewBooking={handleViewBooking}
    />
  );
}

export function BookingNutritionPageClient() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[100dvh] max-w-md items-center justify-center text-sm text-gray-600">
          Loading booking…
        </div>
      }
    >
      <BookingNutritionContent />
    </Suspense>
  );
}
