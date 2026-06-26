'use client';

import type { ReactNode } from 'react';
import { Check, Package, Truck, MapPin } from 'lucide-react';
import {
  mealKitchenProgress,
  mealHeroHeadline,
  type MealKitchenProgressOptions,
} from '@/lib/meal-kitchen-progress';

export { mealKitchenProgress, mealHeroHeadline, type MealKitchenProgressOptions } from '@/lib/meal-kitchen-progress';

const MEAL_TIMELINE_STEPS = [
  { label: 'Order Confirmed', Icon: Package },
  { label: 'Preparing', Icon: Package },
  { label: 'Ready for Pickup', Icon: Package },
  { label: 'Picked Up', Icon: Truck },
  { label: 'Out for Delivery', Icon: MapPin },
  { label: 'Delivered', Icon: Check },
] as const;

export function formatMealOrderDisplayId(order: {
  order_number?: string;
  orderNumber?: string;
  id?: string;
}): string {
  const raw = (order.order_number || order.orderNumber || '').trim();
  if (raw) return raw.startsWith('#') ? raw : `#${raw}`;
  const id = order.id?.replace(/-/g, '') ?? '';
  const tail = id.length >= 8 ? id.slice(-10) : id || '—';
  return `#${tail}`;
}

export interface MealPlanOrderTrackingUIProps {
  orderDisplayId: string;
  orderStatus: string;
  logisticsStatus: string | null | undefined;
  totalAmount?: number;
  refundReviewCard?: ReactNode;
  reassignPending?: boolean;
  headerActions?: ReactNode;
  backSlot: ReactNode;
  deliveryOtpBanner?: ReactNode;
  liveTrackingMap?: ReactNode;
  deliveryPartnerCard?: ReactNode;
  deliveredBanner?: ReactNode;
  cancelledBanner?: ReactNode;
  customerDetailsCard?: ReactNode;
  orderDetailsCollapsible?: ReactNode;
  supportHelpCard?: ReactNode;
  cancelledBy?: string | null;
  cancelledAt?: string | null;
}

export function MealPlanOrderTrackingUI({
  orderDisplayId,
  orderStatus,
  logisticsStatus,
  totalAmount,
  refundReviewCard,
  reassignPending = false,
  headerActions,
  backSlot,
  deliveryOtpBanner,
  liveTrackingMap,
  deliveryPartnerCard,
  deliveredBanner,
  cancelledBanner,
  customerDetailsCard,
  orderDetailsCollapsible,
  supportHelpCard,
  cancelledBy,
  cancelledAt,
}: MealPlanOrderTrackingUIProps) {
  const progressOptions: MealKitchenProgressOptions = {
    reassignPending,
    cancelledBy,
    cancelledAt,
  };
  const { filled, current } = mealKitchenProgress(orderStatus, logisticsStatus, progressOptions);
  const heroLine = mealHeroHeadline(orderStatus, logisticsStatus, progressOptions);

  return (
    <div className="min-h-screen bg-[#f0fdf9] pb-8">
      {/* Header — green → teal gradient */}
      <header className="bg-gradient-to-r from-green-600 to-teal-600 pb-6 px-4 text-white">
        <div className="max-w-md mx-auto flex items-start gap-3 pt-12 sm:pt-14">
          <div className="shrink-0 pt-0.5">{backSlot}</div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold tracking-tight">Track Order</h1>
            <p className="text-sm text-white/85 mt-0.5 font-medium">{orderDisplayId}</p>
            {totalAmount != null && Number.isFinite(totalAmount) ? (
              <p className="text-sm text-white/75 mt-1">₹{Number(totalAmount).toLocaleString('en-IN')}</p>
            ) : null}
          </div>
          {headerActions ? <div className="shrink-0 flex items-center gap-2">{headerActions}</div> : null}
        </div>
      </header>

      {/* Mint hero — status illustration */}
      <div className="bg-[#ecfdf5] border-b border-emerald-100/80">
        <div className="max-w-md mx-auto px-6 py-10 flex flex-col items-center">
          <div className="w-[4.5rem] h-[4.5rem] rounded-full bg-white shadow-md flex items-center justify-center ring-4 ring-white">
            <Package className="w-9 h-9 text-green-600 stroke-[1.5]" aria-hidden />
          </div>
          <p className="mt-4 text-base font-semibold text-slate-800">{heroLine}</p>
        </div>
      </div>

      <main className="max-w-md mx-auto px-4 -mt-2 space-y-4">
        {refundReviewCard}

        {deliveryOtpBanner}

        {deliveryPartnerCard}

        {liveTrackingMap}

        {/* Order Status card */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100/80 p-5">
          <h2 className="text-base font-bold text-slate-900 mb-5">Order Status</h2>
          <ul className="space-y-0">
            {MEAL_TIMELINE_STEPS.map((step, index) => {
              const isCurrent = current === index;
              const Icon = step.Icon;
              const showCheck = index < filled && !isCurrent;
              const pendingGrey = !showCheck && !isCurrent;

              const segmentGreen =
                index < MEAL_TIMELINE_STEPS.length - 1 &&
                (index + 1 < filled ||
                  (index + 1 === filled && current != null && current > index));

              return (
                <li key={step.label} className="flex gap-4">
                  <div className="flex flex-col items-center shrink-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                        showCheck
                          ? 'bg-green-500 text-white'
                          : isCurrent
                            ? 'bg-green-500 text-white ring-4 ring-green-100'
                            : 'bg-slate-100 text-slate-400'
                      }`}
                      aria-current={isCurrent ? 'step' : undefined}
                    >
                      {showCheck ? (
                        <Check className="w-5 h-5 stroke-[3]" aria-hidden />
                      ) : (
                        <Icon className={`w-5 h-5 ${pendingGrey ? 'opacity-70' : ''}`} aria-hidden />
                      )}
                    </div>
                    {index < MEAL_TIMELINE_STEPS.length - 1 ? (
                      <div
                        className={`w-0.5 flex-1 min-h-[28px] mt-1 ${segmentGreen ? 'bg-green-500' : 'bg-slate-200'}`}
                        aria-hidden
                      />
                    ) : null}
                  </div>
                  <div className={`pb-6 pt-1.5 flex-1 ${pendingGrey ? 'text-slate-400' : 'text-slate-900'}`}>
                    <p className={`text-sm ${pendingGrey ? 'font-medium text-slate-400' : 'font-bold text-slate-900'}`}>
                      {step.label}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {supportHelpCard}

        {cancelledBanner}

        {deliveredBanner}

        {customerDetailsCard}

        {orderDetailsCollapsible}
      </main>
    </div>
  );
}
