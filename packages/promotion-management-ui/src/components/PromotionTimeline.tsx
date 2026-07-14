'use client';

import type { VisualLifecycle } from '../types';
import { LIFECYCLE_LABELS } from '../lifecycle';

const STEPS: VisualLifecycle[] = ['draft', 'scheduled', 'active', 'expired'];

export function PromotionTimeline({
  current,
  startDate,
  endDate,
}: {
  current: VisualLifecycle;
  startDate: string;
  endDate: string;
}) {
  const idx = STEPS.indexOf(current === 'paused' || current === 'archived' ? 'active' : current);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => (
          <div key={step} className="flex flex-1 items-center gap-1">
            <div
              className={`h-2 flex-1 rounded-full ${
                i <= idx ? 'bg-orange-500' : 'bg-slate-200'
              }`}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-slate-500">
        {STEPS.map((s) => (
          <span key={s} className={s === current ? 'font-semibold text-orange-600' : ''}>
            {LIFECYCLE_LABELS[s]}
          </span>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        {new Date(startDate).toLocaleDateString('en-IN')} →{' '}
        {new Date(endDate).toLocaleDateString('en-IN')} · Asia/Kolkata
      </p>
    </div>
  );
}
