'use client';

import type { MouseEvent, ReactNode } from 'react';
import { Calendar, Clock, Download, PawPrint, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MealPlanOrder } from '@/components/customer/meal-plans/MealPlanOrdersPanel';
import {
  formatMealOrderDeliveryDate,
  formatMealOrderDeliveryTime,
  isMealOrderCancelled,
  isMealOrderDelivered,
  mealOrderStatusChipLabel,
  mealOrderStatusChipTone,
  mealOrderStatusMessage,
} from '@/components/customer/meal-plans/meal-plan-order-display';
import { StatusChip } from '@/components/customer/meal-plans/StatusChip';
import { StatusMessageBanner } from '@/components/customer/meal-plans/StatusMessageBanner';
import {
  isMealOrderAwaitingPayment,
  isMealOrderPaymentHoldVisible,
  PaymentHoldBanner,
  resolvePaymentHoldExpiresAt,
} from '@/lib/payment-hold-ui';
import { isMealOrderInvoiceAvailable } from '@/lib/meal-order-invoice-download';
import { MealRefundReviewListBanner } from '@/components/customer/meal-plans/MealRefundReviewListBanner';

function MealOrderThumbnail({
  imageUrl,
  mealName,
}: {
  imageUrl?: string;
  mealName: string;
}) {
  if (imageUrl) {
    return (
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-orange-50 ring-1 ring-orange-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={mealName}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>
    );
  }
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-orange-50 ring-1 ring-orange-100">
      <UtensilsCrossed className="h-6 w-6 text-orange-500" aria-hidden />
    </div>
  );
}

export interface MealOrderCardProps {
  order: MealPlanOrder;
  onTrack: (e: MouseEvent) => void;
  onPayNow: (e: MouseEvent) => void;
  onDownloadInvoice: (e: MouseEvent) => void;
  onReorder: (e: MouseEvent) => void;
  onPaymentHoldExpired: () => void;
}

export function MealOrderCard({
  order,
  onTrack,
  onPayNow,
  onDownloadInvoice,
  onReorder,
  onPaymentHoldExpired,
}: MealOrderCardProps) {
  const petBreed = order.pet_breed;
  const petLine = [order.pet_name, petBreed].filter(Boolean).join(' · ');
  const statusMessage = mealOrderStatusMessage(order);
  const unpaid = isMealOrderAwaitingPayment({
    status: order.status,
    paymentStatus: order.payment_status,
    paymentHoldExpiresAt: order.paymentHoldExpiresAt ?? order.payment_hold_expires_at,
    createdAt: order.created_at,
  });
  const showPaymentHold = isMealOrderPaymentHoldVisible({
    status: order.status,
    paymentStatus: order.payment_status,
    paymentHoldExpiresAt: order.paymentHoldExpiresAt ?? order.payment_hold_expires_at,
    createdAt: order.created_at,
  });
  const invoiceAvailable = isMealOrderInvoiceAvailable(order);
  const cancelled = isMealOrderCancelled(order);
  const delivered = isMealOrderDelivered(order);

  let primaryAction: ReactNode = null;
  let secondaryAction: ReactNode = null;

  if (unpaid) {
    primaryAction = (
      <Button type="button" size="sm" className="min-h-10 flex-1 rounded-xl" onClick={onPayNow}>
        Pay now
      </Button>
    );
  } else if (cancelled) {
    primaryAction = (
      <Button type="button" size="sm" className="min-h-10 flex-1 rounded-xl" onClick={onReorder}>
        Reorder
      </Button>
    );
    if (invoiceAvailable) {
      secondaryAction = (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-10 flex-1 rounded-xl border-slate-200"
          onClick={onDownloadInvoice}
        >
          <Download className="h-4 w-4" />
          Invoice
        </Button>
      );
    }
  } else {
    primaryAction = (
      <Button type="button" size="sm" className="min-h-10 flex-1 rounded-xl" onClick={onTrack}>
        Track Order
      </Button>
    );
    if (delivered && invoiceAvailable) {
      secondaryAction = (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-10 flex-1 rounded-xl border-slate-200"
          onClick={onDownloadInvoice}
        >
          <Download className="h-4 w-4" />
          Invoice
        </Button>
      );
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60">
      <div className="flex gap-3">
        <MealOrderThumbnail imageUrl={order.meal_plan_image_url} mealName={order.meal_plan_name || 'Meal plan'} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-sm font-bold text-slate-900">
                  {order.meal_plan_name || 'Meal Plan'}
                </h3>
                <StatusChip
                  label={mealOrderStatusChipLabel(order)}
                  tone={mealOrderStatusChipTone(order)}
                />
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-base font-bold tabular-nums text-orange-600">
                ₹{Number(order.total_amount).toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-slate-500">Qty: {order.quantity ?? '—'}</p>
            </div>
          </div>

          {petLine ? (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-600">
              <PawPrint className="h-3.5 w-3.5 shrink-0 text-orange-400" aria-hidden />
              <span className="truncate">{petLine}</span>
            </p>
          ) : null}

          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3 shrink-0" aria-hidden />
              {formatMealOrderDeliveryDate(order.delivery_date)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0" aria-hidden />
              {formatMealOrderDeliveryTime(order.delivery_time)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {order.status?.toLowerCase() === 'cancelled' &&
        order.refundReview?.status === 'pending_review' ? (
          <MealRefundReviewListBanner refundReview={order.refundReview} />
        ) : null}

        {showPaymentHold ? (
          <PaymentHoldBanner
            expiresAt={resolvePaymentHoldExpiresAt({
              paymentHoldExpiresAt: order.paymentHoldExpiresAt ?? order.payment_hold_expires_at,
              createdAt: order.created_at,
            })}
            onPayNow={onPayNow}
            onExpired={onPaymentHoldExpired}
            holdMessage="Complete payment within 5 minutes to confirm your order with the kitchen."
          />
        ) : (
          <StatusMessageBanner
            tone={statusMessage.tone}
            title={statusMessage.title}
            subtitle={statusMessage.subtitle}
          />
        )}
      </div>

      {(primaryAction || secondaryAction) && (
        <div className="mt-3 flex gap-2">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </article>
  );
}
