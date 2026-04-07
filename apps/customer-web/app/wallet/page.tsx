'use client';

import { CustomerWallet } from '@/components/customer/CustomerWallet';
import { Button } from '@/components/ui/button';
import {
  goBackOrHome,
  rememberHelpBackFromCurrentUrl,
  rememberPromotionsBackFromCurrentUrl,
} from '@/lib/go-back-or-replace';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function WalletPage() {
  const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    const storedPhone = localStorage.getItem('customerPhone');
    setPhone(storedPhone);
  }, []);

  const shellClass =
    'w-full max-w-customer min-h-[100dvh] mx-auto flex flex-col bg-[#FAF6F0] rounded-t-3xl overflow-hidden shadow-[0_0_0_1px_rgba(0,0,0,0.04)]';

  if (!phone) {
    return (
      <div className="min-h-[100dvh] flex justify-center bg-[#FAF6F0]">
        <div className={shellClass}>
          <header className="shrink-0 rounded-b-[1.75rem] bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] text-white shadow-md cw-header-safe-top cw-header-safe-x pb-4 md:pb-5">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => goBackOrHome(router)}
                className="rounded-full text-white hover:bg-white/20"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-xl font-bold">Wallet</h1>
            </div>
          </header>
          <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8 text-center">
            <p className="text-gray-600">Please login to view your wallet</p>
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

  const handleInAppNavigate = (path: string) => {
    if (path === 'rewards-loyalty') {
      router.push('/rewards');
      return;
    }
    if (path === 'referral-system') {
      router.push('/referrals');
      return;
    }
    if (path === 'support_help' || path === 'help') {
      rememberHelpBackFromCurrentUrl();
      router.push('/help');
      return;
    }
    if (path === 'promotions' || path === 'offers') {
      rememberPromotionsBackFromCurrentUrl();
      router.push('/promotions');
      return;
    }
    router.push(`/${path.replace(/^\//, '')}`);
  };

  return (
    <div className="min-h-[100dvh] flex justify-center bg-[#FAF6F0]">
      <div className={shellClass}>
        <header className="shrink-0 rounded-b-[1.75rem] bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] text-white shadow-md cw-header-safe-top cw-header-safe-x pb-4 md:pb-5">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => goBackOrHome(router)}
              className="rounded-full text-white hover:bg-white/20"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">My Wallet</h1>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-y-contain px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <CustomerWallet customerPhone={phone} onNavigate={handleInAppNavigate} />
        </div>
      </div>
    </div>
  );
}

