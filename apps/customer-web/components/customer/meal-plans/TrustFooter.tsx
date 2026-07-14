'use client';

import { Calendar, Clock, Download, Leaf, PawPrint, Shield, ShieldCheck, Truck, UtensilsCrossed } from 'lucide-react';

const BADGES = [
  { label: 'Freshly Prepared', sub: 'Made fresh daily', icon: Leaf, iconClass: 'text-emerald-600 bg-emerald-50' },
  { label: 'Vet Approved', sub: 'Nutritionist backed', icon: ShieldCheck, iconClass: 'text-teal-600 bg-teal-50' },
  { label: 'Human Grade', sub: 'Premium ingredients', icon: Shield, iconClass: 'text-blue-600 bg-blue-50' },
  { label: 'On-time Delivery', sub: 'Reliable schedule', icon: Truck, iconClass: 'text-violet-600 bg-violet-50' },
] as const;

export function TrustFooter() {
  return (
    <footer
      className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4"
      aria-label="Meal quality highlights"
    >
      {BADGES.map(({ label, sub, icon: Icon, iconClass }) => (
        <div key={label} className="flex min-w-0 items-start gap-2 rounded-xl bg-white/80 px-2 py-2 ring-1 ring-orange-100/80">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconClass}`}
            aria-hidden
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold leading-tight text-slate-800">{label}</p>
            <p className="text-[10px] leading-tight text-slate-500">{sub}</p>
          </div>
        </div>
      ))}
    </footer>
  );
}
