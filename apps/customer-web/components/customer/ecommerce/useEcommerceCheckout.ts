'use client';

import { useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import { parseCartLineKey } from '@/lib/product-sku-client';
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
import {
  deliveryBlockMessage,
  deliveryRegionsFromCartItem,
  findUndeliverableCartItems,
} from '@/lib/ecommerce/product-delivery-guard';

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
  shippingAddress: CheckoutAddress,
  /** Per-checkout UUID to prevent double-tap duplicate orders (idempotency). */
  idempotencyKey?: string,
  /** Wallet points amount (in ₹) applied at checkout. */
  walletAmountApplied?: number
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
    idempotencyKey,
    items: cart.map((item) => {
      const parsed = parseCartLineKey(item.id);
      const productId = parsed.productId;
      const productSkuId =
        item.warmpawzLine?.product_sku_id ?? parsed.productSkuId ?? undefined;
      return {
        product_id: productId,
        productId: productId,
        product_sku_id: productSkuId,
        quantity: item.quantity,
        unitPrice: item.price,
        vendorId: item.vendorId || '',
        selected_variations: item.selectedVariations,
        selectedVariations: item.selectedVariations,
      };
    }),
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
    walletAmountApplied: walletAmountApplied ?? 0,
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
      walletAmountApplied,
    }: {
      phone: string;
      cart: CartItem[];
      pricing: CartPricingBreakdown;
      shippingAddress: CheckoutAddress;
      onSuccess: (orderId: string) => void;
      onProcessingChange?: (processing: boolean) => void;
      clearCart?: () => void;
      walletAmountApplied?: number;
    }) => {
      onProcessingChange?.(true);
      const undeliverable = findUndeliverableCartItems(
        cart as Parameters<typeof findUndeliverableCartItems>[0],
        shippingAddress.city,
      );
      if (undeliverable.length > 0) {
        const first = undeliverable[0];
        onProcessingChange?.(false);
        throw new Error(
          deliveryBlockMessage(
            first.name,
            shippingAddress.city ?? '',
            deliveryRegionsFromCartItem(first),
          ),
        );
      }

      // Generate a per-attempt idempotency key so a double-tap or network retry does not
      // create two orders. The backend deduplicates on this key for 30 minutes.
      const checkoutIdempotencyKey = crypto.randomUUID();
      const effectiveWallet = Math.max(0, walletAmountApplied ?? 0);
      const orderData = buildEcommerceOrderPayload(phone, cart, pricing, shippingAddress, checkoutIdempotencyKey, effectiveWallet);

      try {
        const result = await apiClient.post<{ order?: { id: string } }>(
          '/ecommerce/orders',
          orderData
        );

        // RETRY PATH: If POST /razorpay/create-order fails below (e.g. network error or timeout),
        // do NOT call POST /ecommerce/orders again — the order already exists in the DB.
        // Instead, call POST /razorpay/create-order again with the same orderId from `result`.
        // The backend reads orders.total_amount from the DB and creates a fresh Razorpay order.
        // This prevents double-order creation on transient failures between order creation and payment.
        const payAmount = Math.max(0, pricing.total - effectiveWallet);
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
          fullyCoveredByWallet?: boolean;
        }>('/razorpay/create-order', razorpayPayload);

        // Wallet covered the full order — no Razorpay payment needed
        if (razorpayOrder?.fullyCoveredByWallet) {
          clearCart?.();
          onSuccess(shopOrderId);
          return;
        }

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
