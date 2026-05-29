'use client';

import { toast } from 'sonner';
import { Gift } from 'lucide-react';

export function ShopSubscribeBanner() {
  return (
    <div className="mx-4 mt-4 rounded-2xl bg-gradient-to-r from-orange-50 via-amber-50 to-orange-100 border border-orange-100 p-4 flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl bg-white/80 flex items-center justify-center shrink-0 shadow-sm">
        <Gift className="w-5 h-5 text-[#FF8C42]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900">Subscribe &amp; Save</p>
        <p className="text-[11px] text-slate-600 mt-0.5">20% off + Free Delivery on repeat orders</p>
      </div>
      <button
        type="button"
        onClick={() => toast.info('Subscriptions coming soon')}
        className="shrink-0 px-3 py-2 rounded-xl text-xs font-semibold text-[#FF8C42] border-2 border-[#FF8C42] bg-white active:bg-orange-50"
      >
        Subscribe Now
      </button>
    </div>
  );
}
