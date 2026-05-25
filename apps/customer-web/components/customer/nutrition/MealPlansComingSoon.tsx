'use client';

import { ArrowLeft, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export interface MealPlansComingSoonProps {
  onBack?: () => void;
  /** Full-page header with back (nutrition / orders routes). */
  showHeader?: boolean;
  title?: string;
  subtitle?: string;
}

/**
 * Non-actionable meal plans + tracking placeholder (prod until launch).
 */
export function MealPlansComingSoon({
  onBack,
  showHeader = true,
  title = 'Meal plans',
  subtitle = 'Fresh, vet-approved meals for your pet',
}: MealPlansComingSoonProps) {
  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {showHeader ? (
        <div className="relative bg-gradient-to-br from-emerald-500 to-teal-600 pb-16 pl-[max(1.5rem,env(safe-area-inset-left,0px))] pr-[max(1.5rem,env(safe-area-inset-right,0px))] text-white cw-header-safe-top">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="mb-4 flex min-h-[44px] items-center gap-2 text-white/90 hover:text-white touch-manipulation"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </button>
          ) : null}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{title}</h1>
              <p className="text-white/80 text-sm">{subtitle}</p>
            </div>
          </div>
          <div
            className="absolute bottom-0 left-0 right-0 h-8 bg-gray-50"
            style={{
              borderTopLeftRadius: '50% 100%',
              borderTopRightRadius: '50% 100%',
            }}
          />
        </div>
      ) : null}

      <div className={`px-6 pb-24 ${showHeader ? '-mt-2' : 'pt-8'}`}>
        <Card className="bg-amber-50 border-amber-200 p-6 text-center shadow-sm">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UtensilsCrossed className="w-8 h-8 text-amber-700" />
          </div>
          <span className="inline-block text-[11px] font-bold uppercase tracking-wide bg-amber-500 text-white px-3 py-1 rounded-full mb-3">
            Coming soon
          </span>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Meal plans &amp; delivery tracking</h2>
          <p className="text-gray-700 mb-6 text-sm leading-relaxed">
            We&apos;re finishing meal plan subscriptions and live delivery tracking. You&apos;ll be able to browse
            nutritionist meal plans and follow your orders here when we launch.
          </p>
          <Button
            type="button"
            disabled
            className="w-full bg-slate-400 text-white h-12 text-lg font-bold cursor-not-allowed opacity-95"
          >
            COMING SOON
          </Button>
        </Card>
      </div>
    </div>
  );
}
