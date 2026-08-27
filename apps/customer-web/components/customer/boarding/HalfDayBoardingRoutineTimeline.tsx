'use client';

import {
  ArrowRight,
  Bed,
  ClipboardCheck,
  Home,
  LogOut,
  Sparkles,
  Sun,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import { SpecializationDetailSection } from '../specialization-detail/SpecializationDetailSection';
import type { SpecializationTimelineItem } from '@/lib/specialization-detail';

const STEP_ICONS: LucideIcon[] = [
  ClipboardCheck,
  Home,
  Sparkles,
  UtensilsCrossed,
  Bed,
  Sun,
  UtensilsCrossed,
  LogOut,
];

type HalfDayBoardingRoutineTimelineProps = {
  items: SpecializationTimelineItem[];
  title?: string;
};

export function HalfDayBoardingRoutineTimeline({
  items,
  title = 'Sample Half Day Routine',
}: HalfDayBoardingRoutineTimelineProps) {
  if (!items.length) return null;

  return (
    <SpecializationDetailSection
      delay={0.14}
      className="rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm"
    >
      <h2 className="mb-4 text-lg font-bold text-slate-900">{title}</h2>
      <div className="-mx-1 overflow-x-auto pb-1 scrollbar-hide">
        <div className="flex min-w-max items-start gap-1 px-1">
          {items.map((item, index) => {
            const Icon = STEP_ICONS[index] ?? Sun;
            const isLast = index === items.length - 1;
            return (
              <div key={`${item.period}-${item.title}`} className="flex items-start">
                <div className="flex w-[4.5rem] shrink-0 flex-col items-center gap-2 sm:w-[5rem]">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-[#FF8C42] shadow-sm">
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <p className="text-center text-[9px] font-bold leading-tight text-slate-800 sm:text-[10px]">
                    {item.period}
                  </p>
                </div>
                {!isLast ? (
                  <ArrowRight
                    className="mx-0.5 mt-3 h-4 w-4 shrink-0 text-orange-300"
                    aria-hidden
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </SpecializationDetailSection>
  );
}
