'use client';

import type { MarketplaceTimelineStep } from '@/lib/marketplace/types';
import { Check } from 'lucide-react';

export function MarketplaceTimeline({
  steps,
  orientation = 'vertical',
}: {
  steps: MarketplaceTimelineStep[];
  orientation?: 'vertical' | 'horizontal';
}) {
  if (orientation === 'horizontal') {
    const currentIdx = steps.findIndex((s) => s.current) ?? steps.filter((s) => s.completed).length - 1;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          {steps.map((step, i) => (
            <div key={step.id} className="flex flex-1 items-center gap-1">
              <div
                className={`h-2 flex-1 rounded-full ${
                  step.completed || i <= currentIdx ? 'bg-orange-500' : 'bg-slate-200'
                }`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-slate-500">
          {steps.map((s) => (
            <span key={s.id} className={s.current ? 'font-semibold text-orange-600' : ''}>
              {s.label}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <ol className="space-y-0">
      {steps.map((step, idx) => (
        <li key={step.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${
                step.completed
                  ? 'border-orange-500 bg-orange-500 text-white'
                  : step.current
                    ? 'border-orange-500 bg-white text-orange-600'
                    : 'border-slate-200 bg-white text-slate-400'
              }`}
            >
              {step.completed ? <Check className="h-3.5 w-3.5" /> : <span className="text-xs">{idx + 1}</span>}
            </div>
            {idx < steps.length - 1 ? (
              <div className={`w-0.5 flex-1 min-h-[24px] ${step.completed ? 'bg-orange-300' : 'bg-slate-200'}`} />
            ) : null}
          </div>
          <div className="pb-5 pt-0.5">
            <p
              className={`text-sm font-medium ${
                step.current ? 'text-orange-700' : step.completed ? 'text-slate-900' : 'text-slate-500'
              }`}
            >
              {step.label}
            </p>
            {step.description ? (
              <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
