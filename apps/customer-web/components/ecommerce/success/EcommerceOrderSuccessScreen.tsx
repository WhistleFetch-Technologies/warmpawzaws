'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  CheckCircle2,
  Copy,
  Home,
  Mail,
  MessageCircle,
  Package,
  Phone,
  ShoppingBag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import {
  readCheckoutOrderResponse,
  clearCheckoutOrderResponse,
  type StoredCheckoutOrderResponse,
} from '@/lib/ecommerce/checkout-order-storage';
import { getShippingOptionLabel } from '@/lib/ecommerce/checkout-shipping-options';
import { toast } from 'sonner';

const TIMELINE_STEPS = [
  { key: 'confirmed', label: 'Order confirmed' },
  { key: 'packed', label: 'Being packed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
];

function statusIndex(status: string | undefined): number {
  const s = (status || 'confirmed').toLowerCase();
  if (['delivered', 'completed'].some((x) => s.includes(x))) return 3;
  if (['shipped', 'out_for_delivery', 'in_transit', 'dispatched'].some((x) => s.includes(x)))
    return 2;
  if (['packed', 'processing', 'confirmed'].some((x) => s.includes(x))) return 1;
  return 0;
}

export function EcommerceOrderSuccessScreen() {
  const router = useRouter();
  const [order, setOrder] = useState<StoredCheckoutOrderResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [timelineStatus, setTimelineStatus] = useState<string>('confirmed');

  useEffect(() => {
    const stored = readCheckoutOrderResponse();
    if (!stored?.orderId) {
      router.replace('/shop');
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
  }, [router]);

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

  return (
    <div className="min-h-screen bg-[#F2F4F7] max-w-customer mx-auto w-full pb-10">
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white px-4 pt-10 pb-12 cw-header-safe-x text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-white/20 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-bold">Order placed!</h1>
        <p className="text-emerald-100 mt-1 text-sm">Thank you for shopping with Warmpawz</p>
      </div>

      <div className="px-4 -mt-6 space-y-4">
        <section className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Order ID</p>
          <div className="flex items-center justify-between gap-2 mt-1">
            <p className="font-mono font-semibold text-slate-900 truncate">{displayId}</p>
            <button
              type="button"
              onClick={() => void copyOrderId()}
              className="shrink-0 flex items-center gap-1 text-sm font-medium text-[#FF8C42]"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              Copy
            </button>
          </div>
          {order.totalAmount != null && (
            <p className="text-sm text-slate-600 mt-2">
              Total paid: <span className="font-semibold">₹{order.totalAmount.toFixed(0)}</span>
              {order.paymentMethod === 'cod' && (
                <span className="text-slate-500"> · Pay on delivery</span>
              )}
            </p>
          )}
        </section>

        {order.shippingAddress && (
          <section className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900 mb-1">Delivery to</p>
            <p>
              {order.shippingAddress.fullName || order.shippingAddress.name}
              <br />
              {order.shippingAddress.addressLine1 || order.shippingAddress.street},{' '}
              {order.shippingAddress.city} {order.shippingAddress.pincode}
            </p>
            {order.shippingMethod && (
              <p className="mt-2 text-slate-500">
                {getShippingOptionLabel(order.shippingMethod)}
              </p>
            )}
          </section>
        )}

        <section className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
          <p className="font-semibold text-slate-900 mb-4">What&apos;s next</p>
          <ol className="space-y-0">
            {TIMELINE_STEPS.map((step, index) => {
              const done = index <= activeStep;
              const current = index === activeStep;
              return (
                <li key={step.key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {done ? <Check className="w-4 h-4" /> : index + 1}
                    </div>
                    {index < TIMELINE_STEPS.length - 1 && (
                      <div
                        className={`w-0.5 flex-1 min-h-[1.5rem] my-1 ${
                          index < activeStep ? 'bg-emerald-400' : 'bg-slate-200'
                        }`}
                      />
                    )}
                  </div>
                  <div className={`pb-4 ${current ? 'font-medium text-slate-900' : 'text-slate-500'}`}>
                    {step.label}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="flex flex-col gap-2">
          <Button
            onClick={() => router.push(`/orders/${order.orderId}/tracking`)}
            className="w-full h-12 bg-[#FF8C42] hover:bg-[#FF7A29] text-white font-semibold rounded-xl"
          >
            <Package className="w-4 h-4 mr-2" />
            Track order
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              clearCheckoutOrderResponse();
              router.replace('/orders');
            }}
            className="w-full h-11 rounded-xl"
          >
            View my orders
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              clearCheckoutOrderResponse();
              router.replace('/shop');
            }}
            className="w-full h-11 rounded-xl"
          >
            <ShoppingBag className="w-4 h-4 mr-2" />
            Continue shopping
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              clearCheckoutOrderResponse();
              router.replace('/');
            }}
            className="w-full h-11 rounded-xl text-slate-600"
          >
            <Home className="w-4 h-4 mr-2" />
            Back to home
          </Button>
        </div>

        <section className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
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
        </section>
      </div>
    </div>
  );
}
