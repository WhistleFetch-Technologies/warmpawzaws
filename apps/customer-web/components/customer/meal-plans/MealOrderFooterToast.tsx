'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
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
import { invokeMealShellTrack } from '@/lib/meal-shell-track-bridge';

function readPhoneFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  const keys = ['customerPhone', 'customer_phone', 'phone'] as const;
  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (raw) {
      const last10 = raw.replace(/\D/g, '').slice(-10);
      if (last10.length >= 10) return last10;
    }
  }
  return null;
}

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

interface MealOrderFooterToastProps {
  /** Prefer session phone from shell; falls back to localStorage. */
  customerPhone?: string;
}

export function MealOrderFooterToast({ customerPhone: customerPhoneProp }: MealOrderFooterToastProps) {
  const router = useRouter();
  const profileMenuOpen = useProfileMenuOpen();
  const [storedPhone, setStoredPhone] = useState<string | null>(() => readPhoneFromStorage());

  useEffect(() => {
    const read = () => setStoredPhone(readPhoneFromStorage());
    read();
    window.addEventListener('storage', read);
    window.addEventListener('focus', read);
    document.addEventListener('visibilitychange', read);
    const id = setInterval(read, 3000);
    return () => {
      window.removeEventListener('storage', read);
      window.removeEventListener('focus', read);
      document.removeEventListener('visibilitychange', read);
      clearInterval(id);
    };
  }, []);

  const phone =
    (customerPhoneProp || '').replace(/\D/g, '').slice(-10).length >= 10
      ? customerPhoneProp!.replace(/\D/g, '').slice(-10)
      : storedPhone;

  const { order, visible, dismiss } = useMealOrderFooterToast(phone);
  const [entered, setEntered] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!visible) {
      setEntered(false);
      return;
    }
    const t = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(t);
  }, [visible, order?.orderId, order?.status]);

  if (!mounted || !isCustomerMealPlansEnabled() || profileMenuOpen || !visible || !order) {
    return null;
  }

  const stepIdx = mealFooterStepIndex(order.status);
  const headline = mealFooterHeadline(order.status);
  const subline = mealFooterSubline(order);

  const handleTrackOrder = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (invokeMealShellTrack(order.orderId)) return;
    router.push(`/track/${order.orderId}?from=meal-footer`);
  };
  return createPortal(
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
                onClick={handleTrackOrder}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF8C42] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#FF7A29]"
              >
                Track order
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            ) : null}

            <div className="mt-4">
              <div className="flex items-start">
                {MEAL_FOOTER_STEPS.map((step, index) => {
                  const done = stepIdx >= 0 && index < stepIdx;
                  const active = stepIdx >= 0 && index === stepIdx;
                  const segmentDone = stepIdx >= 0 && index < stepIdx;
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
    </div>,
    document.body,
  );
}
