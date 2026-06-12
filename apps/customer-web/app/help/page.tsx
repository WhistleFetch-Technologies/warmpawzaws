'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect, useState } from 'react';
import { SupportHelpCenter } from '@/components/customer/SupportHelpCenter';
import { handleHelpPageBack } from '@/lib/go-back-or-replace';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  readSupportBookingContext,
  readSupportMealOrderContext,
  type SupportBookingContext,
  type SupportMealOrderContext,
} from '@/lib/support-contact';

const AIChatbotWidget = dynamic(
  () => import('@/components/customer/AIChatbotWidget').then((m) => ({ default: m.AIChatbotWidget })),
  { ssr: false }
);

function HelpPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState<string | undefined>(undefined);
  const [bookingContext, setBookingContext] = useState<SupportBookingContext | null>(null);
  const [mealOrderContext, setMealOrderContext] = useState<SupportMealOrderContext | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('customerPhone');
    setPhone(stored ?? undefined);
  }, []);

  useEffect(() => {
    const fromMealStorage = readSupportMealOrderContext();
    const fromBookingStorage = readSupportBookingContext();
    const bookingId = searchParams.get('bookingId')?.trim();
    const orderId = searchParams.get('orderId')?.trim();
    const orderType = searchParams.get('orderType')?.trim();

    if (fromMealStorage) {
      setMealOrderContext(fromMealStorage);
      setBookingContext(null);
      return;
    }
    if (fromBookingStorage) {
      setBookingContext(fromBookingStorage);
      setMealOrderContext(null);
      return;
    }
    if (orderId && orderType === 'meal') {
      setMealOrderContext({ orderId });
      setBookingContext(null);
      return;
    }
    if (bookingId) {
      setBookingContext({ bookingId });
      setMealOrderContext(null);
    }
  }, [searchParams]);

  const shellClass =
    'w-full max-w-customer h-[100dvh] mx-auto flex flex-col overflow-hidden bg-[#FAF6F0] rounded-t-3xl shadow-[0_0_0_1px_rgba(0,0,0,0.04)]';

  if (!phone) {
    return (
      <AIChatbotWidget
        presentation="modal"
        onClose={() => handleHelpPageBack(router)}
        onNavigate={(dest) => {
          if (typeof dest === 'string' && dest.startsWith('/')) {
            router.push(dest);
          }
        }}
      />
    );
  }

  return (
    <div className="h-[100dvh] flex justify-center bg-[#FAF6F0] overflow-hidden">
      <div className={shellClass}>
        <SupportHelpCenter
          phone={phone}
          onBack={() => handleHelpPageBack(router)}
          initialTab={bookingContext || mealOrderContext ? 'contact' : undefined}
          bookingContext={bookingContext}
          mealOrderContext={mealOrderContext}
        />
      </div>
    </div>
  );
}

export default function HelpPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-[#FAF6F0]" />}>
      <HelpPageContent />
    </Suspense>
  );
}
