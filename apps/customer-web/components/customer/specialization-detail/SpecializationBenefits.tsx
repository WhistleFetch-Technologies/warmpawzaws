'use client';

import { SpecializationDetailSection } from './SpecializationDetailSection';
import type { SpecializationBenefitItem } from '@/lib/specialization-detail';
import { specializationDetailIcon } from '@/lib/specialization-detail-icons';

type SpecializationBenefitsProps = {
  items: SpecializationBenefitItem[];
};

export function SpecializationBenefits({ items }: SpecializationBenefitsProps) {
  return (
    <SpecializationDetailSection delay={0.12} className="space-y-4">
      <h2 className="text-lg font-bold text-slate-900">Benefits for Your Pet</h2>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => {
          const Icon = specializationDetailIcon(item.icon);
          return (
            <div
              key={item.title}
              className="rounded-[20px] border border-slate-100 bg-white p-4 shadow-[0_6px_24px_rgba(15,23,42,0.05)]"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 text-[#FF8C42]">
                <Icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <h3 className="mb-1 text-sm font-bold text-slate-900">{item.title}</h3>
              <p className="text-xs leading-relaxed text-slate-500">{item.description}</p>
            </div>
          );
        })}
      </div>
    </SpecializationDetailSection>
  );
}
