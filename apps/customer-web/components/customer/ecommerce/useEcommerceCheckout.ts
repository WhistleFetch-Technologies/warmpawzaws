'use client';

import { useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import {
  buildSanitizedStandardRazorpayCheckoutOptions,
  fetchCheckoutEmailForPrefill,
} from '@/lib/razorpay/build-standard-checkout-options';
import {
  computeCartPricing,
  clearPricingOptionsForCheckout,
  readPricingOptionsForCheckout,
  type CartPricingBreakdown,
} from '@/lib/ecommerce/cart-pricing';
import { clearWarmpawzCartStorage } from '@/lib/warmpawz-cart-storage';
import {
  buildRazorpayEcommerceCreateOrderPayload,
  extractEcommerceOrderIdFromResponse,
} from '@/lib/ecommerce/ecommerce-razorpay-payload';
import { extractHttpErrorMessage } from '@/lib/api-client';
import type { CartItem } from '@/lib/tax-system/taxCalculatorUtils';

export type CheckoutAddress = {
  id?: string;
  name?: string;
  fullName?: string;
  phone?: string;
  street?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  isDefault?: boolean;
};

function normalizeShippingAddress(addr: CheckoutAddress) {
  return {
    name: addr.fullName || addr.name || 'Customer',
    line1: addr.addressLine1 || addr.street || '',
    line2: addr.addressLine2 || '',
    city: addr.city || '',
    state: addr.state || '',
    pincode: addr.pincode || '',
    phone: addr.phone || '',
  };
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('No document'));
      return;
    }
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.body.appendChild(script);
  });
}

export function buildEcommerceOrderPayload(
  phone: string,
  cart: CartItem[],
  pricing: CartPricingBreakdown,
  shippingAddress: CheckoutAddress
) {
  const customerId = getResolvedCustomerId();
  const persisted = readPricingOptionsForCheckout();
  const promo = persisted.sellerPromotion;
  const cgst = pricing.taxResult.byType.find((t) => t.taxType === 'cgst')?.totalAmount ?? 0;
  const sgst = pricing.taxResult.byType.find((t) => t.taxType === 'sgst')?.totalAmount ?? 0;
  const igst = pricing.taxResult.byType.find((t) => t.taxType === 'igst')?.totalAmount ?? 0;
  const couponCode =
    promo?.code ||
    persisted.appliedCoupons?.[0]?.code ||
    undefined;

  return {
    customerId,
    customerPhone: phone,
    items: cart.map((item) => ({
      productId: item.id,
      quantity: item.quantity,
      unitPrice: item.price,
      vendorId: item.vendorId || '',
    })),
    shippingAddress: normalizeShippingAddress(shippingAddress),
    paymentMethod: 'online' as const,
    subtotal: pricing.lineSubtotal,
    shippingFee: pricing.deliveryFees,
    taxAmount: pricing.taxAmount,
    taxBreakdown: pricing.taxResult.breakdown,
    cgstAmount: cgst,
    sgstAmount: sgst,
    igstAmount: igst,
    discountAmount: pricing.discount,
    totalAmount: pricing.total,
    couponCode,
    promotionId: promo?.promotionId,
  };
}

export function useEcommerceCheckout() {
  const getPricing = useCallback((cart: CartItem[]) => {
    const persisted = readPricingOptionsForCheckout();
    return computeCartPricing(cart, {
      ...persisted,
      itemCount: cart.reduce((s, i) => s + i.quantity, 0),
    });
  }, []);

  const placeOrder = useCallback(
    async ({
      phone,
      cart,
      pricing,
      shippingAddress,
      onSuccess,
      onProcessingChange,
      clearCart,
    }: {
      phone: string;
      cart: CartItem[];
      pricing: CartPricingBreakdown;
      shippingAddress: CheckoutAddress;
      onSuccess: (orderId: string) => void;
      onProcessingChange?: (processing: boolean) => void;
      clearCart?: () => void;
    }) => {
      onProcessingChange?.(true);
      const orderData = buildEcommerceOrderPayload(phone, cart, pricing, shippingAddress);

      try {
        const result = await apiClient.post<{ order?: { id: string } }>(
          '/ecommerce/orders',
          orderData
        );
        const payAmount = pricing.total;
        const razorpayPayload = buildRazorpayEcommerceCreateOrderPayload(
          extractEcommerceOrderIdFromResponse(result) || '',
          payAmount,
          getResolvedCustomerId()
        );
        const shopOrderId = razorpayPayload.orderId;
        const razorpayOrder = await apiClient.post<{
          orderId: string;
          keyId: string;
          amount: number;
          currency: string;
        }>('/razorpay/create-order', razorpayPayload);

        if (!razorpayOrder?.orderId) {
          throw new Error('Failed to create payment order');
        }

        if (!(typeof window !== 'undefined' && (window as unknown as { Razorpay?: unknown }).Razorpay)) {
          await loadRazorpayScript();
        }

        const checkoutEmail = await fetchCheckoutEmailForPrefill(phone);
        const normalized = normalizeShippingAddress(shippingAddress);

        await new Promise<void>((resolve, reject) => {
          const options = buildSanitizedStandardRazorpayCheckoutOptions({
            key: razorpayOrder.keyId,
            amountPaise: Math.max(1, Math.round(Number(razorpayOrder.amount) * 100)),
            currency: razorpayOrder.currency || 'INR',
            name: 'Warmpawz',
            description: 'Order Payment',
            order_id: razorpayOrder.orderId,
            customerPhone: shippingAddress.phone || phone,
            customerEmail: checkoutEmail,
            prefillName: normalized.name,
            includeInstrumentBlocks: true,
            handler: async (response: {
              razorpay_order_id: string;
              razorpay_payment_id: string;
              razorpay_signature: string;
            }) => {
              try {
                await apiClient.post('/razorpay/verify-payment', {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                });
                // Navigate before clearing cart — otherwise checkout re-renders empty on ?step=review
                onSuccess(shopOrderId);
                resolve();
                queueMicrotask(() => {
                  clearWarmpawzCartStorage();
                  clearPricingOptionsForCheckout();
                  clearCart?.();
                });
              } catch (err) {
                reject(err);
              }
            },
            theme: { color: '#FF8C42' },
            modal: {
              ondismiss: () => {
                onProcessingChange?.(false);
                reject(new Error('Payment cancelled'));
              },
            },
          });

          const RazorpayCtor = (window as unknown as { Razorpay: new (o: unknown) => { open: () => void } })
            .Razorpay;
          if (!RazorpayCtor) {
            reject(new Error('Razorpay not available'));
            return;
          }
          const razorpay = new RazorpayCtor(options);
          razorpay.open();
        });
      } catch (err: unknown) {
        const apiErr = err as { responseData?: unknown; status?: number };
        const message =
          apiErr?.responseData != null
            ? extractHttpErrorMessage(apiErr.responseData, apiErr.status ?? 400)
            : err instanceof Error
              ? err.message
              : 'Payment failed';
        throw new Error(message);
      } finally {
        onProcessingChange?.(false);
      }
    },
    []
  );

  return { getPricing, placeOrder, buildEcommerceOrderPayload };
}
