'use client';

import { ArrowLeft, CircleHelp, SlidersHorizontal } from 'lucide-react';

export interface MealPlanOrdersHeaderProps {
  onBack: () => void;
  onHelp: () => void;
  onFilter: () => void;
}

export function MealPlanOrdersHeader({ onBack, onHelp, onFilter }: MealPlanOrdersHeaderProps) {
  return (
    <header className="shrink-0 border-b border-orange-100/90 bg-orange-50/95 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-sm">
      <div className="flex items-start gap-2 px-4 pb-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-800 shadow-sm ring-1 ring-black/[0.06] transition active:scale-[0.97] active:bg-orange-50/80"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2.25} />
        </button>

        <div className="min-w-0 flex-1 pt-0.5">
          <h1 className="text-xl font-bold leading-snug tracking-tight text-slate-900 sm:text-[1.35rem]">
            Meal Plan Orders
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">Track your meal plan deliveries</p>
        </div>

        <div className="flex shrink-0 items-start gap-1 pt-0.5">
          <button
            type="button"
            onClick={onHelp}
            className="flex min-w-[44px] flex-col items-center gap-0.5 rounded-xl px-1.5 py-1 text-slate-700 transition active:bg-white/70"
            aria-label="Help"
          >
            <CircleHelp className="h-5 w-5" strokeWidth={2} />
            <span className="text-[10px] font-medium text-slate-500">Help</span>
          </button>
          <button
            type="button"
            onClick={onFilter}
            className="flex min-w-[44px] flex-col items-center gap-0.5 rounded-xl px-1.5 py-1 text-slate-700 transition active:bg-white/70"
            aria-label="Filter orders"
          >
            <SlidersHorizontal className="h-5 w-5" strokeWidth={2} />
            <span className="text-[10px] font-medium text-slate-500">Filter</span>
          </button>
        </div>
      </div>
    </header>
  );
}
