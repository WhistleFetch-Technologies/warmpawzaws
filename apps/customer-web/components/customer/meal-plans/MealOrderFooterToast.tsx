'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowRight, Check, Package, Truck, X } from 'lucide-react';
import { useProfileMenuOpen } from '@/lib/profile-menu-open-context';
import { isCustomerMealPlansEnabled } from '@/lib/customer-meal-plans-flag';
import { useMealOrderFooterToast } from '@/hooks/useMealOrderFooterToast';
import {
  MEAL_FOOTER_STEPS,
  mealFooterHeadline,
  mealFooterStepIndex,
  mealFooterSubline,
} from '@/lib/meal-order-footer-toast';

function StepIcon({ done, active }: { done: boolean; active: boolean }) {
  if (done) {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
      </span>
    );
  }
  if (active) {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-emerald-500 bg-white">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
      </span>
    );
  }
  return <span className="h-5 w-5 rounded-full border-2 border-slate-200 bg-white" />;
}

function StatusIcon({ status }: { status: string }) {
  const cls = 'h-5 w-5 text-emerald-600';
  if (status === 'on_the_way' || status === 'picked_up') {
    return <Truck className={cls} aria-hidden />;
  }
  if (status === 'delivered') {
    return <Check className={cls} aria-hidden />;
  }
  return <Package className={cls} aria-hidden />;
}

export function MealOrderFooterToast() {
  const router = useRouter();
  const pathname = usePathname();
  const profileMenuOpen = useProfileMenuOpen();
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    const read = () => setPhone(localStorage.getItem('customerPhone'));
    read();
    window.addEventListener('storage', read);
    return () => window.removeEventListener('storage', read);
  }, []);

  const { order, visible, dismiss } = useMealOrderFooterToast(phone);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!visible) {
      setEntered(false);
      return;
    }
    const t = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(t);
  }, [visible, order?.orderId, order?.status]);

  if (!isCustomerMealPlansEnabled() || profileMenuOpen || !visible || !order) {
    return null;
  }

  const trackMatch = pathname?.match(/^\/track\/([^/]+)/);
  if (trackMatch && trackMatch[1] === order.orderId) {
    return null;
  }

  const stepIdx = mealFooterStepIndex(order.status);
  const headline = mealFooterHeadline(order.status);
  const subline = mealFooterSubline(order);

  return (
    <div
      className="fixed inset-x-0 z-[96] mx-auto max-w-customer bottom-[var(--customer-tabbed-nav-offset)] px-3 pb-2 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div
        className={`pointer-events-auto overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg transition-all duration-300 ${
          entered ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}
      >
        <div className="flex">
          <div className="w-1 shrink-0 bg-emerald-500" aria-hidden />
          <div className="min-w-0 flex-1 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                <StatusIcon status={order.status} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900">{headline}</p>
                  <button
                    type="button"
                    onClick={dismiss}
                    className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Dismiss notification"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{subline}</p>
              </div>
            </div>

            {order.status !== 'delivered' ? (
              <button
                type="button"
                onClick={() => router.push(`/track/${order.orderId}`)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF8C42] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#FF7A29]"
              >
                Track order
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            ) : null}

            <div className="mt-4">
              <div className="flex items-start">
                {MEAL_FOOTER_STEPS.map((step, index) => {
                  const done = index < stepIdx;
                  const active = index === stepIdx;
                  const segmentDone = index < stepIdx;
                  return (
                    <div key={step.id} className="flex flex-1 items-start">
                      <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
                        <StepIcon done={done} active={active} />
                        <span
                          className={`max-w-[3.25rem] text-center text-[9px] font-medium leading-tight ${
                            done || active ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                      {index < MEAL_FOOTER_STEPS.length - 1 ? (
                        <div
                          className={`mt-2.5 h-0.5 w-full min-w-[6px] max-w-[1.25rem] flex-1 ${
                            segmentDone ? 'bg-emerald-400' : 'border-t border-dashed border-slate-200'
                          }`}
                          aria-hidden
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
