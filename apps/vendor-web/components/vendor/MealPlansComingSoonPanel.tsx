'use client';

import { Calendar } from 'lucide-react';

type Props = { className?: string };

export function MealPlansComingSoonPanel({ className = '' }: Props) {
  return (
    <div
      className={`rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/90 to-white p-8 text-center ${className}`}
    >
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
        <Calendar className="h-7 w-7" aria-hidden />
      </div>
      <span className="mb-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
        Coming soon
      </span>
      <h2 className="mt-2 text-lg font-semibold text-slate-900">Meal plans</h2>
      <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
        Creating and managing customer meal subscriptions is not available yet. Diet charts and your nutrition kitchen dashboard are unchanged.
      </p>
    </div>
  );
}
