'use client';

import { Check } from 'lucide-react';
import { mealKitchenProgress, type MealKitchenProgressOptions } from '@/lib/meal-kitchen-progress';
import { formatTrackingTimeOnly } from '@/components/customer/tracking/meal-tracking-display';

const STEPS = [
  'Confirmed',
  'Preparing',
  'Ready for Pickup',
  'Picked Up',
  'Out for Delivery',
  'Delivered',
] as const;

export interface MealDeliveryProgressTimelineProps {
  orderStatus: string;
  logisticsStatus: string | null | undefined;
  progressOptions?: MealKitchenProgressOptions;
  stepTimestamps?: Partial<Record<number, string>>;
}

export function MealDeliveryProgressTimeline({
  orderStatus,
  logisticsStatus,
  progressOptions,
  stepTimestamps = {},
}: MealDeliveryProgressTimelineProps) {
  const { filled, current } = mealKitchenProgress(orderStatus, logisticsStatus, progressOptions);

  return (
    <section
      className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60"
      aria-label="Delivery progress"
    >
      <h2 className="mb-4 text-base font-bold text-slate-900">Delivery Progress</h2>

      <div className="overflow-x-auto pb-1 -mx-1 px-1">
        <ol className="flex min-w-max gap-0" role="list">
          {STEPS.map((label, index) => {
            const isComplete = index < filled;
            const isCurrent = current === index;
            const isActive = isComplete || isCurrent;
            const ts = stepTimestamps[index];
            const timeStr = ts ? formatTrackingTimeOnly(ts) : null;
            const lineGreen =
              index < STEPS.length - 1 &&
              (index + 1 < filled || (index + 1 === filled && current != null && current > index));

            return (
              <li
                key={label}
                className="flex min-w-[4.5rem] max-w-[5.5rem] flex-1 flex-col items-center"
                aria-current={isCurrent ? 'step' : undefined}
              >
                <div className="flex w-full items-center">
                  {index > 0 ? (
                    <div
                      className={`h-0.5 flex-1 ${lineGreen ? 'bg-emerald-500' : 'bg-slate-200'}`}
                      aria-hidden
                    />
                  ) : (
                    <div className="flex-1" aria-hidden />
                  )}
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      isComplete
                        ? 'bg-emerald-500 text-white'
                        : isCurrent
                          ? 'bg-emerald-500 text-white ring-4 ring-emerald-100'
                          : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {isComplete && !isCurrent ? (
                      <Check className="h-4 w-4 stroke-[3]" aria-hidden />
                    ) : (
                      <span className="text-[10px]">{index + 1}</span>
                    )}
                  </div>
                  {index < STEPS.length - 1 ? (
                    <div
                      className={`h-0.5 flex-1 ${
                        index < filled - 1 || (index === filled - 1 && current == null)
                          ? 'bg-emerald-500'
                          : 'bg-slate-200'
                      }`}
                      aria-hidden
                    />
                  ) : (
                    <div className="flex-1" aria-hidden />
                  )}
                </div>
                <p
                  className={`mt-2 w-full px-0.5 text-center text-[10px] leading-tight ${
                    isActive ? 'font-semibold text-slate-900' : 'font-medium text-slate-400'
                  }`}
                >
                  {label}
                </p>
                {timeStr ? (
                  <p className="mt-0.5 text-[9px] tabular-nums text-emerald-700">{timeStr}</p>
                ) : (
                  <p className="mt-0.5 h-[11px]" aria-hidden />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
