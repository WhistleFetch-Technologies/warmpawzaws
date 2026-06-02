'use client';

import { Heart, PawPrint, ShoppingBag } from 'lucide-react';

export type ProfileStatCounts = {
  orders: number | null;
  pets: number | null;
  saved: number | null;
};

interface ProfileStatCardsProps {
  counts: ProfileStatCounts;
  onViewOrders: () => void;
  onViewPets: () => void;
  onViewSaved: () => void;
}

function formatCount(n: number | null): string {
  if (n === null) return '…';
  return String(n);
}

const cards = [
  {
    key: 'orders' as const,
    label: 'Orders',
    icon: ShoppingBag,
    iconBg: 'bg-orange-50',
    iconColor: 'text-[#FF8C42]',
    linkColor: 'text-[#FF8C42]',
  },
  {
    key: 'pets' as const,
    label: 'My Pets',
    icon: PawPrint,
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    linkColor: 'text-violet-600',
  },
  {
    key: 'saved' as const,
    label: 'Saved',
    icon: Heart,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    linkColor: 'text-emerald-600',
  },
];

export function ProfileStatCards({
  counts,
  onViewOrders,
  onViewPets,
  onViewSaved,
}: ProfileStatCardsProps) {
  const handlers = { orders: onViewOrders, pets: onViewPets, saved: onViewSaved };

  return (
    <div className="relative z-[22] -mt-7 flex w-full gap-1.5 px-4 sm:-mt-8 sm:gap-2 sm:px-5">
      {cards.map(({ key, label, icon: Icon, iconBg, iconColor, linkColor }) => (
        <button
          key={key}
          type="button"
          onClick={handlers[key]}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-stone-200/80 bg-white p-2 shadow-[0_4px_14px_rgba(0,0,0,0.08)] active:scale-[0.98] sm:gap-2.5 sm:p-2.5"
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${iconBg}`}
            aria-hidden
          >
            <Icon className={`h-[18px] w-[18px] sm:h-5 sm:w-5 ${iconColor}`} strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1 text-left leading-tight">
            <span className="block truncate text-[10px] font-medium text-gray-500 sm:text-[11px]">
              {label}
            </span>
            <span className="mt-0.5 block text-base font-bold tabular-nums text-gray-900 sm:text-lg">
              {formatCount(counts[key])}
            </span>
            <span className={`mt-0.5 block text-[10px] font-semibold ${linkColor}`}>View all</span>
          </span>
        </button>
      ))}
    </div>
  );
}
