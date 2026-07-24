'use client';

import { useRouter } from 'next/navigation';
import { QrCode } from 'lucide-react';
import { WPAY_HISTORY_PATH } from '@/lib/warmpawz-pay/wpay-api';

export function ProfileWpayHistorySection() {
  const router = useRouter();

  return (
    <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50">
            <QrCode className="h-[18px] w-[18px] text-[#FF8C42]" strokeWidth={2} />
          </span>
          <h3 className="truncate text-[15px] font-bold text-gray-900">Warmpawz Pay</h3>
        </div>
        <button
          type="button"
          onClick={() => router.push(WPAY_HISTORY_PATH)}
          className="shrink-0 text-xs font-medium text-[#FF6B00]"
        >
          View all
        </button>
      </div>
      <WpayHistoryList limit={3} showLoadMore={false} />
    </div>
  );
}
