'use client';

import { SupportHelpCenter } from '@/components/customer/SupportHelpCenter';
import { Button } from '@/components/ui/button';
import { handleHelpPageBack } from '@/lib/go-back-or-replace';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function HelpPage() {
  const router = useRouter();
  const [phone, setPhone] = useState<string | undefined>(undefined);

  useEffect(() => {
    const stored = localStorage.getItem('customerPhone');
    setPhone(stored ?? undefined);
  }, []);

  const shellClass =
    'w-full max-w-customer min-h-[100dvh] mx-auto flex flex-col bg-[#FAF6F0] rounded-t-3xl overflow-hidden shadow-[0_0_0_1px_rgba(0,0,0,0.04)]';

  if (!phone) {
    return (
      <div className="min-h-[100dvh] flex justify-center bg-[#FAF6F0]">
        <div className={shellClass}>
          <header className="shrink-0 bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] text-white px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-5 rounded-b-[1.75rem] shadow-md">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleHelpPageBack(router)}
                className="rounded-full text-white hover:bg-white/20"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-xl font-bold">Help & Support</h1>
            </div>
          </header>
          <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8 text-center">
            <p className="text-gray-600">Please login to use help center features like tickets.</p>
            <Link
              href="/auth"
              className="mt-4 inline-block px-6 py-3 bg-orange-500 text-white rounded-full font-medium"
            >
              Login
            </Link>
          </div>
        </div>
      </div>
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
