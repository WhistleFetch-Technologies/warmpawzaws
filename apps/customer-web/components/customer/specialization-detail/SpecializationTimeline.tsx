'use client';

import { SpecializationDetailSection } from './SpecializationDetailSection';
import type { SpecializationTimelineItem } from '@/lib/specialization-detail';

type SpecializationTimelineProps = {
  items: SpecializationTimelineItem[];
  title?: string;
};

export function SpecializationTimeline({ items, title = "Things You'll Learn" }: SpecializationTimelineProps) {
  if (!items.length) return null;

  return (
    <SpecializationDetailSection
      delay={0.2}
      className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm"
    >
      <h2 className="mb-5 text-lg font-bold text-slate-900">{title}</h2>
      <div className="relative space-y-0">
        {items.map((item, index) => (
          <div key={`${item.period}-${item.title}`} className="relative flex gap-4 pb-6 last:pb-0">
            {index < items.length - 1 ? (
              <div className="absolute left-[11px] top-6 h-[calc(100%-8px)] w-0.5 bg-gradient-to-b from-orange-200 to-orange-50" />
            ) : null}
            <div className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-orange-200 bg-orange-50">
              <div className="h-2 w-2 rounded-full bg-[#FF8C42]" />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-xs font-bold uppercase tracking-wide text-[#FF8C42]">{item.period}</p>
              <p className="mt-0.5 text-sm font-medium text-slate-700">{item.title}</p>
            </div>
          </div>
        ))}
      </div>
    </SpecializationDetailSection>
  );
}
