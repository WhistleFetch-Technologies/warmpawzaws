'use client';

import dynamic from 'next/dynamic';
import { SupportHelpCenter } from '@/components/customer/SupportHelpCenter';
import { handleHelpPageBack } from '@/lib/go-back-or-replace';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const AIChatbotWidget = dynamic(
  () => import('@/components/customer/AIChatbotWidget').then((m) => ({ default: m.AIChatbotWidget })),
  { ssr: false }
);

export default function HelpPage() {
  const router = useRouter();
  const [phone, setPhone] = useState<string | undefined>(undefined);

  useEffect(() => {
    const stored = localStorage.getItem('customerPhone');
    setPhone(stored ?? undefined);
  }, []);

  const shellClass =
    'w-full max-w-customer min-h-[100dvh] mx-auto flex flex-col bg-[#FAF6F0] rounded-t-3xl overflow-hidden shadow-[0_0_0_1px_rgba(0,0,0,0.04)]';

  // Guests: AI assistant only (no login gate — tickets / CRM still need an account after sign-in)
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
        <SupportHelpCenter phone={phone} onBack={() => handleHelpPageBack(router)} />
      </div>
    </div>
  );
}
