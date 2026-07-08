'use client';

import { BadgeCheck, Tag, Truck } from 'lucide-react';

const TRUST_ITEMS = [
  { Icon: BadgeCheck, label: '100% Authentic', sub: 'Genuine Products' },
  { Icon: Truck, label: 'Fast Delivery', sub: 'Quick Shipping' },
  { Icon: Tag, label: 'Best Prices', sub: 'Great Deals' },
] as const;

export function ShopTrustRow() {
  return (
    <div className="mx-4 mt-4 grid grid-cols-3 gap-1 rounded-2xl border border-slate-100 bg-white px-2 py-3 shadow-[0_1px_4px_rgba(15,23,42,0.10),0_4px_14px_rgba(15,23,42,0.07)]">
      {TRUST_ITEMS.map(({ Icon, label, sub }) => (
        <div key={label} className="flex flex-col items-center text-center gap-1 px-0.5">
          <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center">
            <Icon className="w-4 h-4 text-[#FF8C42]" />
          </div>
          <span className="text-[9px] font-bold text-slate-800 leading-tight">{label}</span>
          <span className="text-[8px] text-slate-400 leading-tight">{sub}</span>
        </div>
      ))}
    </div>
  );
}
