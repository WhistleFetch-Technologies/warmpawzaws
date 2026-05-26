'use client';

import { AlertCircle } from 'lucide-react';
import { mealKitchenClosedMessage } from '@/lib/meal-kitchen-availability';

interface MealKitchenStatusBannerProps {
  message?: string | null;
  className?: string;
}

export function MealKitchenStatusBanner({ message, className = '' }: MealKitchenStatusBannerProps) {
  const text = message?.trim() || mealKitchenClosedMessage(null);
  return (
    <div
      role="status"
      className={`flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ${className}`}
    >
      <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold">Not taking orders</p>
        <p className="text-xs text-amber-800/90 mt-0.5">{text}</p>
      </div>
    </div>
  );
}

export function MealKitchenClosedBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ${className}`}
    >
      Not taking orders
    </span>
  );
}
