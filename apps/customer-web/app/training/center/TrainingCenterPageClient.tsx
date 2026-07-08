'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { UniversalServicesByStyle } from '@/components/customer/shared/UniversalServicesByStyle';
import {
  SEARCH_TRAINING_BOOKING_INTENT_KEY,
  SEARCH_TRAINING_CENTER_RETURN_KEY,
  type SearchTrainingBookingIntent,
} from '@/lib/search-booking-launch';

function readReturnSearchUrl(): string {
  if (typeof window === 'undefined') return '/search?category=training';
  try {
    const raw = sessionStorage.getItem(SEARCH_TRAINING_CENTER_RETURN_KEY);
    if (!raw) return '/search?category=training';
    const parsed = JSON.parse(raw) as { returnSearchUrl?: string };
    return parsed.returnSearchUrl || '/search?category=training';
  } catch {
    return '/search?category=training';
  }
}

function TrainingCenterContent() {
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
        screen === 'training-booking' ||
        screen === 'booking' ||
        screen === 'create-booking'
      ) {
        const intent: SearchTrainingBookingIntent = {
          vendorId: String(data?.vendorId || vendorId),
          vendorName: data?.vendorName ? String(data.vendorName) : undefined,
          serviceId: data?.serviceId ? String(data.serviceId) : undefined,
          serviceName: data?.serviceName ? String(data.serviceName) : undefined,
          price: typeof data?.price === 'number' ? data.price : undefined,
          duration: typeof data?.duration === 'number' ? data.duration : undefined,
          serviceStyle: data?.serviceStyle ? String(data.serviceStyle) : 'at_center',
          serviceType: 'training',
          returnSearchUrl,
          trainer: data?.vendor || data?.trainer,
        };
        try {
          sessionStorage.setItem(SEARCH_TRAINING_BOOKING_INTENT_KEY, JSON.stringify(intent));
        } catch {
          /* ignore */
        }
        router.push('/booking/training');
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
          <p className="text-gray-600">Please login to view training centers</p>
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
        <p className="text-lg font-semibold text-gray-900">No trainer selected</p>
        <Link
          href="/search?category=training"
          className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#FF8C42] px-8 py-3 font-medium text-white"
        >
          Search trainers
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-gray-50">
      <UniversalServicesByStyle
        phone={phone}
        roleId="trainer"
        serviceStyle="at_center"
        serviceTypeName="Training Center"
        category="training"
        bookingScreen="training-booking"
        vendorId={vendorId}
        onBack={handleBack}
        onNavigate={handleNavigate}
      />
    </div>
  );
}

export function TrainingCenterPageClient() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[100dvh] max-w-md items-center justify-center text-sm text-gray-600">
          Loading training center…
        </div>
      }
    >
      <TrainingCenterContent />
    </Suspense>
  );
}
