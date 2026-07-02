'use client';

import type { MouseEvent, ReactNode } from 'react';
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
import { StatusMessageBanner } from '@/components/customer/meal-plans/StatusMessageBanner';
import {
  isMealOrderAwaitingPayment,
  isMealOrderPaymentHoldVisible,
  PaymentHoldBanner,
  resolvePaymentHoldExpiresAt,
} from '@/lib/payment-hold-ui';
import { isMealOrderInvoiceAvailable } from '@/lib/meal-order-invoice-download';
import { MealRefundReviewListBanner } from '@/components/customer/meal-plans/MealRefundReviewListBanner';
import { MarketplaceHistoryCard } from '@/components/customer/marketplace/MarketplaceHistoryCard';
import { Download } from 'lucide-react';

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
  const chipTone = mealOrderStatusChipTone(order);
  const statusTone =
    chipTone === 'green'
      ? 'success'
      : chipTone === 'red'
        ? 'danger'
        : chipTone === 'amber' || chipTone === 'orange'
          ? 'warning'
          : 'default';

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
    <MarketplaceHistoryCard
      item={{
        domain: 'meal',
        id: order.id,
        displayId: order.order_number ? `#${order.order_number}` : undefined,
        title: order.meal_plan_name || 'Meal Plan',
        statusLabel: mealOrderStatusChipLabel(order),
        statusTone,
        imageUrl: order.meal_plan_image_url,
        imageFallback: '🍽️',
        paidAmount: Number(order.total_amount) || 0,
        dateLabel: formatMealOrderDeliveryDate(order.delivery_date),
        timeLabel: formatMealOrderDeliveryTime(order.delivery_time),
        subtitle: petLine || undefined,
      }}
      actions={
        primaryAction || secondaryAction ? (
          <>
            {primaryAction}
            {secondaryAction}
          </>
        ) : undefined
      }
    >
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
    </MarketplaceHistoryCard>
  );
}
