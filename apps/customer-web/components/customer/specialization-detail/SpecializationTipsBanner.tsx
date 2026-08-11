'use client';

import { Lightbulb } from 'lucide-react';
import { SpecializationDetailSection } from './SpecializationDetailSection';

type SpecializationTipsBannerProps = {
  tips: string[];
};

export function SpecializationTipsBanner({ tips }: SpecializationTipsBannerProps) {
  if (!tips.length) return null;

  return (
    <SpecializationDetailSection
      delay={0.24}
      className="rounded-[20px] border border-amber-100 bg-gradient-to-r from-amber-50/90 to-orange-50/60 p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/80 text-amber-600 shadow-sm">
          <Lightbulb className="h-4 w-4" strokeWidth={2} />
        </div>
        <h2 className="text-base font-bold text-slate-900">Tips Before Booking</h2>
      </div>
      <ul className="space-y-2">
        {tips.map((tip) => (
          <li key={tip} className="flex items-start gap-2 text-sm text-slate-600">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF8C42]" />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </SpecializationDetailSection>
  );
}
