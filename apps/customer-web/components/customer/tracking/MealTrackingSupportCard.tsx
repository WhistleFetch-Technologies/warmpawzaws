'use client';

import {
  AlertCircle,
  HelpCircle,
  MessageCircle,
  Package,
  UtensilsCrossed,
} from 'lucide-react';
import { rememberSupportOpenContactForm } from '@/lib/support-contact';

const ISSUES = [
  { id: 'wrong_meal', label: 'Wrong Meal', icon: UtensilsCrossed },
  { id: 'delivery', label: 'Delivery Issue', icon: Package },
  { id: 'quality', label: 'Meal Quality', icon: AlertCircle },
  { id: 'other', label: 'Other', icon: HelpCircle },
] as const;

export function MealTrackingSupportCard({ onContactSupport }: { onContactSupport: () => void }) {
  const openIssue = () => {
    rememberSupportOpenContactForm();
    onContactSupport();
  };

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60">
      <div className="mb-3">
        <h2 className="text-base font-bold text-slate-900">Need Help?</h2>
        <p className="text-sm text-slate-500">We&apos;re here for you</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {ISSUES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={openIssue}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-left text-xs font-semibold text-slate-800 transition active:bg-slate-100"
          >
            <Icon className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={openIssue}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-emerald-200 bg-emerald-50/50 text-sm font-semibold text-emerald-800 transition active:bg-emerald-100/80"
      >
        <MessageCircle className="h-5 w-5" aria-hidden />
        Chat with Support
      </button>
    </section>
  );
}
