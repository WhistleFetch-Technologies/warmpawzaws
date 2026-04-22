'use client';

import { MyBookings } from '@/components/customer/booking/MyBookings';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function BookingsPageInner() {
  const searchParams = useSearchParams();
  const reviewBookingId = searchParams.get('reviewBookingId');
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    const storedPhone = localStorage.getItem('customerPhone');
    setPhone(storedPhone);
  }, []);

  if (!phone) {
    return <div>Loading...</div>;
  }

  return (
    <MyBookings
      phone={phone}
      onBack={() => window.history.back()}
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

