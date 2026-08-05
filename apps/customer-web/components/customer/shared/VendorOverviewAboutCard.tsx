'use client';

import type { LucideIcon } from 'lucide-react';

export type VendorOverviewAboutCardProps = {
  description: string;
  icon: LucideIcon;
  title?: string;
};

/** Generic About card for any vendor profile Overview. Always rendered (caller supplies text). */
export function VendorOverviewAboutCard({
  description,
  icon: Icon,
  title = 'About',
}: VendorOverviewAboutCardProps) {
  const text = description.trim();

  return (
    <section className="rounded-2xl border border-[#FF8C42]/25 bg-[#FFF8F3] p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#FF8C42]/15">
          <Icon className="h-5 w-5 text-[#FF8C42]" aria-hidden />
        </div>
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
      </div>
      <div className="border-t border-dashed border-[#FF8C42]/25 pt-3">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
          {text || '—'}
        </p>
      </div>
    </section>
  );
}
