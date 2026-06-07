'use client';

import { Check } from 'lucide-react';
import type { CheckoutStep } from '@/context/CheckoutProvider';

const STEPS: { id: CheckoutStep; label: string }[] = [
  { id: 'address', label: 'Address' },
  { id: 'payment', label: 'Payment' },
  { id: 'review', label: 'Review' },
];

type CheckoutStepperProps = {
  current: CheckoutStep;
};

export function CheckoutStepper({ current }: CheckoutStepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  return (
    <nav aria-label="Checkout progress" className="flex items-center justify-between gap-2 px-1">
      {STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = step.id === current;
        return (
          <div key={step.id} className="flex flex-1 items-center min-w-0">
            <div className="flex flex-col items-center flex-1 min-w-0">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  done
                    ? 'bg-emerald-500 text-white'
                    : active
                      ? 'bg-[#FF8C42] text-white ring-4 ring-orange-100'
                      : 'bg-slate-100 text-slate-400'
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={`mt-1.5 text-xs font-medium truncate max-w-full ${
                  active ? 'text-[#FF8C42]' : done ? 'text-emerald-600' : 'text-slate-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-1 mb-5 rounded-full ${
                  index < currentIndex ? 'bg-emerald-400' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
