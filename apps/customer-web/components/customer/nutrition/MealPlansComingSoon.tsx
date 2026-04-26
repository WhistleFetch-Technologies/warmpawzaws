'use client';

import { Calendar } from 'lucide-react';

type MealPlansComingSoonProps = {
  onBack?: () => void;
  onDismiss?: () => void;
  className?: string;
};

export function MealPlansComingSoon({ onBack, onDismiss, className = '' }: MealPlansComingSoonProps) {
  const goBack = onBack ?? onDismiss;
  return (
    <div className={`rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/90 to-white p-6 text-center ${className}`}>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
        <Calendar className="h-7 w-7" aria-hidden />
      </div>
      <span className="mb-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
        Coming soon
      </span>
      <h2 className="mt-2 text-lg font-semibold text-slate-900">Meal plans</h2>
      <p className="mt-2 text-sm text-slate-600 leading-relaxed">
        Monthly meal subscriptions are not available yet. Diet consultations and other nutrition services are unchanged.
      </p>
      {goBack && (
        <button
          type="button"
          onClick={goBack}
          className="mt-5 w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
        >
          Go back
        </button>
      )}
    </div>
  );
}
