'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { WpayHistoryList } from '@/components/warmpawz-pay/WpayHistoryList';
import { handleWpayHistoryPageBack } from '@/lib/go-back-or-replace';

export default function WarmpawzPayHistoryPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="mx-auto w-full max-w-customer">
      <header className="sticky top-0 z-20 flex shrink-0 items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 cw-header-safe-top cw-header-safe-x">
        <button
          type="button"
          onClick={() => handleWpayHistoryPageBack(router)}
          aria-label="Back"
          className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl touch-manipulation active:opacity-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">Warmpawz Pay History</h1>
      </header>

      <div className="p-4">
        {mounted ? <WpayHistoryList limit={5} showLoadMore /> : null}
      </div>
    </div>
  );
}
