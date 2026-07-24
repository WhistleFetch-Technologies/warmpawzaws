'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { WpayHistoryList } from '@/components/warmpawz-pay/WpayHistoryList';

export default function WarmpawzPayHistoryPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="mx-auto w-full max-w-customer">
      <header className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3">
        <button type="button" onClick={() => router.push('/warmpawz-pay')} aria-label="Back">
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
