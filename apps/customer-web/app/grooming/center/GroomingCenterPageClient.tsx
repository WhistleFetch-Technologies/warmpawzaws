'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { GroomingServicesByStyle } from '@/components/customer/grooming/GroomingServicesByStyle';
import {
  SEARCH_GROOMING_BOOKING_INTENT_KEY,
  SEARCH_GROOMING_CENTER_RETURN_KEY,
  type SearchGroomingBookingIntent,
} from '@/lib/search-booking-launch';

function readReturnSearchUrl(): string {
  if (typeof window === 'undefined') return '/search?category=grooming';
  try {
    const raw = sessionStorage.getItem(SEARCH_GROOMING_CENTER_RETURN_KEY);
    if (!raw) return '/search?category=grooming';
    const parsed = JSON.parse(raw) as { returnSearchUrl?: string };
    return parsed.returnSearchUrl || '/search?category=grooming';
  } catch {
    return '/search?category=grooming';
  }
}

function GroomingCenterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vendorId = (searchParams.get('vendorId') || '').trim();
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    setPhone(localStorage.getItem('customerPhone'));
  }, []);

  const returnSearchUrl = readReturnSearchUrl();

  const handleBack = useCallback(() => {
    router.push(returnSearchUrl);
  }, [router, returnSearchUrl]);

  const handleNavigate = useCallback(
    (screen: string, data?: Record<string, unknown>) => {
      if (
        screen === 'grooming-booking' ||
        screen === 'booking' ||
        screen === 'create-booking'
      ) {
        const intent: SearchGroomingBookingIntent = {
          vendorId: String(data?.vendorId || vendorId),
          vendorName: data?.vendorName ? String(data.vendorName) : undefined,
          serviceId: data?.serviceId ? String(data.serviceId) : undefined,
          serviceName: data?.serviceName ? String(data.serviceName) : undefined,
          price: typeof data?.price === 'number' ? data.price : undefined,
          duration: typeof data?.duration === 'number' ? data.duration : undefined,
          serviceStyle: data?.serviceStyle ? String(data.serviceStyle) : 'at_center',
          serviceType: 'grooming',
          returnSearchUrl,
          groomer: data?.vendor || data?.groomer,
        };
        try {
          sessionStorage.setItem(SEARCH_GROOMING_BOOKING_INTENT_KEY, JSON.stringify(intent));
        } catch {
          /* ignore */
        }
        router.push('/booking/grooming');
        return;
      }
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
    },
    [router, returnSearchUrl, vendorId]
  );

  if (phone === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please login to view grooming salons</p>
          <Link href="/auth" className="mt-4 inline-block rounded-full bg-orange-500 px-6 py-2 text-white">
            Login
          </Link>
        </div>
      </div>
    );
  }

  if (!vendorId) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center bg-stone-100 px-6 text-center">
        <p className="text-lg font-semibold text-gray-900">No groomer selected</p>
        <Link
          href="/search?category=grooming"
          className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#FF8C42] px-8 py-3 font-medium text-white"
        >
          Search groomers
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-gray-50">
      <GroomingServicesByStyle
        phone={phone}
        serviceStyle="at_center"
        serviceTypeName="Grooming Center"
        category="grooming"
        vendorId={vendorId}
        onBack={handleBack}
        onNavigate={handleNavigate}
      />
    </div>
  );
}

export function GroomingCenterPageClient() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[100dvh] max-w-md items-center justify-center text-sm text-gray-600">
          Loading grooming center…
        </div>
      }
    >
      <GroomingCenterContent />
    </Suspense>
  );
}
