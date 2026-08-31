'use client';

import { useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import { parseCartLineKey } from '@/lib/product-sku-client';
import {
  computeCartPricing,
  clearPricingOptionsForCheckout,
  readPricingOptionsForCheckout,
  type CartPricingBreakdown,
} from '@/lib/ecommerce/cart-pricing';
import { clearWarmpawzCartStorage } from '@/lib/warmpawz-cart-storage';
import {
  extractEcommerceOrderIdFromResponse,
} from '@/lib/ecommerce/ecommerce-razorpay-payload';
import { extractHttpErrorMessage } from '@/lib/api-client';
import type { CartItem } from '@/lib/tax-system/taxCalculatorUtils';
import {
  deliveryBlockMessage,
  deliveryRegionsFromCartItem,
  findUndeliverableCartItems,
} from '@/lib/ecommerce/product-delivery-guard';
import {
  persistShopPendingOrderId,
  resumeShopOrderPayment,
} from '@/lib/ecommerce/resume-shop-order-payment';

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
  const hasPromotionDiscount = pricing.discount > 0;
  const promotionId = promo?.promotionId ?? persisted.sellerPromotion?.promotionId;
  const promotionSource =
    pricing.promotionSource ??
    promo?.source ??
    persisted.sellerPromotion?.source;

  return {
    customerId,
    customerPhone: phone,
    idempotencyKey,
    items: cart.map((item) => {
      const parsed = parseCartLineKey(item.id);
      const productId = parsed.productId;
      const productSkuId =
        item.warmpawzLine?.product_sku_id ?? parsed.productSkuId ?? undefined;
      const categoryId = item.categoryId || item.category;
      return {
        product_id: productId,
        productId: productId,
        product_sku_id: productSkuId,
        quantity: item.quantity,
        unitPrice: item.price,
        vendorId: item.vendorId || '',
        selected_variations: item.selectedVariations,
        selectedVariations: item.selectedVariations,
        ...(categoryId ? { categoryId, category: categoryId } : {}),
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
    promotionId: hasPromotionDiscount ? promotionId : undefined,
    // Explicit source so the backend validates strictly against ONE table (vendor_promotions
    // vs ecommerce_admin_promotions) instead of inferring — see Ecommerce Settlement Engine plan §3.
    promotionSource: hasPromotionDiscount ? promotionSource : undefined,
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
      onPaymentDismiss,
      onProcessingChange,
      clearCart,
      walletAmountApplied,
    }: {
      phone: string;
      cart: CartItem[];
      pricing: CartPricingBreakdown;
      shippingAddress: CheckoutAddress;
      onSuccess: (orderId: string) => void;
      onPaymentDismiss?: (orderId: string) => void;
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
        const shopOrderId = extractEcommerceOrderIdFromResponse(result) || '';
        if (!shopOrderId) {
          throw new Error('Order was not created');
        }

        persistShopPendingOrderId(shopOrderId);

        const normalized = normalizeShippingAddress(shippingAddress);
        const customerId = getResolvedCustomerId();
        if (!customerId) {
          throw new Error('Please sign in again to complete payment');
        }

        await resumeShopOrderPayment({
          orderId: shopOrderId,
          payableAmount: payAmount,
          customerId,
          phone: shippingAddress.phone || phone,
          prefillName: normalized.name,
          onSuccess: (paidOrderId) => {
            onSuccess(paidOrderId);
            queueMicrotask(() => {
              clearWarmpawzCartStorage();
              clearPricingOptionsForCheckout();
              clearCart?.();
            });
          },
          onDismiss: () => {
            onPaymentDismiss?.(shopOrderId);
          },
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
