'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect, useState } from 'react';
import { SupportHelpCenter } from '@/components/customer/SupportHelpCenter';
import { handleHelpPageBack } from '@/lib/go-back-or-replace';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  readSupportBookingContext,
  type SupportBookingContext,
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

  useEffect(() => {
    const stored = localStorage.getItem('customerPhone');
    setPhone(stored ?? undefined);
  }, []);

  useEffect(() => {
    const fromStorage = readSupportBookingContext();
    const bookingId = searchParams.get('bookingId')?.trim();
    if (fromStorage) {
      setBookingContext(fromStorage);
      return;
    }
    if (bookingId) {
      setBookingContext({ bookingId });
    }
  }, [searchParams]);

  const shellClass =
    'w-full max-w-customer min-h-[100dvh] mx-auto flex flex-col bg-[#FAF6F0] rounded-t-3xl overflow-hidden shadow-[0_0_0_1px_rgba(0,0,0,0.04)]';

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
    <div className="min-h-[100dvh] flex justify-center bg-[#FAF6F0]">
      <div className={`${shellClass} overflow-y-auto overscroll-y-contain`}>
        <SupportHelpCenter
          phone={phone}
          onBack={() => handleHelpPageBack(router)}
          initialTab={bookingContext ? 'contact' : undefined}
          bookingContext={bookingContext}
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
