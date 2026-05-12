'use client';

import type { ReactNode } from 'react';
import { ArrowLeft, Check, Package, Truck } from 'lucide-react';

const KITCHEN_STEP_META = [
  { label: 'Order Confirmed', Icon: Package },
  { label: 'Preparing', Icon: Package },
  { label: 'Ready for Pickup', Icon: Package },
  { label: 'Picked Up', Icon: Truck },
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

/** Kitchen fulfillment progress (four steps before / alongside hyperlocal rider). */
export function mealKitchenProgress(orderStatus: string): { filled: number; current: number | null } {
  const s = String(orderStatus || '')
    .toLowerCase()
    .trim();
  if (s === 'cancelled') return { filled: 0, current: null };
  if (['pending', 'payment_pending', 'payment_processing'].includes(s)) return { filled: 0, current: 0 };
  if (s === 'confirmed') return { filled: 1, current: null };
  if (s === 'accepted') return { filled: 1, current: 1 };
  if (s === 'preparing') return { filled: 1, current: 1 };
  if (s === 'ready_for_pickup') return { filled: 2, current: 2 };
  if (s === 'picked_up') return { filled: 3, current: 3 };
  if (['on_the_way', 'out_for_delivery', 'in_transit', 'dispatched', 'arriving'].includes(s)) {
    return { filled: 4, current: null };
  }
  if (s === 'delivered') return { filled: 4, current: null };
  return { filled: 1, current: null };
}

export function mealHeroHeadline(
  orderStatus: string,
  logisticsStatus: string | null | undefined
): string {
  const ls = String(logisticsStatus || '')
    .toLowerCase()
    .trim();
  if (ls && ls !== 'pending_assignment') {
    if (ls === 'assigned' || ls === 'heading_to_pickup') return 'Partner assigned…';
    if (ls === 'at_pickup') return 'At pickup…';
    if (ls === 'picked_up') return 'Picked up';
    if (ls === 'on_the_way' || ls === 'nearby') return 'On the way…';
    if (ls === 'delivered') return 'Delivered';
  }
  const s = String(orderStatus || '')
    .toLowerCase()
    .trim();
  if (['pending', 'payment_pending', 'payment_processing'].includes(s)) return 'Awaiting confirmation…';
  if (s === 'confirmed') return 'Processing…';
  if (s === 'accepted') return 'Processing…';
  if (s === 'preparing') return 'Being prepared…';
  if (s === 'ready_for_pickup') return 'Ready for pickup';
  if (s === 'picked_up') return 'Picked up';
  if (['on_the_way', 'out_for_delivery'].includes(s)) return 'On the way…';
  if (s === 'delivered') return 'Delivered!';
  if (s === 'cancelled') return 'Cancelled';
  return 'Processing…';
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
  const { filled, current } = mealKitchenProgress(orderStatus);
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
            {KITCHEN_STEP_META.map((step, index) => {
              const isCurrent = current === index;
              const Icon = step.Icon;
              const showCheck = index < filled && !isCurrent;
              const pendingGrey = !showCheck && !isCurrent;

              const segmentGreen =
                index < KITCHEN_STEP_META.length - 1 &&
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
                    {index < KITCHEN_STEP_META.length - 1 ? (
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
