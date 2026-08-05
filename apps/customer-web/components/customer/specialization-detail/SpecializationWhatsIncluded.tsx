'use client';

import { SpecializationDetailSection } from './SpecializationDetailSection';
import type { SpecializationFeatureItem } from '@/lib/specialization-detail';
import { specializationDetailIcon } from '@/lib/specialization-detail-icons';

type SpecializationWhatsIncludedProps = {
  items: SpecializationFeatureItem[];
};

export function SpecializationWhatsIncluded({ items }: SpecializationWhatsIncludedProps) {
  return (
    <SpecializationDetailSection
      delay={0.08}
      className="rounded-[24px] border border-slate-100 bg-gradient-to-br from-orange-50/40 to-white p-5 shadow-sm"
    >
      <h2 className="mb-4 text-lg font-bold text-slate-900">What&apos;s Included</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item) => {
          const Icon = specializationDetailIcon(item.icon);
          return (
            <div
              key={item.label}
              className="flex flex-col gap-2 rounded-[20px] border border-white/80 bg-white p-3.5 shadow-[0_4px_16px_rgba(15,23,42,0.04)]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-[#FF8C42]">
                <Icon className="h-4 w-4" strokeWidth={2} />
              </div>
              <p className="text-sm font-medium leading-snug text-slate-700">{item.label}</p>
            </div>
          );
        })}
      </div>
    </SpecializationDetailSection>
  );
}
