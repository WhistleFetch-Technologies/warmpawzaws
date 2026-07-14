'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  Copy,
  Mail,
  MessageCircle,
  Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import {
  readCheckoutOrderResponse,
  clearCheckoutOrderResponse,
  type StoredCheckoutOrderResponse,
} from '@/lib/ecommerce/checkout-order-storage';
import { getShippingOptionLabel } from '@/lib/ecommerce/checkout-shipping-options';
import { ECOMMERCE_PAGE_SHELL } from '@/lib/ecommerce/ecommerce-page-shell';
import { navigateToProfileShopOrders } from '@/lib/go-back-or-replace';
import { registerCheckoutSuccessBackHandler } from '@/lib/navigation/back-handler-registry';
import { useCustomerNavigation } from '@/lib/navigation/use-customer-navigation';
import { toast } from 'sonner';

import { MarketplaceTimeline } from '@/components/customer/marketplace/MarketplaceTimeline';
import { MarketplaceConfirmation } from '@/components/customer/marketplace/MarketplaceConfirmation';

function statusIndex(status: string | undefined): number {
  const s = (status || 'confirmed').toLowerCase();
  if (['delivered', 'completed'].some((x) => s.includes(x))) return 3;
  if (['shipped', 'out_for_delivery', 'in_transit', 'dispatched'].some((x) => s.includes(x)))
    return 2;
  if (['packed', 'processing', 'confirmed'].some((x) => s.includes(x))) return 1;
  return 0;
}

export function EcommerceOrderSuccessScreen() {
  const nav = useCustomerNavigation();
  const router = useRouter();
  const [order, setOrder] = useState<StoredCheckoutOrderResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [timelineStatus, setTimelineStatus] = useState<string>('confirmed');

  const leaveSuccessToShop = useCallback(() => {
    clearCheckoutOrderResponse();
    nav.goToShop({ replace: true });
  }, [nav]);

  useEffect(() => {
    return registerCheckoutSuccessBackHandler(leaveSuccessToShop);
  }, [leaveSuccessToShop]);

  useEffect(() => {
    const stored = readCheckoutOrderResponse();
    if (!stored?.orderId) {
      nav.goToShop({ replace: true });
      return;
    }
    setOrder(stored);
    setTimelineStatus(stored.status || 'confirmed');

    // Optional background refresh — does not block render
    apiClient
      .get<{ order?: { status?: string; orderNumber?: string } }>(
        `/orders/${stored.orderId}/tracking`
      )
      .then((res) => {
        if (res?.order?.status) {
          setTimelineStatus(res.order.status);
          setOrder((prev) =>
            prev
              ? {
                  ...prev,
                  status: res.order?.status,
                  orderNumber: res.order?.orderNumber ?? prev.orderNumber,
                }
              : prev
          );
        }
      })
      .catch(() => {
        /* use stored snapshot */
      });
  }, [nav]);

  const copyOrderId = async () => {
    if (!order?.orderId) return;
    try {
      await navigator.clipboard.writeText(order.orderNumber || order.orderId);
      setCopied(true);
      toast.success('Order ID copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy');
    }
  };

  const activeStep = statusIndex(timelineStatus);

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F4F7]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-t-[#FF8C42]" />
      </div>
    );
  }

  const displayId = order.orderNumber || order.orderId;

  const goToProfileOrders = (expandCurrent = true) => {
    clearCheckoutOrderResponse();
    navigateToProfileShopOrders(router, expandCurrent ? order.orderId : undefined);
  };

  const timelineSteps = [
    { id: 'confirmed', label: 'Order confirmed', completed: activeStep >= 0, current: activeStep === 0 },
    { id: 'packed', label: 'Being packed', completed: activeStep >= 1, current: activeStep === 1 },
    { id: 'shipped', label: 'Shipped', completed: activeStep >= 2, current: activeStep === 2 },
    { id: 'delivered', label: 'Delivered', completed: activeStep >= 3, current: activeStep === 3 },
  ];

  return (
    <div className={`${ECOMMERCE_PAGE_SHELL} pb-8`}>
      <MarketplaceConfirmation
        data={{
          domain: 'product',
          orderNumber: String(displayId),
          title: 'Order placed!',
          paidAmount: order.totalAmount ?? 0,
          summaryLines: order.shippingAddress
            ? [
                {
                  label: 'Delivery to',
                  value: `${order.shippingAddress.city ?? ''} ${order.shippingAddress.pincode ?? ''}`.trim(),
                },
              ]
            : undefined,
        }}
        actions={[
          {
            id: 'track',
            label: 'Track order',
            onClick: () => {
              clearCheckoutOrderResponse();
              nav.afterCheckoutSuccess(order.orderId);
            },
          },
          {
            id: 'orders',
            label: 'View my orders',
            variant: 'outline',
            onClick: () => goToProfileOrders(true),
          },
          {
            id: 'shop',
            label: 'Continue shopping',
            variant: 'outline',
            onClick: leaveSuccessToShop,
          },
          {
            id: 'home',
            label: 'Back to home',
            variant: 'outline',
            onClick: () => {
              clearCheckoutOrderResponse();
              nav.goToHome();
            },
          },
        ]}
      >
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-xs font-medium text-slate-500 uppercase">Order ID</p>
            <button
              type="button"
              onClick={() => void copyOrderId()}
              className="shrink-0 flex items-center gap-1 text-sm font-medium text-[#FF8C42]"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              Copy
            </button>
          </div>
          <p className="font-mono font-semibold text-slate-900">{displayId}</p>
        </div>

        {order.shippingAddress && (
          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900 mb-1">Delivery to</p>
            <p>
              {order.shippingAddress.fullName || order.shippingAddress.name}
              <br />
              {order.shippingAddress.addressLine1 || order.shippingAddress.street},{' '}
              {order.shippingAddress.city} {order.shippingAddress.pincode}
            </p>
            {order.shippingMethod && (
              <p className="mt-2 text-slate-500">{getShippingOptionLabel(order.shippingMethod)}</p>
            )}
          </div>
        )}

        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
          <p className="font-semibold text-slate-900 mb-3">What&apos;s next</p>
          <MarketplaceTimeline steps={timelineSteps} />
        </div>

        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
          <p className="font-semibold text-slate-900 mb-3">Need help?</p>
          <div className="flex flex-wrap gap-2">
            <a
              href="mailto:support@warmpawz.com"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#FF8C42] px-3 py-2 rounded-lg bg-orange-50"
            >
              <Mail className="w-4 h-4" />
              Email
            </a>
            <a
              href="tel:+919876543210"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#FF8C42] px-3 py-2 rounded-lg bg-orange-50"
            >
              <Phone className="w-4 h-4" />
              Call
            </a>
            <span className="inline-flex items-center gap-1.5 text-sm text-slate-400 px-3 py-2 rounded-lg bg-slate-50">
              <MessageCircle className="w-4 h-4" />
              Chat — coming soon
            </span>
          </div>
        </div>
      </MarketplaceConfirmation>
    </div>
  );
}
