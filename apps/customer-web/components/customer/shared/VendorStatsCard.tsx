'use client';

import { Award, Briefcase, MessageSquare } from 'lucide-react';

export type VendorStatsCardProps = {
  servicesCount: number;
  /** Backend years of experience; null/undefined → N/A */
  experienceYears?: number | null;
  /** Backend review count; null/undefined → N/A */
  reviewCount?: number | null;
};

function formatExperienceYears(years: number | null | undefined): string {
  if (years == null || !Number.isFinite(Number(years))) return 'N/A';
  const n = Number(years);
  return n === 1 ? '1 Year' : `${n} Years`;
}

function formatReviewCount(count: number | null | undefined): string {
  if (count == null || !Number.isFinite(Number(count))) return 'N/A';
  return String(Number(count));
}

/** Generic 3-column stats card for any vendor profile Overview. */
export function VendorStatsCard({
  servicesCount,
  experienceYears,
  reviewCount,
}: VendorStatsCardProps) {
  const items = [
    {
      key: 'services',
      value: String(Math.max(0, Number(servicesCount) || 0)),
      label: 'Services',
      Icon: Briefcase,
      iconWrap: 'bg-orange-50',
      iconColor: 'text-[#FF8C42]',
      valueColor: 'text-[#FF8C42]',
    },
    {
      key: 'experience',
      value: formatExperienceYears(experienceYears),
      label: 'Years Experience',
      Icon: Award,
      iconWrap: 'bg-violet-50',
      iconColor: 'text-violet-600',
      valueColor: 'text-violet-600',
    },
    {
      key: 'reviews',
      value: formatReviewCount(reviewCount),
      label: 'Reviews',
      Icon: MessageSquare,
      iconWrap: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      valueColor: 'text-emerald-600',
    },
  ] as const;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {items.map((item, idx) => (
          <div
            key={item.key}
            className={`flex flex-col items-center px-1 text-center ${
              idx === 1 ? 'border-x border-gray-100' : ''
            }`}
          >
            <div
              className={`mb-2 flex h-10 w-10 items-center justify-center rounded-full ${item.iconWrap}`}
            >
              <item.Icon className={`h-5 w-5 ${item.iconColor}`} aria-hidden />
            </div>
            <div className={`text-xl font-bold tabular-nums sm:text-2xl ${item.valueColor}`}>
              {item.value}
            </div>
            <div className="mt-1 text-[11px] font-medium leading-tight text-gray-500 sm:text-xs">
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
