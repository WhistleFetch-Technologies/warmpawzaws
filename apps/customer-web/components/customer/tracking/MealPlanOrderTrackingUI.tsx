'use client';

import type { ReactNode } from 'react';
import { Check, Package, Truck, MapPin } from 'lucide-react';
import {
  resolveEffectiveMealDeliveryState,
  splitMealStatusSegments,
  type MealDeliveryEffective,
} from '@warmpawz/shared-types';

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

/** Six-step meal + hyperlocal timeline (order status + optional delivery_tracking). */
export function mealKitchenProgress(
  orderStatus: string,
  logisticsStatus?: string | null,
): { filled: number; current: number | null } {
  const eff = resolveEffectiveMealDeliveryState(orderStatus, logisticsStatus);
  if (eff === 'cancelled') return { filled: 0, current: null };
  if (eff === 'failed') return { filled: 5, current: 5 };
  if (eff === 'delivered') {
    return { filled: MEAL_TIMELINE_STEPS.length, current: null };
  }

  /**
   * One "filled" unit = previous step completed with a check. `current` is the active step index.
   * `confirmed` stays on step 0 (Order Confirmed) until the kitchen moves to preparing — it does not
   * jump ahead just because a rider is being assigned (`pending_assignment` on tracking).
   */
  const progress: Record<
    Exclude<MealDeliveryEffective, 'delivered' | 'cancelled' | 'failed'>,
    { filled: number; current: number | null }
  > = {
    pending: { filled: 0, current: 0 },
    confirmed: { filled: 0, current: 0 },
    preparing: { filled: 1, current: 1 },
    ready_for_pickup: { filled: 2, current: 2 },
    picked_up: { filled: 3, current: 3 },
    on_the_way: { filled: 4, current: 4 },
  };

  return progress[eff] ?? { filled: 0, current: 0 };
}

export function mealHeroHeadline(
  orderStatus: string,
  logisticsStatus: string | null | undefined
): string {
  const eff = resolveEffectiveMealDeliveryState(orderStatus, logisticsStatus);
  if (eff === 'delivered') return 'Delivered!';
  if (eff === 'cancelled') return 'Cancelled';
  if (eff === 'failed') return 'Delivery issue — support will assist';

  const segs = splitMealStatusSegments(logisticsStatus);
  if (segs.includes('pending_assignment')) return 'Finding delivery partner…';
  if (segs.includes('assigned') || segs.includes('heading_to_pickup')) return 'Rider heading to pickup…';
  if (segs.includes('at_pickup')) return 'Rider at pickup…';

  switch (eff) {
    case 'pending':
      return 'Awaiting confirmation…';
    case 'confirmed':
      return 'Processing…';
    case 'preparing':
      return 'Being prepared…';
    case 'ready_for_pickup':
      return 'Ready for pickup';
    case 'picked_up':
      return 'Picked up';
    case 'on_the_way':
      return 'Out for delivery…';
    default:
      return 'Processing…';
  }
}

export interface MealPlanOrderTrackingUIProps {
  orderDisplayId: string;
  orderStatus: string;
  logisticsStatus: string | null | undefined;
  totalAmount?: number;
  headerActions?: ReactNode;
  backSlot: ReactNode;
  deliveryOtpBanner?: ReactNode;
  deliveryPartnerCard?: ReactNode;
  deliveredBanner?: ReactNode;
  orderDetailsCollapsible?: ReactNode;
  floatingChatButton?: ReactNode;
}

export function MealPlanOrderTrackingUI({
  orderDisplayId,
  orderStatus,
  logisticsStatus,
  totalAmount,
  headerActions,
  backSlot,
  deliveryOtpBanner,
  deliveryPartnerCard,
  deliveredBanner,
  orderDetailsCollapsible,
  floatingChatButton,
}: MealPlanOrderTrackingUIProps) {
  const { filled, current } = mealKitchenProgress(orderStatus, logisticsStatus);
  const heroLine = mealHeroHeadline(orderStatus, logisticsStatus);

  return (
    <div className="min-h-screen bg-[#f0fdf9] pb-28">
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
        {deliveryOtpBanner}

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

        {deliveryPartnerCard}

        {deliveredBanner}

        {orderDetailsCollapsible}
      </main>

      {floatingChatButton ? (
        <div className="fixed bottom-6 right-6 z-40">{floatingChatButton}</div>
      ) : null}
    </div>
  );
}
