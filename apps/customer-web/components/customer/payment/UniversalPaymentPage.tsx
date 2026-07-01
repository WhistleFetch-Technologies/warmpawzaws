'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CreditCard, Wallet, Tag, ChevronRight,
  CheckCircle2, Shield, X, Percent, Info, MapPin,
  Plus, Smartphone,
  Gift, Sparkles, AlertCircle, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { AddPaymentMethodModal } from './AddPaymentMethodModal';
import { formatPriceWithSymbol } from '@/lib/booking-display-utils';
import { PolicyAcceptanceModal } from '../PolicyAcceptanceModal';
import { apiClient, getApiBaseUrl } from '@/lib/api-client';
import { resolveGstDisplayRatePercent } from '@/lib/resolve-gst-display-rate';
import {
  flattenVendorServicesResponse,
  resolveVendorServiceIdForTax,
} from '@/lib/resolve-vendor-service-id-for-tax';
import { buildCheckoutPaymentSources } from '@/lib/payment-display-utils';
import type { PaymentSource } from '@/lib/payment-display-utils';
import { PaymentPageHeader } from './PaymentPageHeader';
import { PaymentProviderSection } from './PaymentProviderSection';
import { PaymentBookingSummarySection } from './PaymentBookingSummarySection';
import { paymentPageBgClass, paymentSecondaryCardClass } from './payment-page-styles';
import {
  digitsToRazorpayContactE164,
  RAZORPAY_PREFILL_EMAIL_FALLBACK,
  sanitizeRazorpayInstanceOptions,
  getWarmpawzRazorpayUpiDisplayConfig,
} from '@/lib/razorpay/razorpay-utils';
import { buildSanitizedStandardRazorpayCheckoutOptions } from '@/lib/razorpay/build-standard-checkout-options';
import { confirmMealSubscriptionPayment } from '@/lib/meal-subscriptions-api';
import { MealSubscriptionPaymentSummary, type MealSubscriptionSummaryLine } from './MealSubscriptionPaymentSummary';
import {
  isWarmpawzCustomerNativeWebView,
  waitForWarmpawzNativeRazorpayResult,
  WARMPAWZ_RAZORPAY_NATIVE_MSG,
} from '@/lib/razorpay/native-webview-bridge';
import {
  buildRazorpayEcommerceCreateOrderPayload,
  extractEcommerceOrderIdFromResponse,
} from '@/lib/ecommerce/ecommerce-razorpay-payload';

// Razorpay type declaration
declare global {
  interface Window {
    Razorpay: any;
  }
}

interface UniversalPaymentPageProps {
  // Booking/Order details
  bookingId?: string;
  orderId?: string;
  type: 'booking' | 'order' | 'meal_subscription' | 'meal_one_time';

  /** Canonical meal subscription id (pending_payment) when type === 'meal_subscription'. */
  mealSubscriptionId?: string;
  /** Extra lines under plan title (sessions, cadence, first delivery, etc.). */
  mealSubscriptionSummaryLines?: MealSubscriptionSummaryLine[];
  /** Taxable food subtotal (pre-GST) for meal subscription pay — CGST/SGST/IGST on this line only. */
  mealPlanFoodTaxableInr?: number;
  /** `service_categories.id` UUID for meal_plan_food GST row (from pricing snapshot / order-preview). */
  mealPlanGstCatalogCategoryId?: string;
  /** Non-food fees included in subscription upfront (platform, convenience, delivery). */
  mealSubscriptionFeeTotals?: {
    platformFee: number;
    convenienceFee: number;
    deliveryFee: number;
  };
  /** When `/tax/calculate` fails, use GST % from subscription pricing_snapshot (same source as signup preview). */
  mealSubscriptionGstFallbackPct?: { food: number; delivery: number };

  /** One-time meal checkout: create order + Razorpay after universal pay (same UX as subscription pay). */
  mealOneTimeDraft?: {
    /** When set, skip POST /meal/orders/create and pay an existing pending order. */
    existingOrderId?: string;
    mealPlanId: string;
    customerId?: string;
    customerPhone: string;
    vendorId: string;
    quantity: number;
    petId?: string;
    specialInstructions?: string;
    deliveryAddress: Record<string, unknown>;
    scheduledDeliveryDate: string;
    scheduledDeliverySlot: { start: string; end: string };
    logisticsType?: string;
    foodSubtotalInr: number;
    foodGstPct: number;
    deliveryGstPct?: number;
    mealPlanGstCatalogCategoryId?: string;
    deliveryFeeInr: number;
    platformFeeInr: number;
    convenienceFeeInr: number;
  };
  serviceId?: string;
  productId?: string;
  serviceName?: string;
  productName?: string;
  serviceDescription?: string;
  serviceStyle?: 'at_home' | 'at_center' | 'at_vendor' | 'tele' | 'ecom' | 'hybrid' | 'product';
  category?: string; // For promotions/spotlights

  // Vendor/Seller
  vendorId: string;
  vendorName: string;
  vendorAddress?: string; // âœ… NEW: Vendor/clinic address for at_center services
  staffName?: string; // âœ… NEW: Staff name for at_home services
  staffPhoto?: string; // âœ… NEW: Staff photo for at_home services
  vendorTagline?: string;
  vendorIsVerified?: boolean;
  includedSummary?: string;
  includedItems?: string[];

  // Schedule (for bookings)
  bookingDate?: string;
  bookingTime?: string;

  // Pet (for bookings) — selected earlier in booking flow; passed through to payloads
  petId?: string;
  petName?: string;
  petBreed?: string;

  // Address (for home services/orders)
  addressId?: string;
  address?: {
    id?: string;
    label?: string;
    addressLine1?: string;
    city?: string;
    pincode?: string;
    state?: string;
  };
  showAddressSelection?: boolean; // Show address selector on top

  // Pricing
  baseAmount: number;
  /** When true, baseAmount is tax-inclusive (service_catalog.metadata.show_final_price_inclusive_tax). */
  priceIncludesTax?: boolean;
  duration?: number;
  quantity?: number;
  selectedServices?: any[]; // âœ… NEW: Selected services for multi-service bookings

  // Customer
  customerPhone: string;
  /**
   * Used for Razorpay `prefill.email` together with E.164 `prefill.contact` from {@link digitsToRazorpayContactE164}.
   * Desktop checkout may still default to UPI QR per Razorpay/NPCI; email + E.164 contact is best-effort for collect/VPA where supported.
   */
  customerEmail?: string;
  customerId?: string;

  /** 
   * tele-scheduled: normal scheduled tele booking
   * tele-instant: payment-first, then create booking via instant-after-payment (no queue)
   * tele-queue-accepted: queue-first flow; booking already exists with pending_payment; just collect payment and confirm
   */
  flowType?: 'tele-scheduled' | 'tele-instant' | 'tele-queue-accepted' | 'payment-resume' | 'home-visit';
  initialPromotionId?: string;
  initialPromotionIntent?: {
    promotionId?: string;
    serviceCategory?: string;
    serviceStyle?: string;
    clickedAt?: number;
    source?: string;
  };

  /**
   * fullscreen: default; CTA hugs bottom (overlays, dedicated routes).
   * appShell: matches CustomerHomeWrapper + BottomNavigation â€” CTA sits above the tab bar.
   */
  layoutVariant?: 'fullscreen' | 'appShell';
  /**
   * When true (default), roots with `position:fixed` so payment escapes parent rounded
   * content shells (e.g. `rounded-t-[32px]` booking routers). Set false inside shop modal.
   */
  fillViewport?: boolean;

  // Navigation
  onBack: () => void;
  onSuccess: (
    bookingId: string,
    orderId?: string,
    otpCode?: string,
    meta?: {
      isInstantTele?: boolean;
      paymentSources?: PaymentSource[];
      totalPaid?: number;
    }
  ) => void;
  /** After user closes Razorpay without paying (or we attempt slot release). Use to refetch `available-slots` so UI matches DB. */
  onPaymentAbandoned?: () => void;
}

interface CouponResult {
  valid: boolean;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  discountAmount: number;
  message?: string;
  minAmount?: number;
  maxDiscount?: number;
}

interface WalletInfo {
  balance: number;
  currency: string;
  loyaltyPoints?: number;
  rewardsBalance?: number;
}

interface SavedPaymentMethod {
  id: string;
  type: 'card' | 'upi' | 'netbanking' | 'wallet';
  last4?: string;
  brand?: string;
  upiId?: string;
  bankName?: string;
  isDefault: boolean;
  expiryMonth?: number;
  expiryYear?: number;
}

interface TaxBreakdown {
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  total: number;
  taxRate: number;
  isInterState: boolean;
  taxDetails?: {
    type: string;
    rate: number;
    amount: number;
  }[];
}

interface PlatformFees {
  platformFee: number;
  convenienceFee: number;
  deliveryFee: number;
  packagingFee: number;
  total: number;
}

interface PromotionOffer {
  id: string;
  type: 'spotlight' | 'category_discount' | 'service_discount' | 'flash_sale' | 'coupon';
  title: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  discountAmount: number;
  minAmount?: number;
  maxDiscount?: number;
  applicable: boolean;
}

interface RazorpayOffer {
  id: string;
  title: string;
  description: string;
  discountType: 'cashback' | 'discount';
  discountValue: number;
  applicable: boolean;
  paymentMethod?: string; // 'card', 'upi', etc.
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** POST /tax/calculate used to return success:true with empty items + error â€” treat as failure so UI does not show 9%+9% with ₹0 tax. */
function taxCalculateResponseHasPayload(res: any): boolean {
  if (!res || res.success !== true) return false;
  const err = res.error;
  if (typeof err === 'string' && err.trim()) return false;
  if (err != null && typeof err === 'object') return false;
  return Array.isArray(res.items) && res.items.length > 0;
}

/**
 * Forensic: extract booking ID from any create-booking response shape.
 * Handles wrapped ({ success, data: { bookingId } }), idempotency ({ bookingId }), double-wrapped, and snake_case.
 */
function extractBookingIdFromResponse(bookingRes: any, logLabel: string): string | undefined {
  if (!bookingRes || typeof bookingRes !== 'object') return undefined;

  const paths: (string | undefined)[] = [
    bookingRes?.data?.bookingId,
    bookingRes?.data?.booking_id,
    bookingRes?.data?.data?.bookingId,
    bookingRes?.data?.data?.booking_id,
    bookingRes?.data?.booking?.id,
    (bookingRes?.data ?? bookingRes)?.bookingId,
    (bookingRes?.data ?? bookingRes)?.booking_id,
    (bookingRes?.data ?? bookingRes)?.id,
    bookingRes?.bookingId,
    bookingRes?.booking_id,
    bookingRes?.id,
  ];

  for (const v of paths) {
    if (typeof v === 'string' && v.trim() && UUID_REGEX.test(v.trim())) return v.trim();
  }

  // Deep search: any nested object with key 'bookingId' or 'booking_id' and UUID value
  function findInObj(obj: any): string | undefined {
    if (!obj || typeof obj !== 'object') return undefined;
    for (const k of ['bookingId', 'booking_id']) {
      const val = obj[k];
      if (typeof val === 'string' && UUID_REGEX.test(val.trim())) return val.trim();
    }
    for (const key of Object.keys(obj)) {
      const found = findInObj(obj[key]);
      if (found) return found;
    }
    return undefined;
  }
  const deep = findInObj(bookingRes);
  if (deep) return deep;

  // Fallback: API Gateway may strip bookingId but keep data.message; backend embeds " | bookingId:uuid" in message
  const messageStr = bookingRes?.data?.message ?? bookingRes?.message;
  if (typeof messageStr === 'string') {
    const uuidInMessage = messageStr.match(/\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i);
    if (uuidInMessage && UUID_REGEX.test(uuidInMessage[1])) return uuidInMessage[1].trim();
  }

  // Forensic log when nothing found
  const topKeys = Object.keys(bookingRes);
  const dataKeys = bookingRes?.data && typeof bookingRes.data === 'object' ? Object.keys(bookingRes.data) : [];
  console.warn(`[FORENSIC] ${logLabel}: No bookingId in response. Top keys: [${topKeys.join(', ')}], data keys: [${dataKeys.join(', ')}], sample:`, JSON.stringify(bookingRes).slice(0, 400));
  return undefined;
}

export function UniversalPaymentPage({
  bookingId,
  orderId,
  type,
  mealSubscriptionId,
  mealSubscriptionSummaryLines,
  mealPlanFoodTaxableInr,
  mealPlanGstCatalogCategoryId,
  mealSubscriptionFeeTotals,
  mealSubscriptionGstFallbackPct,
  mealOneTimeDraft,
  serviceId,
  productId,
  serviceName,
  productName,
  serviceDescription,
  serviceStyle,
  category,
  vendorId,
  vendorName,
  vendorAddress,
  staffName,
  staffPhoto,
  vendorTagline,
  vendorIsVerified,
  includedSummary,
  includedItems,
  bookingDate,
  bookingTime,
  petId,
  petName,
  petBreed,
  addressId,
  address,
  showAddressSelection = false,
  baseAmount,
  priceIncludesTax = false,
  duration,
  quantity = 1,
  selectedServices,
  customerPhone,
  customerEmail,
  customerId,
  flowType,
  initialPromotionId,
  initialPromotionIntent,
  layoutVariant = 'fullscreen',
  fillViewport = true,
  onBack,
  onSuccess,
  onPaymentAbandoned,
}: UniversalPaymentPageProps) {
  const appShell = layoutVariant === 'appShell';

  // State
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [useWallet, setUseWallet] = useState(false);
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>('razorpay');
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any>(address);
  const [showAddressModal, setShowAddressModal] = useState(false);

  // âœ… CRITICAL: Resolved serviceId (UUID) - resolved early to avoid issues
  const [resolvedServiceId, setResolvedServiceId] = useState<string | undefined>(serviceId);
  const [serviceIdResolving, setServiceIdResolving] = useState(false);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponResult | null>(null);
  const [showCouponInput, setShowCouponInput] = useState(false);

  // Promotions & Offers
  const [promotions, setPromotions] = useState<PromotionOffer[]>([]);
  const [appliedPromotion, setAppliedPromotion] = useState<PromotionOffer | null>(null);
  const [bookingPromoStack, setBookingPromoStack] = useState<{
    vendorPromotionId?: string;
    platformPromotionId?: string;
    vendorDiscount?: number;
    platformDiscount?: number;
    totalSavings: number;
  } | null>(null);
  const [razorpayOffers, setRazorpayOffers] = useState<RazorpayOffer[]>([]);
  const [selectedRazorpayOffer, setSelectedRazorpayOffer] = useState<RazorpayOffer | null>(null);
  /** Optional UPI ID (VPA) for collect flow â€” passed as `prefill.vpa` (Razorpay may still show QR-only on desktop web per NPCI/Razorpay). */
  const [manualUpiVpa, setManualUpiVpa] = useState('');
  const [paymentPolicies, setPaymentPolicies] = useState<Record<string, { title: string; description: string; details?: string[] }> | null>(null);
  const [refundPolicySummary, setRefundPolicySummary] = useState<string | null>(null);

  const [taxBreakdown, setTaxBreakdown] = useState<TaxBreakdown>(() => {
    const meal = type === 'meal_subscription' || type === 'meal_one_time';
    return {
      subtotal: meal ? 0 : baseAmount,
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalTax: 0,
      total: meal ? 0 : baseAmount,
      taxRate: meal ? 0 : 18,
      isInterState: false,
    };
  });
  /** Meal payable uses `/tax/calculate` grand total + platform/convenience (delivery is inside GST lines). */
  const [mealTaxReady, setMealTaxReady] = useState(false);

  const [platformFees, setPlatformFees] = useState<PlatformFees>({
    platformFee: 0,
    convenienceFee: 0,
    deliveryFee: 0,
    packagingFee: 0,
    total: 0,
  });
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [subscriptionCovered, setSubscriptionCovered] = useState(false);
  const [activeSubscription, setActiveSubscription] = useState<any>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(false);

  const customerAddrStateForTax =
    (typeof selectedAddress?.state === 'string' && selectedAddress.state.trim()
      ? selectedAddress.state.trim()
      : undefined) ??
    (typeof address?.state === 'string' && address.state.trim() ? address.state.trim() : undefined);

  const applyDefaultGstBreakdown = useCallback(
    (ratePct: number) => {
      const lineTotal = baseAmount;
      const taxable = priceIncludesTax ? lineTotal / (1 + ratePct / 100) : lineTotal;
      const totalTax = (taxable * ratePct) / 100;
      setTaxBreakdown({
        subtotal: taxable,
        cgst: totalTax / 2,
        sgst: totalTax / 2,
        igst: 0,
        totalTax,
        total: taxable + totalTax,
        taxRate: ratePct,
        isInterState: false,
      });
    },
    [baseAmount, priceIncludesTax]
  );

  const runMealCheckoutTaxAndFees = useCallback(async () => {
    if (type !== 'meal_subscription' && type !== 'meal_one_time') return;

    setMealTaxReady(false);

    const addr =
      type === 'meal_one_time' && mealOneTimeDraft
        ? {
            state: String((mealOneTimeDraft.deliveryAddress as { state?: string })?.state || '').trim(),
            city: String((mealOneTimeDraft.deliveryAddress as { city?: string })?.city || '').trim(),
            pincode: String((mealOneTimeDraft.deliveryAddress as { pincode?: string })?.pincode || '').trim(),
          }
        : {
            state: String((selectedAddress || address)?.state || '').trim(),
            city: String((selectedAddress || address)?.city || '').trim(),
            pincode: String((selectedAddress || address)?.pincode || '').trim(),
          };

    const foodAmt =
      type === 'meal_one_time' && mealOneTimeDraft
        ? Number(mealOneTimeDraft.foodSubtotalInr)
        : Number(mealPlanFoodTaxableInr ?? 0);
    let catId =
      type === 'meal_one_time' && mealOneTimeDraft
        ? String(mealOneTimeDraft.mealPlanGstCatalogCategoryId || '').trim()
        : String(mealPlanGstCatalogCategoryId || '').trim();
    if (!catId) catId = 'nutritionist';

    const deliveryFeeForTax =
      type === 'meal_one_time' && mealOneTimeDraft
        ? Number(mealOneTimeDraft.deliveryFeeInr) || 0
        : type === 'meal_subscription' && mealSubscriptionFeeTotals
          ? Number(mealSubscriptionFeeTotals.deliveryFee) || 0
          : 0;

    if (type === 'meal_subscription' && mealSubscriptionFeeTotals) {
      const p = mealSubscriptionFeeTotals;
      const t =
        (Number(p.platformFee) || 0) +
        (Number(p.convenienceFee) || 0) +
        (Number(p.deliveryFee) || 0);
      setPlatformFees({
        platformFee: Number(p.platformFee) || 0,
        convenienceFee: Number(p.convenienceFee) || 0,
        deliveryFee: Number(p.deliveryFee) || 0,
        packagingFee: 0,
        total: Math.round(t * 100) / 100,
      });
    } else if (type === 'meal_one_time' && mealOneTimeDraft) {
      const d = mealOneTimeDraft;
      const t = d.platformFeeInr + d.convenienceFeeInr + d.deliveryFeeInr;
      setPlatformFees({
        platformFee: d.platformFeeInr,
        convenienceFee: d.convenienceFeeInr,
        deliveryFee: d.deliveryFeeInr,
        packagingFee: 0,
        total: Math.round(t * 100) / 100,
      });
    } else {
      setPlatformFees({ platformFee: 0, convenienceFee: 0, deliveryFee: 0, packagingFee: 0, total: 0 });
    }

    if (!(foodAmt > 0.009)) {
      setTaxBreakdown({
        subtotal: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalTax: 0,
        total: 0,
        taxRate: 0,
        isInterState: false,
      });
      setMealTaxReady(true);
      return;
    }

    try {
      const mealTaxItems: Record<string, unknown>[] = [
        {
          id: 'meal-plan-food',
          type: 'service',
          catalogCategoryId: catId,
          gstApplicationScope: 'meal_plan_food',
          amount: foodAmt,
          quantity: 1,
          category: 'nutrition',
        },
      ];
      if (deliveryFeeForTax > 0.009) {
        mealTaxItems.push({
          id: 'meal-plan-delivery',
          type: 'service',
          catalogCategoryId: catId,
          gstApplicationScope: 'meal_plan_delivery',
          amount: deliveryFeeForTax,
          quantity: 1,
          category: 'nutrition',
        });
      }

      const taxRes = await apiClient.post<any>('/tax/calculate', {
        items: mealTaxItems,
        vendorId,
        customerId,
        customerPhone,
        customerLocation:
          addr.state || addr.city || addr.pincode
            ? { state: addr.state || undefined, city: addr.city || undefined, pincode: addr.pincode || undefined }
            : undefined,
      });

      if (taxCalculateResponseHasPayload(taxRes)) {
        const cgst = taxRes.totalCGST || 0;
        const sgst = taxRes.totalSGST || 0;
        const igst = taxRes.totalIGST || 0;
        const totalTax = taxRes.totalTax ?? cgst + sgst + igst;
        const exclusiveSub = Number(taxRes.totalAmount);
        const taxableForLabel = Number.isFinite(exclusiveSub) ? exclusiveSub : foodAmt;
        const foodLine = Array.isArray(taxRes.items)
          ? taxRes.items.find(
              (it: { id?: string; itemId?: string }) =>
                it.id === 'meal-plan-food' || it.itemId === 'meal-plan-food',
            )
          : undefined;
        const rawRate = Number(
          (foodLine as { taxRate?: number; gstRate?: number } | undefined)?.taxRate ??
            (foodLine as { gstRate?: number } | undefined)?.gstRate ??
            taxRes.items?.[0]?.taxRate ??
            taxRes.items?.[0]?.gstRate,
        );
        const draftFoodPct =
          type === 'meal_one_time' && mealOneTimeDraft ? Number(mealOneTimeDraft.foodGstPct) : NaN;
        const subscriptionFoodPctDisplay =
          type === 'meal_subscription' && mealSubscriptionGstFallbackPct
            ? Number(mealSubscriptionGstFallbackPct.food)
            : NaN;
        const taxRate = Number.isFinite(rawRate)
          ? rawRate
          : Number.isFinite(draftFoodPct)
            ? Math.min(100, Math.max(0, draftFoodPct))
            : Number.isFinite(subscriptionFoodPctDisplay)
              ? Math.min(100, Math.max(0, subscriptionFoodPctDisplay))
              : 0;
        const interState =
          typeof taxRes.isInterState === 'boolean' ? taxRes.isInterState : igst > 0.009;
        const grand = Number(taxRes.grandTotal);
        const totalPay = Number.isFinite(grand) ? grand : taxableForLabel + totalTax;

        setTaxBreakdown({
          subtotal: taxableForLabel,
          cgst,
          sgst,
          igst,
          totalTax,
          total: totalPay,
          taxRate,
          isInterState: interState,
          taxDetails: taxRes.breakdown || [],
        });
        setMealTaxReady(true);
        return;
      }
    } catch (e) {
      console.error('Meal checkout tax error:', e);
    }

    const draftFoodPctCatch =
      type === 'meal_one_time' && mealOneTimeDraft ? Number(mealOneTimeDraft.foodGstPct) : NaN;
    const subscriptionFoodPct =
      type === 'meal_subscription' && mealSubscriptionGstFallbackPct
        ? Number(mealSubscriptionGstFallbackPct.food)
        : NaN;
    const fallbackRate = Number.isFinite(draftFoodPctCatch)
      ? Math.min(100, Math.max(0, draftFoodPctCatch))
      : Number.isFinite(subscriptionFoodPct)
        ? Math.min(100, Math.max(0, subscriptionFoodPct))
        : 0;
    const taxable = foodAmt;
    const totalTax = (taxable * fallbackRate) / 100;
    const deliveryPctFallback =
      type === 'meal_one_time' &&
      mealOneTimeDraft &&
      typeof mealOneTimeDraft.deliveryGstPct === 'number'
        ? mealOneTimeDraft.deliveryGstPct
        : type === 'meal_subscription' && mealSubscriptionGstFallbackPct
          ? Number(mealSubscriptionGstFallbackPct.delivery)
          : 0;
    const deliveryTax =
      deliveryFeeForTax > 0.009
        ? Math.round(((deliveryFeeForTax * deliveryPctFallback) / 100) * 100) / 100
        : 0;
    const combinedTax = Math.round((totalTax + deliveryTax) * 100) / 100;
    setTaxBreakdown({
      subtotal: taxable,
      cgst: combinedTax / 2,
      sgst: combinedTax / 2,
      igst: 0,
      totalTax: combinedTax,
      total: taxable + deliveryFeeForTax + combinedTax,
      taxRate: fallbackRate,
      isInterState: false,
    });
    setMealTaxReady(true);
  }, [
    type,
    mealOneTimeDraft,
    mealPlanFoodTaxableInr,
    mealPlanGstCatalogCategoryId,
    mealSubscriptionFeeTotals,
    mealSubscriptionGstFallbackPct,
    vendorId,
    customerId,
    customerPhone,
    selectedAddress,
    address,
  ]);

  const calculateTax = useCallback(async () => {
    const taxServiceId =
      resolvedServiceId || selectedServices?.[0]?.id || serviceId;
    const addr = selectedAddress || address;
    const hasAddrHint =
      addr &&
      (String(addr.state || '').trim() ||
        String(addr.city || '').trim() ||
        String(addr.pincode || '').trim());
    const customerLocation = hasAddrHint
      ? {
          state: String(addr!.state || '').trim() || undefined,
          city: addr!.city ? String(addr.city).trim() : undefined,
          pincode: addr!.pincode ? String(addr.pincode).trim() : undefined,
        }
      : undefined;

    try {
      const taxRes = await apiClient.post<any>('/tax/calculate', {
        items: [
          {
            id: taxServiceId || productId || bookingId || 'item',
            type: type === 'booking' ? 'service' : 'product',
            serviceId: type === 'booking' ? taxServiceId : undefined,
            bookingId: type === 'booking' ? bookingId : undefined,
            productId: type === 'order' ? productId : undefined,
            amount: baseAmount,
            quantity,
            category: category || undefined,
            serviceStyle,
            amountTaxInclusive: priceIncludesTax,
          },
        ],
        vendorId,
        customerId,
        customerPhone,
        customerLocation,
        bookingId: type === 'booking' ? bookingId : undefined,
      });

      if (taxCalculateResponseHasPayload(taxRes)) {
        const cgst = taxRes.totalCGST || 0;
        const sgst = taxRes.totalSGST || 0;
        const igst = taxRes.totalIGST || 0;
        const totalTax = taxRes.totalTax ?? cgst + sgst + igst;
        const exclusiveSub = Number(taxRes.totalAmount);
        const taxableForLabel = Number.isFinite(exclusiveSub) ? exclusiveSub : baseAmount;
        const rawRate = Number(taxRes.items?.[0]?.taxRate);
        const declaredRate = Number.isFinite(rawRate) ? rawRate : 18;
        const taxRate = resolveGstDisplayRatePercent(
          taxableForLabel,
          totalTax,
          declaredRate,
          18
        );
        const interState =
          typeof taxRes.isInterState === 'boolean' ? taxRes.isInterState : igst > 0;
        const grand = Number(taxRes.grandTotal);
        const totalPay = Number.isFinite(grand) ? grand : taxableForLabel + totalTax;

        setTaxBreakdown({
          subtotal: taxableForLabel,
          cgst,
          sgst,
          igst,
          totalTax,
          total: totalPay,
          taxRate,
          isInterState: interState,
          taxDetails: taxRes.breakdown || [],
        });
        return;
      }

      if (baseAmount > 0) {
        console.warn('Tax calculate returned no usable items; using default 18% split', taxRes);
        applyDefaultGstBreakdown(18);
      }
    } catch (error) {
      console.error('Tax calculation error, using default 18%:', error);
      if (baseAmount > 0) {
        applyDefaultGstBreakdown(18);
      }
    }
  }, [
    address,
    applyDefaultGstBreakdown,
    baseAmount,
    bookingId,
    category,
    customerId,
    customerPhone,
    productId,
    quantity,
    resolvedServiceId,
    selectedAddress,
    selectedServices,
    serviceId,
    serviceStyle,
    type,
    vendorId,
    priceIncludesTax,
  ]);

  useEffect(() => {
    loadPaymentData();
    if (!isWarmpawzCustomerNativeWebView()) {
      loadRazorpayScript();
    }
    if (type === 'meal_subscription' || type === 'meal_one_time') {
      void runMealCheckoutTaxAndFees();
      loadPaymentAndRefundPolicies();
      return;
    }
    calculateTax();
    loadPromotions();
    loadRazorpayOffers();
    loadPlatformFees();
    loadPaymentAndRefundPolicies();
  }, [
    bookingId,
    customerPhone,
    baseAmount,
    category,
    serviceStyle,
    type,
    vendorId,
    customerId,
    resolvedServiceId,
    serviceId,
    quantity,
    productId,
    customerAddrStateForTax,
    calculateTax,
    runMealCheckoutTaxAndFees,
    mealPlanFoodTaxableInr,
    mealPlanGstCatalogCategoryId,
    mealSubscriptionFeeTotals,
    mealSubscriptionGstFallbackPct,
    mealOneTimeDraft,
  ]);

  // Check if customer has active subscription that covers this booking
  useEffect(() => {
    const checkSubscriptionCoverage = async () => {
      if (type !== 'booking' || !customerId || !vendorId) {
        return;
      }

      setCheckingSubscription(true);

      try {
        const coverageRes = await apiClient.post<any>('/subscriptions/check-coverage', {
          customerId: customerId || customerPhone,
          vendorId,
          serviceId: resolvedServiceId || serviceId,
          serviceStyle,
          category,
        });

        if (coverageRes.success && coverageRes.covered) {
          console.log('âœ… [SUBSCRIPTION] Booking covered by subscription:', coverageRes.subscription);
          setSubscriptionCovered(true);
          setActiveSubscription(coverageRes.subscription);

          // If subscription covers this booking, set amount to 0
          // The payment will be processed as a subscription booking
        }
      } catch (error: any) {
        // Subscription check failed - proceed with normal payment; surface so it's not silent
        console.log('â„¹ï¸ [SUBSCRIPTION] No active subscription or check failed:', error.message);
        setSubscriptionCovered(false);
        setActiveSubscription(null);
        toast.info('Subscription check unavailable; you can pay normally.');
      } finally {
        setCheckingSubscription(false);
      }
    };

    checkSubscriptionCoverage();
  }, [type, customerId, vendorId, resolvedServiceId, serviceId, serviceStyle, category, customerPhone]);

  useEffect(() => {
    if (showAddressSelection) {
      loadAddresses();
    }
  }, [showAddressSelection, customerPhone]);

  //  Resolve serviceId early (before payment flow)
  useEffect(() => {
    const resolveServiceId = async () => {
      if (!serviceId || !vendorId || type !== 'booking') {
        return; // Only resolve for bookings with serviceId
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (selectedServices?.[0]?.id && uuidRegex.test(String(selectedServices[0].id))) {
        setResolvedServiceId(String(selectedServices[0].id));
        return;
      }

      console.log(`🔄 Resolving serviceId "${serviceId}" to vendor_services.id...`);
      setServiceIdResolving(true);

      try {
        let vendorServicesRes: any = null;
        const endpoints = [
          `/vendor/${vendorId}/services`,
          `/vendor/services/${vendorId}`,
          `/vendor-services?vendorId=${vendorId}`,
        ];

        for (const endpoint of endpoints) {
          try {
            vendorServicesRes = await apiClient.get<any>(endpoint);
            if (
              vendorServicesRes?.allServices ||
              vendorServicesRes?.services ||
              vendorServicesRes?.data?.services ||
              Array.isArray(vendorServicesRes)
            ) {
              break;
            }
          } catch {
            continue;
          }
        }

        if (vendorServicesRes) {
          const services = flattenVendorServicesResponse(vendorServicesRes);
          const resolved = resolveVendorServiceIdForTax(services, serviceId);
          if (resolved && uuidRegex.test(resolved)) {
            setResolvedServiceId(resolved);
            if (resolved !== serviceId) {
              console.log(`✅ Resolved serviceId "${serviceId}" → vendor_services.id "${resolved}"`);
            }
          } else if (uuidRegex.test(serviceId)) {
            setResolvedServiceId(serviceId);
          }
        } else if (uuidRegex.test(serviceId)) {
          setResolvedServiceId(serviceId);
        }
      } catch (error: any) {
        console.warn(`⚠️ Failed to resolve serviceId "${serviceId}":`, error.message);
        if (uuidRegex.test(serviceId)) {
          setResolvedServiceId(serviceId);
        }
      } finally {
        setServiceIdResolving(false);
      }
    };

    resolveServiceId();
  }, [serviceId, vendorId, type, selectedServices]);


  //  Pre-load Razorpay script on component mount so it's ready when user clicks payment
  useEffect(() => {
    if (isWarmpawzCustomerNativeWebView()) {
      return;
    }
    if (typeof window !== 'undefined' && !window.Razorpay) {
      console.log('ðŸ”„ [RAZORPAY] Pre-loading Razorpay script on component mount...');
      loadRazorpayScript().catch((error) => {
        console.warn('âš ï¸ [RAZORPAY] Failed to pre-load script (will retry on payment):', error.message);
        // Don't show error to user - will retry when payment button is clicked
      });
    } else if (window.Razorpay) {
      console.log('âœ… [RAZORPAY] Razorpay script already loaded');
    }
  }, []); // Only run once on mount

  //sse to fallback from the payment page if th evendor cancelled the call
  // In UniversalPaymentPage.tsx



  // 2. Add SSE listener useEffect (add after the subscription check useEffect, around line 363)
  useEffect(() => {
    // Only listen for vendor cancellation if this is an instant tele booking with a bookingId
    if (!bookingId || flowType !== 'tele-queue-accepted' || type !== 'booking') {
      return;
    }

    const apiBase = getApiBaseUrl();
    const sseUrl = `${apiBase}/customer/tele/instant-stream/${bookingId}`;

    console.log('[UniversalPaymentPage] ðŸ”Œ Setting up SSE to monitor vendor cancellation');

    const eventSource = new EventSource(sseUrl);

    // Listen for ended event (vendor cancels after accepting)
    eventSource.addEventListener('ended', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[UniversalPaymentPage] âŒ Booking ended/cancelled:', data);

        // Show error toast
        toast.error(data.message || 'This consultation has been cancelled. Please try another vet.');

        // Close SSE connection
        eventSource.close();

        // âœ… CRITICAL: Immediately rollback to previous page
        onBack();
      } catch (e) {
        console.error('[UniversalPaymentPage] Failed to parse ended event:', e);
        // Still rollback even if parsing fails
        eventSource.close();
        onBack();
      }
    });

    // Listen for vendor_rejected event (vendor cancels)
    eventSource.addEventListener('vendor_rejected', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[UniversalPaymentPage] âŒ Vendor rejected/cancelled:', data);

        toast.error(data.message || 'Vendor has cancelled this consultation. Please try another vet.');

        eventSource.close();
        onBack();
      } catch (e) {
        console.error('[UniversalPaymentPage] Failed to parse vendor_rejected event:', e);
        eventSource.close();
        onBack();
      }
    });

    // Listen for connection event (for debugging)
    eventSource.addEventListener('connection', (event: MessageEvent) => {
      console.log('[UniversalPaymentPage] ðŸ”Œ SSE connection established');
    });

    eventSource.onerror = (error) => {
      console.warn('[UniversalPaymentPage] SSE error:', error);
      // Don't close on error - let it reconnect
      // Only close if connection is actually closed
      if (eventSource.readyState === EventSource.CLOSED) {
        console.log('[UniversalPaymentPage] SSE connection closed');
      }
    };

    return () => {
      console.log('[UniversalPaymentPage] ðŸ§¹ Cleaning up SSE connection');
      eventSource.close();
    };
  }, [bookingId, flowType, type, onBack]);


  const loadRazorpayScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Window is not available'));
        return;
      }

      // If already loaded, resolve immediately
      if (window.Razorpay) {
        resolve();
        return;
      }

      // Check if script is already being loaded
      const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (existingScript) {
        // Wait for existing script to load
        existingScript.addEventListener('load', () => {
          if (window.Razorpay) {
            resolve();
          } else {
            reject(new Error('Razorpay script loaded but window.Razorpay is not available'));
          }
        });
        existingScript.addEventListener('error', () => {
          reject(new Error('Failed to load Razorpay script'));
        });
        return;
      }

      // Create and load new script
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;

      script.onload = () => {
        // Wait a bit for Razorpay to initialize
        setTimeout(() => {
          if (window.Razorpay) {
            resolve();
          } else {
            reject(new Error('Razorpay script loaded but window.Razorpay is not available'));
          }
        }, 100);
      };

      script.onerror = () => {
        reject(new Error('Failed to load Razorpay script'));
      };

      document.body.appendChild(script);
    });
  };

  const loadAddresses = async () => {
    try {
      const data = await apiClient.get<any>(`/customer/addresses?phone=${encodeURIComponent(customerPhone)}`);
      const addressList = data.addresses || [];
      setAddresses(addressList);

      if (address) {
        // Find matching address or use provided
        const matched = addressList.find((a: any) => a.id === address.id || a.id === addressId);
        setSelectedAddress(matched || address);
      } else {
        // Select default or first
        const defaultAddr = addressList.find((a: any) => a.isDefault) || addressList[0];
        setSelectedAddress(defaultAddr);
      }
    } catch (error) {
      console.error('Error loading addresses:', error);
    }
  };

  //wallet and payment methods
  const loadPaymentData = async () => {
    try {
      setLoading(true);

      // Load wallet balance
      try {
        const walletRes = await apiClient.get<any>(`/customer/wallet?phone=${encodeURIComponent(customerPhone)}`);
        if (walletRes.wallet) {
          setWallet(walletRes.wallet);
          const bal = Number(walletRes.wallet.balance ?? 0);
          if (type === 'booking' && Number.isFinite(bal) && bal > 0.009) {
            setUseWallet(true);
          }
          if (type === 'meal_subscription' && Number.isFinite(bal) && bal > 0.009) {
            setUseWallet(true);
          }
          if (type === 'meal_one_time' && Number.isFinite(bal) && bal > 0.009) {
            setUseWallet(true);
          }
        }
      } catch (e) {
        console.log('No wallet found');
      }

      // Load saved payment methods
      try {
        const methodsRes = await apiClient.get<any>(`/customer/payment-methods?phone=${encodeURIComponent(customerPhone)}`);
        if (methodsRes.methods) {
          setSavedMethods(methodsRes.methods);
          const defaultMethod = methodsRes.methods.find((m: SavedPaymentMethod) => m.isDefault);
          if (defaultMethod) {
            setSelectedMethod(defaultMethod.id);
          }
        }
      } catch (e) {
        console.log('No saved payment methods');
      }

    } catch (error) {
      console.error('Error loading payment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPromotions = async () => {
    try {
      const selectedServiceIds = (selectedServices || [])
        .map((s: any) => String(s?.serviceId || s?.service_id || s?.id || '').trim())
        .filter(Boolean);

      if (type === 'booking' && vendorId && baseAmount > 0) {
        const calcRes = await apiClient.post<any>('/promotions/calculate-booking', {
          vendorId,
          customerId: customerId || undefined,
          amount: baseAmount,
          serviceStyle,
          serviceCategory: category || initialPromotionIntent?.serviceCategory,
          serviceIds: selectedServiceIds.length
            ? selectedServiceIds
            : serviceId
              ? [String(serviceId)]
              : [],
        });

        if (calcRes?.success) {
          const stack = {
            vendorPromotionId: calcRes.vendorPromotionId,
            platformPromotionId: calcRes.platformPromotionId,
            vendorDiscount: calcRes.vendorDiscountAmount ?? 0,
            platformDiscount: calcRes.platformDiscountAmount ?? 0,
            totalSavings: calcRes.totalSavings ?? 0,
          };
          setBookingPromoStack(stack.totalSavings > 0 ? stack : null);

          const applicablePromos = (calcRes.applied || []).map((a: any) => ({
            id: a.id,
            type: a.source === 'platform' ? 'spotlight' : 'vendor',
            title: a.name,
            description: a.name,
            discountType: 'percentage' as const,
            discountValue: 0,
            discountAmount: a.discountAmount ?? 0,
            applicable: true,
          }));
          setPromotions(applicablePromos);

          if (stack.totalSavings > 0) {
            setAppliedPromotion({
              id: calcRes.vendorPromotionId || calcRes.platformPromotionId || 'auto',
              type: 'spotlight',
              title: 'Promotion applied',
              description: applicablePromos.map((p: PromotionOffer) => p.title).join(' + '),
              discountType: 'percentage',
              discountValue: 0,
              discountAmount: stack.totalSavings,
              applicable: true,
            });
            toast.success(`You save ₹${stack.totalSavings.toFixed(0)} on this booking`);
          } else if (initialPromotionId) {
            toast.info('The selected special offer is not eligible for this service/amount.');
          }
        }
        return;
      }

      const params = new URLSearchParams({
        category: String(category || initialPromotionIntent?.serviceCategory || ''),
        serviceStyle: String(serviceStyle || initialPromotionIntent?.serviceStyle || ''),
        amount: String(baseAmount || 0),
      });
      if (serviceId) params.set('serviceId', String(serviceId));
      if (vendorId) params.set('vendorId', String(vendorId));
      if (customerId) params.set('customerId', String(customerId));
      if (selectedServiceIds.length > 0) params.set('selectedServiceIds', selectedServiceIds.join(','));

      const promoRes = await apiClient.get<any>(`/promotions/applicable?${params.toString()}`);

      if (promoRes.success && promoRes.promotions) {
        const raw = promoRes.promotions as any[];
        const applicablePromos = raw
          .filter((p: any) => p != null)
          .map((p: any) => ({
            id: p.id,
            type: p.promotion_type || (p.code ? 'coupon' : 'spotlight'),
            title: p.title ?? p.name ?? p.code ?? 'Offer',
            description: p.description ?? '',
            discountType: p.discountType ?? p.discount_type,
            discountValue: p.discountValue ?? p.discount_value ?? 0,
            discountAmount: calculateDiscountAmount(
              p.discountType ?? p.discount_type,
              p.discountValue ?? p.discount_value,
              baseAmount,
              p.minOrderAmount ?? p.min_amount,
              p.maxDiscountAmount ?? p.max_discount
            ),
            minAmount: p.minOrderAmount ?? p.min_amount,
            maxDiscount: p.maxDiscountAmount ?? p.max_discount,
            applicable: true,
          }));

        setPromotions(applicablePromos);
        if (initialPromotionId) {
          const matched = applicablePromos.find((p: PromotionOffer) => p.id === initialPromotionId);
          if (matched && matched.applicable) {
            setAppliedPromotion(matched);
            toast.success('Special offer auto-applied to this payment.');
          } else {
            toast.info('The selected special offer is not eligible for this service/amount.');
          }
        } else {
          const spotlight = applicablePromos.find((p: PromotionOffer) => p.type === 'spotlight');
          if (spotlight && spotlight.applicable) {
            setAppliedPromotion(spotlight);
          }
        }
      }
    } catch (error) {
      console.error('Error loading promotions:', error);
    }
  };

  const loadRazorpayOffers = async () => {
    try {
      // Load Razorpay offers (card offers, cashback, etc.)
      const offersRes = await apiClient.get<any>(
        `/razorpay/offers?amount=${baseAmount}`
      );

      if (offersRes.success && offersRes.offers) {
        setRazorpayOffers(offersRes.offers);
      }
    } catch (error) {
      console.error('Error loading Razorpay offers:', error);
    }
  };

  const loadPlatformFees = async () => {
    try {
      const catParam = category != null && String(category).trim() !== '' ? `&category=${encodeURIComponent(String(category).trim())}` : '';
      const feesRes = await apiClient.get<any>(
        `/config/fees?amount=${baseAmount}&type=${type}&serviceStyle=${encodeURIComponent(serviceStyle || '')}${catParam}`
      );

      if (!feesRes?.success) {
        throw new Error((feesRes && feesRes.error) || 'Fee configuration unavailable');
      }

      let platformFee =
        typeof feesRes.platformFee === 'number' && Number.isFinite(feesRes.platformFee)
          ? feesRes.platformFee
          : NaN;
      let convenienceFee =
        typeof feesRes.convenienceFee === 'number' && Number.isFinite(feesRes.convenienceFee)
          ? feesRes.convenienceFee
          : NaN;
      let deliveryFee =
        typeof feesRes.deliveryFee === 'number' && Number.isFinite(feesRes.deliveryFee)
          ? feesRes.deliveryFee
          : NaN;
      let packagingFee =
        typeof feesRes.packagingFee === 'number' && Number.isFinite(feesRes.packagingFee)
          ? feesRes.packagingFee
          : NaN;

      const legacy = feesRes.fees && typeof feesRes.fees === 'object' ? feesRes.fees : null;
      if (legacy && !Number.isFinite(platformFee)) {
        const pct = parseFloat(String(legacy.platformFeePercentage));
        const flat = parseFloat(String(legacy.platformFeeFlat ?? 0));
        const max = parseFloat(String(legacy.maxPlatformFee ?? 500));
        if (Number.isFinite(pct) && baseAmount > 0) {
          let pf = Math.round((baseAmount * pct) / 100) + (Number.isFinite(flat) ? flat : 0);
          if (Number.isFinite(max) && max > 0 && pf > max) pf = max;
          platformFee = Math.max(0, pf);
        } else {
          platformFee = 0;
        }
      }
      if (!Number.isFinite(platformFee)) platformFee = 0;
      if (!Number.isFinite(convenienceFee)) convenienceFee = 0;
      if (legacy && type === 'order' && !Number.isFinite(convenienceFee) && legacy.convenienceFee != null) {
        const c = parseFloat(String(legacy.convenienceFee));
        if (Number.isFinite(c)) convenienceFee = Math.max(0, c);
      }
      if (!Number.isFinite(deliveryFee)) deliveryFee = 0;
      if (!Number.isFinite(packagingFee)) packagingFee = 0;

      if (type === 'booking') {
        convenienceFee = 0;
      }
      if (!(serviceStyle === 'at_home' || type === 'order')) {
        deliveryFee = 0;
      }
      if (type !== 'order') {
        packagingFee = 0;
      }

      console.log('[FEES] Loaded fee configuration:', {
        platformFee,
        convenienceFee,
        deliveryFee,
        packagingFee,
        breakdown: feesRes.breakdown,
      });

      setPlatformFees({
        platformFee,
        convenienceFee,
        deliveryFee,
        packagingFee,
        total: platformFee + convenienceFee + deliveryFee + packagingFee,
      });
    } catch (error) {
      console.error('Error loading platform fees:', error);
      // Resilience-only fallback when /config/fees fails; production should use backend as single source of truth
      if (baseAmount > 0) {
        let defaultPlatformFee = Math.round((baseAmount * 2) / 100);
        defaultPlatformFee = Math.min(defaultPlatformFee, 200);
        const defaultConvenienceFee = type === 'order' ? 9 : 0;
        setPlatformFees({
          platformFee: defaultPlatformFee,
          convenienceFee: defaultConvenienceFee,
          deliveryFee: 0,
          packagingFee: 0,
          total: defaultPlatformFee + defaultConvenienceFee,
        });
      }
    }
  };

  const loadPaymentAndRefundPolicies = async () => {
    try {
      const serviceType = type === 'booking' ? 'booking' : (category || 'default');
      const policiesRes = await apiClient.get<{ success?: boolean; policies?: Record<string, { title: string; description: string; details?: string[] }> }>(
        `/config/policies?service_type=${encodeURIComponent(serviceType)}&policies=payment,cancellation,refund`
      );
      if (policiesRes?.policies && typeof policiesRes.policies === 'object') {
        setPaymentPolicies(policiesRes.policies);
      }
    } catch (e) {
      console.warn('Could not load payment policies:', e);
    }
    try {
      const refundRes = await apiClient.get<{ success?: boolean; policy?: { refundPercentages?: Array<{ withinHours: number; percentage: number }>; cancellationWindowHours?: number } }>(
        `/customer/refund-policy?vendorId=${encodeURIComponent(vendorId || '')}&serviceId=${encodeURIComponent(serviceId || '')}`
      );
      if (refundRes?.policy?.refundPercentages?.length) {
        const parts = refundRes.policy.refundPercentages
          .filter((p: { withinHours: number; percentage: number }) => p.withinHours != null && p.percentage != null)
          .map((p: { withinHours: number; percentage: number }) => `${p.percentage}% refund if cancelled ${p.withinHours}h+ before`);
        setRefundPolicySummary(parts.length ? parts.join('; ') : null);
      }
    } catch (e) {
      console.warn('Could not load refund policy:', e);
    }
  };

  const calculateDiscountAmount = (
    type: 'percentage' | 'fixed',
    value: number,
    amount: number,
    minAmount?: number,
    maxDiscount?: number
  ): number => {
    if (minAmount && amount < minAmount) return 0;

    let discount = type === 'percentage'
      ? (amount * value) / 100
      : value;

    if (maxDiscount && discount > maxDiscount) {
      discount = maxDiscount;
    }

    return Math.min(discount, amount);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error('Please enter a coupon code');
      return;
    }

    setCouponLoading(true);
    try {
      // First try the unified promotion validation (includes vendor promotions)
      const promoRes = await apiClient.post<any>('/promotions/validate-code', {
        code: couponCode.toUpperCase(),
        vendorId: vendorId,
        orderAmount: type === 'order' ? taxBreakdown.total : undefined,
        bookingAmount: type === 'booking' ? taxBreakdown.total : undefined,
        orderType: type === 'booking' ? 'service' : 'product'
      });

      if (promoRes.valid) {
        const discountAmount = promoRes.discount_amount || calculateDiscountAmount(
          promoRes.promotion?.discount_type,
          promoRes.promotion?.discount_value,
          taxBreakdown.total,
          promoRes.promotion?.min_order_value || promoRes.promotion?.min_booking_value,
          promoRes.promotion?.max_discount_amount
        );

        setAppliedCoupon({
          valid: true,
          code: couponCode.toUpperCase(),
          discountType: promoRes.promotion?.discount_type || 'percentage',
          discountValue: promoRes.promotion?.discount_value || 0,
          discountAmount,
          message: promoRes.promotion?.description || `You save ₹${discountAmount}!`,
          minAmount: promoRes.promotion?.min_order_value || promoRes.promotion?.min_booking_value,
          maxDiscount: promoRes.promotion?.max_discount_amount,
        });
        toast.success(`Coupon applied! You save ₹${discountAmount.toFixed(2)}`);
        setShowCouponInput(false);
        return;
      }

      // Fallback to legacy coupon validation
      const res = await apiClient.get<any>(
        `/coupons/validate/${couponCode.toUpperCase()}?amount=${taxBreakdown.total}`
      );

      if (res.valid) {
        const discountAmount = calculateDiscountAmount(
          res.coupon.discount_type,
          res.coupon.discount_value,
          taxBreakdown.total,
          res.coupon.min_amount,
          res.coupon.max_discount
        );

        setAppliedCoupon({
          valid: true,
          code: couponCode.toUpperCase(),
          discountType: res.coupon.discount_type,
          discountValue: res.coupon.discount_value,
          discountAmount,
          message: res.message,
          minAmount: res.coupon.min_amount,
          maxDiscount: res.coupon.max_discount,
        });
        toast.success(`Coupon applied! You save ₹${discountAmount.toFixed(2)}`);
        setShowCouponInput(false);
      } else {
        toast.error(promoRes.message || res.error || 'Invalid coupon code');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to validate coupon');
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    toast.info('Coupon removed');
  };

  const applyPromotion = (promotion: PromotionOffer) => {
    if (appliedPromotion?.id === promotion.id) {
      setAppliedPromotion(null);
      toast.info('Promotion removed');
    } else {
      setAppliedPromotion(promotion);
      toast.success(`Promotion applied! You save ₹${promotion.discountAmount.toFixed(2)}`);
    }
  };

  const applyRazorpayOffer = (offer: RazorpayOffer) => {
    if (selectedRazorpayOffer?.id === offer.id) {
      setSelectedRazorpayOffer(null);
      toast.info('Offer removed');
    } else {
      setSelectedRazorpayOffer(offer);
      toast.success(`Offer selected! ${offer.description}`);
    }
  };

  // Calculate final amounts
  const promotionDiscount =
    type === 'booking'
      ? bookingPromoStack?.totalSavings ?? appliedPromotion?.discountAmount ?? 0
      : appliedPromotion?.discountAmount || 0;
  const couponDiscount = type === 'booking' ? 0 : appliedCoupon?.discountAmount || 0;
  const razorpayOfferDiscount = selectedRazorpayOffer?.discountValue || 0;

  // Apply discounts to subtotal (before tax for some, after tax for others - following standard practice)
  const subtotalAfterDiscounts = Math.max(0, taxBreakdown.subtotal - promotionDiscount - couponDiscount);

  // Recalculate tax on discounted amount if needed (or keep original tax - business logic)
  const finalTax = taxBreakdown.totalTax; // Or recalculate on discounted amount
  const totalAfterDiscounts = subtotalAfterDiscounts + finalTax + platformFees.total;

  const isMealPay = type === 'meal_subscription' || type === 'meal_one_time';
  /** After `/tax/calculate`: grand total for food+delivery+GST lines only — add platform & convenience once (not `platformFees.total`, which includes delivery). */
  const resolvedMealPayTotal = isMealPay
    ? mealTaxReady
      ? Math.round((taxBreakdown.total + platformFees.platformFee + platformFees.convenienceFee) * 100) / 100
      : Number(baseAmount)
    : NaN;
  const walletCapBase = isMealPay
    ? Math.max(0, resolvedMealPayTotal - razorpayOfferDiscount)
    : Math.max(0, totalAfterDiscounts - razorpayOfferDiscount);
  const walletAmount = useWallet && wallet ? Math.min(wallet.balance, walletCapBase) : 0;

  // If subscription covers this booking, final amount is 0
  const finalAmount = subscriptionCovered
    ? 0
    : isMealPay
      ? Math.max(0, resolvedMealPayTotal - razorpayOfferDiscount - walletAmount)
      : Math.max(0, totalAfterDiscounts - razorpayOfferDiscount - walletAmount);

  const getPaymentSuccessMeta = (gatewayMethod?: string | null) => {
    const paymentSources = buildCheckoutPaymentSources({
      walletAmount,
      gatewayAmount: finalAmount,
      gatewayMethod,
    });
    const totalPaid = Math.round((walletAmount + finalAmount) * 100) / 100;
    return { paymentSources, totalPaid };
  };

  const effectivePetId = petId;
  const effectivePetName = petName?.trim() || undefined;

  const handlePayment = async (skipPolicyCheck: boolean = false) => {
    // Check if policies have been accepted (for bookings)
    // âœ… FIX: Allow skipping policy check when called from modal acceptance
    if (type === 'booking' && !skipPolicyCheck && !policyAccepted) {
      setShowPolicyModal(true);
      return;
    }

    // Validate address if needed
    if (showAddressSelection && !selectedAddress) {
      toast.error('Please select a delivery address');
      return;
    }

    setProcessing(true);

    try {
      if (type === 'meal_one_time' && mealOneTimeDraft) {
        const d = mealOneTimeDraft;
        const cid = d.customerId || customerId;
        const idempotent = `mealow-${d.mealPlanId}-${Date.now().toString(36)}`;

        let orderId = d.existingOrderId?.trim() || '';
        if (!orderId) {
          const createRes = await apiClient.post<any>('/meal/orders/create', {
            customerId: cid,
            customerPhone: cid ? undefined : d.customerPhone || customerPhone,
            mealPlanId: d.mealPlanId,
            petId: d.petId,
            quantity: d.quantity,
            purchaseType: 'ONE_TIME',
            specialInstructions: d.specialInstructions,
            deliveryAddress: d.deliveryAddress,
            scheduledDeliveryDate: d.scheduledDeliveryDate,
            scheduledDeliverySlot: d.scheduledDeliverySlot,
            logisticsType: d.logisticsType || 'warmpawz',
          });
          const order = createRes?.order || createRes;
          orderId = String(order?.id || '');
          if (!orderId) throw new Error('Order created but ID missing');
        }

        let amountInRupeesForGateway = finalAmount;
        if (useWallet && walletAmount > 0.009 && cid) {
          const wd = await apiClient.post<any>(`/meal/orders/${orderId}/wallet-debit`, {
            customerId: cid,
            amountInRupees: Math.round(walletAmount * 100) / 100,
            idempotencyKey: idempotent,
          });
          if (!wd?.success) {
            throw new Error(wd?.error || 'Wallet debit failed');
          }
          const rem = Number(wd.remainderInRupees);
          if (Number.isFinite(rem)) {
            amountInRupeesForGateway = Math.max(0, Math.round(rem * 100) / 100);
          }
        }

        if (amountInRupeesForGateway > 0.009) {
          await loadRazorpayScript();
          const rz = await apiClient.post<any>('/meal/orders/create-razorpay-order', {
            amountInRupees: amountInRupeesForGateway,
            notes: {
              customerId: cid,
              mealPlanId: d.mealPlanId,
              vendorId: d.vendorId,
              kind: 'meal_one_time',
              mealOrderId: orderId,
            },
          });
          if (!rz?.razorpayOrderId) {
            throw new Error(rz?.error || 'Failed to create payment order');
          }
          const attach = await apiClient.post<any>(`/meal/orders/${orderId}/checkout-order`, {
            customerId: cid,
            razorpayOrderId: rz.razorpayOrderId,
          });
          if (!attach?.success) {
            throw new Error(attach?.error || 'Could not link checkout order');
          }
          const keyId = rz.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY;
          if (!keyId) {
            toast.error('Payment gateway not configured');
            setProcessing(false);
            return;
          }
          const checkoutEmailArg =
            (customerEmail && customerEmail.trim()) || RAZORPAY_PREFILL_EMAIL_FALLBACK;
          const options = buildSanitizedStandardRazorpayCheckoutOptions({
            key: keyId,
            amountPaise: Math.max(1, Math.round(Number(rz.amount))),
            currency: rz.currency || 'INR',
            name: 'Warmpawz',
            description: `Meal plan: ${serviceName || 'Order'}`,
            order_id: rz.razorpayOrderId,
            customerPhone: d.customerPhone || customerPhone,
            customerEmail: checkoutEmailArg,
            includeInstrumentBlocks: true,
            handler: async (response: any) => {
              try {
                await apiClient.post(`/meal/orders/${orderId}/confirm-payment`, {
                  customerId: cid,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                });
                toast.success('Order confirmed!');
                onSuccess(orderId);
              } catch (err: any) {
                toast.error(err?.message || 'Payment confirmation failed');
              } finally {
                setProcessing(false);
              }
            },
            theme: { color: '#FF8C42' },
            modal: {
              ondismiss: () => setProcessing(false),
            },
          });
          const razorpay = new (window as any).Razorpay(options);
          razorpay.open();
          return;
        }

        await apiClient.post(`/meal/orders/${orderId}/confirm-payment`, { customerId: cid });
        toast.success('Order paid from wallet!');
        onSuccess(orderId);
        setProcessing(false);
        return;
      }

      if (type === 'meal_subscription' && mealSubscriptionId && customerId) {
        const idempotent = `mealw-${mealSubscriptionId}-${Date.now().toString(36)}`;
        let amountInRupeesForGateway = finalAmount;
        if (useWallet && walletAmount > 0.009) {
          const wd = await apiClient.post<any>(`/meal/subscriptions/${mealSubscriptionId}/wallet-debit`, {
            customerId,
            amountInRupees: Math.round(walletAmount * 100) / 100,
            idempotencyKey: idempotent,
          });
          if (!wd?.success) {
            throw new Error(wd?.error || 'Wallet debit failed');
          }
          const rem = Number(wd.remainderInRupees);
          if (Number.isFinite(rem)) {
            amountInRupeesForGateway = Math.max(0, Math.round(rem * 100) / 100);
          }
        }
        if (amountInRupeesForGateway > 0.009) {
          await loadRazorpayScript();
          const rz = await apiClient.post<any>('/meal/orders/create-razorpay-order', {
            amountInRupees: amountInRupeesForGateway,
            notes: {
              customerId,
              mealSubscriptionId,
              kind: 'meal_subscription',
            },
          });
          if (!rz?.razorpayOrderId) {
            throw new Error(rz?.error || 'Failed to create payment order');
          }
          const attach = await apiClient.post<any>(`/meal/subscriptions/${mealSubscriptionId}/checkout-order`, {
            customerId,
            razorpayOrderId: rz.razorpayOrderId,
          });
          if (!attach?.success) {
            throw new Error(attach?.error || 'Could not link checkout order');
          }
          const keyId = rz.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY;
          if (!keyId) {
            toast.error('Payment gateway not configured');
            setProcessing(false);
            return;
          }
          const checkoutEmailArg =
            (customerEmail && customerEmail.trim()) || RAZORPAY_PREFILL_EMAIL_FALLBACK;
          const options = buildSanitizedStandardRazorpayCheckoutOptions({
            key: keyId,
            amountPaise: Math.max(1, Math.round(Number(rz.amount))),
            currency: rz.currency || 'INR',
            name: 'Warmpawz',
            description: `Meal subscription — ${serviceName || 'Plan'}`,
            order_id: rz.razorpayOrderId,
            customerPhone,
            customerEmail: checkoutEmailArg,
            includeInstrumentBlocks: true,
            handler: async (response: any) => {
              try {
                await confirmMealSubscriptionPayment(
                  mealSubscriptionId,
                  customerId,
                  response.razorpay_payment_id,
                );
                toast.success('Subscription payment confirmed!');
                onSuccess(mealSubscriptionId);
              } catch (err: any) {
                toast.error(err?.message || 'Payment confirmation failed');
              } finally {
                setProcessing(false);
              }
            },
            theme: { color: '#FF8C42' },
            modal: {
              ondismiss: () => setProcessing(false),
            },
          });
          const razorpay = new (window as any).Razorpay(options);
          razorpay.open();
          return;
        }
        await confirmMealSubscriptionPayment(mealSubscriptionId, customerId, undefined);
        toast.success('Subscription paid from wallet!');
        onSuccess(mealSubscriptionId);
        setProcessing(false);
        return;
      }

      let bookingCreationDeferred = false;
      let deferredBookingPayload: Record<string, unknown> | null = null;
      let requiredUpfrontAmount: number | null = null;
      /** True once Razorpay success handler runs (do not cancel booking on modal dismiss â€” payment may have succeeded). */
      let razorpayGatewaySuccessHandled = false;
      /** True on payment.failed â€” user may retry; do not auto-cancel slot on dismiss. */
      let razorpayPaymentFailed = false;

      // Step 1: Create booking/order if not already created
      let currentBookingId: string | undefined = bookingId;
      let currentOrderId: string | undefined = orderId;

      // Instant tele: no booking until after payment; backend creates via instant-after-payment
      if (type === 'booking' && flowType === 'tele-instant') {
        currentBookingId = undefined;
        // Skip booking creation below; Razorpay handler will call instant-after-payment
      } else if (type === 'booking' && flowType === 'tele-queue-accepted') {
        // Queue-accepted flow: booking already exists with pending_payment status
        // Use the existing bookingId - skip booking creation, go straight to payment
        console.log('[PAYMENT] Queue-accepted flow: using existing bookingId:', currentBookingId);
      } else if (type === 'booking' && flowType === 'payment-resume' && currentBookingId) {
        console.log('[PAYMENT] Payment resume: using existing bookingId:', currentBookingId);
      } else if (type === 'booking' && !currentBookingId) {
        // Validate required fields
        if (!customerId) {
          toast.error('Customer ID is required. Please try again.');
          setProcessing(false);
          return;
        }

        if (!serviceId) {
          toast.error('Service ID is required.');
          setProcessing(false);
          return;
        }

        if (!vendorId) {
          toast.error('Vendor ID is required.');
          setProcessing(false);
          return;
        }

        // âœ… CRITICAL: Resolve serviceId to UUID BEFORE creating booking
        // This MUST happen synchronously here to ensure we have the UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        let finalServiceId = resolvedServiceId || serviceId;

        // âœ… FIX: If selectedServices is provided, use the first service's id (vendor_services.id)
        // This ensures we use vendor_services.id instead of services.id to match the foreign key constraint
        console.log(`ðŸ” [SERVICE-ID-RESOLUTION] Initial serviceId: "${serviceId}", resolvedServiceId: "${resolvedServiceId}", finalServiceId: "${finalServiceId}"`);
        console.log(`ðŸ” [SERVICE-ID-RESOLUTION] selectedServices:`, selectedServices);
        
        if (selectedServices && selectedServices.length > 0) {
          const firstSelectedService = selectedServices[0];
          console.log(`ðŸ” [SERVICE-ID-RESOLUTION] First selected service:`, {
            id: firstSelectedService.id,
            serviceId: firstSelectedService.serviceId,
            service_id: firstSelectedService.service_id,
            hasId: !!firstSelectedService.id,
            idIsUUID: firstSelectedService.id ? uuidRegex.test(String(firstSelectedService.id)) : false,
            hasServiceId: !!firstSelectedService.serviceId,
            serviceIdIsUUID: firstSelectedService.serviceId ? uuidRegex.test(String(firstSelectedService.serviceId)) : false,
            fullObject: firstSelectedService,
          });
          
          // âœ… CRITICAL: Prioritize id field (vendor_services.id) over serviceId (services.id)
          // The id field should be vendor_services.id which is what bookings.service_id FK requires
          const candidateId = firstSelectedService.id;
          const candidateServiceId = firstSelectedService.serviceId || firstSelectedService.service_id;
          
          if (candidateId && uuidRegex.test(String(candidateId))) {
            finalServiceId = String(candidateId);
            console.log(`âœ… [SERVICE-ID-RESOLUTION] Using serviceId from selectedServices[0].id (vendor_services.id): "${finalServiceId}"`);
          } else if (candidateServiceId && uuidRegex.test(String(candidateServiceId))) {
            // âš ï¸ WARNING: This might be services.id, not vendor_services.id
            // We'll use it but log a warning - the backend validation will catch if it's wrong
            finalServiceId = String(candidateServiceId);
            console.warn(`âš ï¸ [SERVICE-ID-RESOLUTION] Using serviceId from selectedServices[0].serviceId (might be services.id, not vendor_services.id): "${finalServiceId}"`);
          } else {
            console.warn(`âš ï¸ [SERVICE-ID-RESOLUTION] selectedServices[0] has no valid UUID in id or serviceId fields`);
          }
        } else {
          console.log(`â„¹ï¸ [SERVICE-ID-RESOLUTION] No selectedServices provided, using finalServiceId: "${finalServiceId}"`);
        }
        
        console.log(`ðŸ” [SERVICE-ID-RESOLUTION] Final resolved serviceId before sync resolution: "${finalServiceId}"`);

        // âœ… CRITICAL: Only resolve if we don't already have a valid UUID from selectedServices
        // If selectedServices provided a valid UUID, skip the synchronous resolution to avoid overriding it
        const hasValidServiceIdFromSelectedServices = selectedServices && selectedServices.length > 0 && 
          selectedServices[0].id && uuidRegex.test(selectedServices[0].id);

        // If not a UUID, resolve it NOW (synchronously)
        // BUT skip if we already got a valid UUID from selectedServices
        if (!uuidRegex.test(finalServiceId) && !hasValidServiceIdFromSelectedServices) {
          console.log(`ðŸ”„ Resolving serviceId "${finalServiceId}" to UUID synchronously...`);

          try {
            // Try multiple endpoints to get vendor services
            let vendorServicesRes: any = null;
            const endpoints = [
              `/vendor/${vendorId}/services`,
              `/vendor/services/${vendorId}`,
              `/vendor-services?vendorId=${vendorId}`
            ];

            for (const endpoint of endpoints) {
              try {
                vendorServicesRes = await apiClient.get<any>(endpoint);
                // Check if response has services in any format
                if (vendorServicesRes?.allServices ||
                  vendorServicesRes?.services ||
                  vendorServicesRes?.data?.services ||
                  Array.isArray(vendorServicesRes)) {
                  console.log(`âœ… [SERVICE-RESOLUTION-SYNC] Found services from endpoint: ${endpoint}`);
                  break;
                }
              } catch (e: any) {
                console.warn(`âš ï¸ [SERVICE-RESOLUTION-SYNC] Endpoint ${endpoint} failed:`, e.message);
                continue; // Try next endpoint
              }
            }

            if (vendorServicesRes) {
              // âœ… CRITICAL: Handle different API response formats
              let services: any[] = [];

              // Format 1: { services: { at_home: { services: [...] }, ... }, allServices: [...] }
              if (vendorServicesRes.allServices && Array.isArray(vendorServicesRes.allServices)) {
                services = vendorServicesRes.allServices;
              }
              // Format 2: { services: { at_home: { services: [...] }, ... } }
              else if (vendorServicesRes.services && typeof vendorServicesRes.services === 'object' && !Array.isArray(vendorServicesRes.services)) {
                // Flatten servicesByStyle object
                services = Object.values(vendorServicesRes.services).flatMap((style: any) =>
                  (style?.services && Array.isArray(style.services)) ? style.services : []
                );
              }
              // Format 3: { services: [...] } (direct array)
              else if (vendorServicesRes.services && Array.isArray(vendorServicesRes.services)) {
                services = vendorServicesRes.services;
              }
              // Format 4: { data: { services: [...] } }
              else if (vendorServicesRes.data?.services && Array.isArray(vendorServicesRes.data.services)) {
                services = vendorServicesRes.data.services;
              }
              // Format 5: Direct array response
              else if (Array.isArray(vendorServicesRes)) {
                services = vendorServicesRes;
              }

              console.log('ðŸ“¦ [SERVICE-RESOLUTION] Extracted services:', {
                count: services.length,
                sample: services[0],
                responseKeys: Object.keys(vendorServicesRes),
              });

              // Ensure services is an array before calling .find()
              if (!Array.isArray(services)) {
                console.error('âŒ [SERVICE-RESOLUTION] Services is not an array:', typeof services, services);
                throw new Error('Invalid services response format from API');
              }

              // Look for service with matching numeric ID
              const matchingService = services.find((s: any) =>
                String(s.id) === String(finalServiceId) ||
                String(s.serviceId) === String(finalServiceId) ||
                String(s.service_id) === String(finalServiceId) ||
                s.id === finalServiceId ||
                s.serviceId === finalServiceId ||
                s.service_id === finalServiceId
              );

              if (matchingService) {
                // âœ… FIX: Prioritize id (vendor_services.id) over service_id (services.id reference)
                // bookings.service_id must reference vendor_services.id, not services.id
                if (uuidRegex.test(matchingService.id)) {
                  finalServiceId = matchingService.id;
                  setResolvedServiceId(matchingService.id);
                  console.log(`âœ… Synchronously resolved serviceId "${serviceId}" to vendor_services.id: "${matchingService.id}"`);
                } else if (uuidRegex.test(matchingService.service_id || matchingService.serviceId)) {
                  // Fallback: if id is not a UUID, try service_id (shouldn't happen normally)
                const resolved = matchingService.service_id || matchingService.serviceId;
                  finalServiceId = resolved;
                  setResolvedServiceId(resolved);
                  console.log(`âœ… Synchronously resolved serviceId "${serviceId}" to service_id: "${resolved}"`);
                } else {
                  throw new Error(`Service found but no valid UUID available. Service ID: ${serviceId}`);
                }
              } else {
                throw new Error(`Service "${serviceId}" not found in vendor services`);
              }
            } else {
              throw new Error('Could not fetch vendor services');
            }
          } catch (resolveError: any) {
            console.error('âŒ Failed to resolve serviceId:', resolveError);
            toast.error(
              `Invalid service ID. Please go back and select the service again. ` +
              `Error: ${resolveError.message || 'Service not found'}`
            );
            setProcessing(false);
            return;
          }
        }

        // Final validation - MUST be UUID at this point
        if (!uuidRegex.test(finalServiceId)) {
          toast.error(
            `Invalid service ID format. Please go back and select the service again. ` +
            `Received: ${serviceId}, Resolved: ${finalServiceId}`
          );
          setProcessing(false);
          return;
        }

        // Format address for API (can be string or object with coordinates)
        let addressValue: string | undefined = undefined;
        let addressCity: string | undefined;
        let addressState: string | undefined;
        let addressPincode: string | undefined;
        let addressLat: number | undefined;
        let addressLng: number | undefined;
        let addressIdForBooking: string | undefined = undefined;
        if (serviceStyle === 'at_home' && (selectedAddress || address)) {
          const addr = selectedAddress || address;
          if (typeof addr === 'string') {
            addressValue = addr;
          } else if (addr?.addressLine1 || addr?.address) {
            const addrLine = addr.addressLine1 || addr.address || '';
            const city = addr.city || '';
            const pincode = addr.pincode || '';
            addressValue = `${addrLine}${city ? `, ${city}` : ''}${pincode ? ` - ${pincode}` : ''}`;
            addressCity = addr.city;
            addressState = addr.state;
            addressPincode = addr.pincode;
            if (typeof addr.latitude === 'number' && typeof addr.longitude === 'number') {
              addressLat = addr.latitude;
              addressLng = addr.longitude;
            }
            // âœ… FIX: Also extract coordinates from JSON coordinates field
            if (!addressLat && !addressLng && addr.coordinates) {
              try {
                const coords = typeof addr.coordinates === 'string' ? JSON.parse(addr.coordinates) : addr.coordinates;
                if (coords?.lat) addressLat = Number(coords.lat);
                if (coords?.lng) addressLng = Number(coords.lng);
              } catch { /* ignore */ }
            }
            // âœ… CRITICAL FIX: Pass the address ID so the backend can look up detailed fields (flat, house, floor, building)
            if (addr.id && addr.id !== 'profile') {
              addressIdForBooking = addr.id;
            }
          }
        }

        // Map serviceStyle to serviceType enum (must match CreateBookingRequestSchema.serviceType)
        const validServiceTypes = ['at_vendor', 'at_home', 'online', 'at_center', 'tele', 'hybrid', 'product'] as const;
        const serviceTypeMap: Record<string, string> = {
          'at_home': 'at_home',
          'at_center': 'at_center',
          'at_vendor': 'at_vendor',
          'tele': 'tele',
          'online': 'tele',
          'ecom': 'product',
          'hybrid': 'hybrid',
          'product': 'product',
        };
        const rawServiceType = serviceTypeMap[serviceStyle || ''] || serviceStyle || 'at_center';
        const serviceTypeValue = validServiceTypes.includes(rawServiceType as any) ? rawServiceType : 'at_center';

        // âœ… NEW: Check if subscription covers this booking
        if (subscriptionCovered && activeSubscription) {
          console.log('ðŸ“‹ Creating subscription-covered booking (0 payment)...');

          try {
            const subscriptionBookingRes = await apiClient.post<any>('/subscriptions/create-booking', {
              subscriptionId: activeSubscription.id,
              customerId,
              vendorId,
              serviceId: finalServiceId,
              serviceName,
              bookingDate,
              bookingTime,
              serviceType: serviceStyle || 'at_center',
              petId: effectivePetId,
              petName: effectivePetName,
              customerPhone,
              address: selectedAddress?.addressLine1 || address?.addressLine1,
            });

            if (subscriptionBookingRes.success && subscriptionBookingRes.booking) {
              toast.success('Booking confirmed with your subscription!');
              onSuccess(
                subscriptionBookingRes.booking.id,
                undefined,
                subscriptionBookingRes.booking.otp || subscriptionBookingRes.bookingOtp
              );
              return;
            }
          } catch (subError: any) {
            console.warn('âš ï¸ Subscription booking failed, proceeding with normal payment:', subError);
            // Fall through to normal payment flow
            setSubscriptionCovered(false);
          }
        }

        // Create booking with correct API format
        // âœ… CRITICAL: CreateBookingRequestSchema requires customerId (UUID). Resolve from customerPhone if missing.
        let resolvedCustomerId = customerId;
        if (!resolvedCustomerId && customerPhone) {
          try {
            const byPhoneRes = await apiClient.get(`/customer/by-phone?phone=${encodeURIComponent(customerPhone)}`) as any;
            resolvedCustomerId = byPhoneRes?.customer?.id ?? byPhoneRes?.id;
            if (!resolvedCustomerId) {
              const profileRes = await apiClient.get(`/customer/profile?phone=${encodeURIComponent(customerPhone)}`) as any;
              const profile = profileRes?.profile ?? profileRes;
              resolvedCustomerId = profile?.id ?? profile?.customerId;
            }
          } catch (e) {
            console.warn('Could not resolve customerId from customerPhone:', e);
          }
        }
        if (!resolvedCustomerId) {
          toast.error('Could not load your profile. Please sign in and try again.');
          setProcessing(false);
          return;
        }

        let bookingRes: any;

        // Get customer name from profile
        let customerNameValue = '';
        try {
          const profileResponse = await apiClient.get(`/customer/profile?phone=${encodeURIComponent(customerPhone)}`) as any;
          if (profileResponse?.profile || profileResponse) {
            const profile = profileResponse.profile || profileResponse;
            customerNameValue = profile.name || profile.fullName || '';
          }
        } catch (e) {
          console.log('Could not fetch customer name for booking');
        }

        // âœ… finalServiceId is already resolved and validated above

        // Normalize bookingTime to HH:MM or HH:MM:SS (backend schema expects this)
        const timeMatch = typeof bookingTime === 'string' && bookingTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
        const normalizedBookingTime = timeMatch
          ? (timeMatch[3] !== undefined ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:${timeMatch[3]}` : `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`)
          : bookingTime;

        // âœ… FINAL CHECK: If selectedServices is provided, ensure we use vendor_services.id
        // This is a last-ditch check to prevent using services.id instead of vendor_services.id
        if (selectedServices && selectedServices.length > 0) {
          const firstSelectedService = selectedServices[0];
          if (firstSelectedService.id && uuidRegex.test(String(firstSelectedService.id))) {
            // Only override if current finalServiceId doesn't match the vendor_services.id
            if (finalServiceId !== String(firstSelectedService.id)) {
              console.warn(`âš ï¸ [FINAL-CHECK] Overriding finalServiceId "${finalServiceId}" with selectedServices[0].id "${firstSelectedService.id}"`);
              finalServiceId = String(firstSelectedService.id);
            }
          }
        }

        const bookingPayload: Record<string, unknown> = {
          customerId: resolvedCustomerId, // âœ… Required UUID (resolved above)
          vendorId: vendorId, // âœ… Required UUID
          serviceId: finalServiceId, // âœ… Required UUID (resolved above)
          serviceName: serviceName, // âœ… Service name for booking
          bookingDate: bookingDate, // âœ… Format: YYYY-MM-DD
          bookingTime: normalizedBookingTime, // âœ… Format: HH:MM or HH:MM:SS
          serviceType: serviceTypeValue, // âœ… Required enum
          amount: taxBreakdown.total, // âœ… Number (schema allows >= 0)
          ...(promotionDiscount > 0
            ? {
                discountAmount: promotionDiscount,
                ...(bookingPromoStack?.vendorPromotionId
                  ? { vendorPromotionId: bookingPromoStack.vendorPromotionId }
                  : {}),
                ...(bookingPromoStack?.platformPromotionId
                  ? { platformPromotionId: bookingPromoStack.platformPromotionId }
                  : {}),
                ...(appliedCoupon?.code ? { couponCode: appliedCoupon.code } : {}),
              }
            : {}),
          petId: effectivePetId || undefined, // âœ… Optional UUID
          petName: effectivePetName || undefined, // âœ… Pet name for booking
          customerPhone: customerPhone, // âœ… Customer phone
          customerName: customerNameValue, // âœ… Customer name
          address: addressValue, // âœ… Optional string
          notes: '', // âœ… Optional string
          // âœ… NEW: Pass selected services for multi-service bookings
          selectedServices: selectedServices && selectedServices.length > 0
            ? selectedServices.map(s => ({
              id: s.id || s.serviceId,
              serviceId: s.service_id || s.serviceId || s.id,
              name: s.name || s.serviceName,
              price: Number(s.price) || Number(s.custom_price) || 0,
              duration: Number(s.duration) || Number(s.duration_minutes) || 30,
              quantity: Number(s.quantity) || 1,
            }))
            : undefined,
        };
        // âœ… at_home: pass city, state, pincode, latitude, longitude for commute and backend (CreateBookingRequestSchema)
        if (addressCity !== undefined) bookingPayload.city = addressCity;
        if (addressState !== undefined) bookingPayload.state = addressState;
        if (addressPincode !== undefined) bookingPayload.pincode = addressPincode;
        if (addressLat !== undefined) bookingPayload.latitude = addressLat;
        if (addressLng !== undefined) bookingPayload.longitude = addressLng;
        // âœ… CRITICAL FIX: Pass addressId so backend can store address_id in booking
        // This allows vendor-side to look up detailed address fields (flat, house, floor, building)
        if (addressIdForBooking) bookingPayload.addressId = addressIdForBooking;

        console.log('ðŸ“‹ Creating booking with validated payload:', {
          ...bookingPayload,
          originalServiceId: serviceId, // Log original
          resolvedServiceId: finalServiceId, // Log resolved UUID
          selectedServicesDebug: selectedServices ? selectedServices.map(s => ({ id: s.id, serviceId: s.serviceId, service_id: s.service_id })) : null,
        });
        console.log('ðŸ“‹ [CRITICAL] Final serviceId being sent to backend:', finalServiceId);

        // âœ… Payment policy aware: attempt booking creation (may be blocked if upfront payment required)
        // Try all possible booking creation endpoints
        const endpoints = [
          '/bookings/create',
          '/booking/create',
          '/customer/booking/create',
          '/customer/bookings/create'
        ];

        let lastError: any = null;
        let paymentRequiredError: any = null;
        for (const endpoint of endpoints) {
          try {
            console.log(`ðŸ”„ Trying booking endpoint: ${endpoint}`);
            bookingRes = await apiClient.post<any>(endpoint, bookingPayload);
            console.log(`âœ… Booking created with endpoint: ${endpoint}`);
            break; // Success, exit loop
          } catch (error: any) {
            lastError = error;
            const is404 = error?.statusCode === 404 ||
              error?.status === 404 ||
              error?.response?.status === 404 ||
              (error?.message && error.message.includes('404'));

            if (is404) {
              console.warn(`âš ï¸ ${endpoint} returned 404, trying next endpoint...`);
              continue; // Try next endpoint
            }

            // âœ… Payment-required flow: do not throw, proceed to payment
            const errorResponse = (error as any)?.response ?? (error as any)?.responseData ?? (error as any)?.responseBody ?? (error as any)?.originalError;
            const errorCode = errorResponse?.error?.code || errorResponse?.code;
            const is402 = (error as any)?.statusCode === 402 || (error as any)?.status === 402;
            if (is402 || ['PAYMENT_REQUIRED', 'PAYMENT_NOT_COMPLETED', 'PAYMENT_INSUFFICIENT'].includes(errorCode)) {
              paymentRequiredError = error;
              console.warn('âš ï¸ Booking creation blocked until payment is completed. Proceeding to payment.', {
                endpoint,
                errorCode,
                details: errorResponse?.error?.details || errorResponse?.details,
              });
              break;
            }

            {
              // Not a 404, might be validation error - log details and throw
              const err = error as any;
              console.error(`âŒ ${endpoint} failed with non-404 error:`, error);
              console.error('âŒ Error response:', errorResponse);
              console.error('âŒ Error status:', err?.status ?? err?.statusCode);
              console.error('âŒ Error message:', error?.message);

              // Extract message from backend shape: { success: false, error: { code, message, details } }
              let errorMessage =
                errorResponse?.error?.message ??
                (typeof errorResponse?.error === 'string' ? errorResponse.error : null) ??
                errorResponse?.message ??
                error?.message ??
                'Failed to create booking. Please check all required fields and try again.';

              // If backend sent validation errors (Zod), append first path/message for clarity
              const details = errorResponse?.error?.details ?? errorResponse?.details;
              const validationErrors = details?.errors;
              if (Array.isArray(validationErrors) && validationErrors.length > 0) {
                const first = validationErrors[0];
                const path = first?.path?.join?.('.') ?? first?.path ?? '';
                const msg = first?.message ?? '';
                errorMessage = path ? `${errorMessage} (${path}: ${msg})` : `${errorMessage} â€” ${msg}`;
              }

              throw new Error(errorMessage);
            }
          }
        }

        if (paymentRequiredError) {
          const err = paymentRequiredError as any;
          const errorResponse = err?.response ?? err?.responseData ?? err?.responseBody;
          const details = errorResponse?.error?.details || errorResponse?.details || {};
          requiredUpfrontAmount = Number(details?.requiredUpfront ?? details?.amount ?? taxBreakdown.total);
          bookingCreationDeferred = true;
          deferredBookingPayload = bookingPayload;
        }

        // If we exhausted all endpoints, throw the last error
        if (!bookingRes && !bookingCreationDeferred) {
          console.error('âŒ All booking creation endpoints failed');
          throw lastError || new Error('All booking creation endpoints returned 404. Lambda may need redeployment.');
        }

        // P2: Treat 200-with-error as failure (resilient parsing)
        if (bookingRes?.error || bookingRes?.success === false) {
          const errMsg = typeof bookingRes?.error === 'string' ? bookingRes.error : (bookingRes?.error?.message ?? bookingRes?.error ?? 'Booking creation failed');
          throw new Error(errMsg);
        }

        // Forensic: extract booking ID from any response shape (wrapped, idempotency, double-wrapped, deep)
        const bookingIdValue = extractBookingIdFromResponse(bookingRes, 'Initial booking create');

        console.log('ðŸ“‹ Booking creation response:', {
          fullResponse: bookingRes,
          extractedBookingId: bookingIdValue,
          hasData: !!bookingRes?.data,
          dataKeys: bookingRes?.data ? Object.keys(bookingRes.data) : [],
        });

        if (!bookingIdValue && !bookingCreationDeferred) {
          console.error('âŒ No booking ID in response:', bookingRes);
          throw new Error('Failed to create booking: No booking ID returned');
        }

        if (bookingIdValue && !UUID_REGEX.test(bookingIdValue)) {
          console.error('âŒ Invalid bookingId format from API:', bookingIdValue);
          throw new Error('Invalid booking ID format received from server');
        }

        if (bookingIdValue) {
          currentBookingId = bookingIdValue;
          console.log('âœ… Booking ID set:', currentBookingId);
        }
      } else if (type === 'order' && !currentOrderId) {
        const orderRes = await apiClient.post<any>('/customer/orders', {
          productId: productId,
          vendorId: vendorId,
          quantity,
          address: selectedAddress,
          shippingAddress: selectedAddress,
          customerPhone,
          customerId,
          subtotal: taxBreakdown.subtotal,
          taxAmount: taxBreakdown.totalTax,
          total: taxBreakdown.total,
        });

        const extractedOrderId = extractEcommerceOrderIdFromResponse(orderRes);
        if (!extractedOrderId) {
          throw new Error('Failed to create order');
        }
        currentOrderId = extractedOrderId;
      }

      if (type === 'order' && !currentOrderId) {
        throw new Error('Order was not created. Please try again.');
      }

      // Step 2: Create payment record (only when booking already exists)

      // âœ… For bookings, only create payment record if booking already exists
      if (type === 'booking' && (!currentBookingId || bookingCreationDeferred)) {
        console.log('â„¹ï¸ Booking creation deferred; payment record will be created by Razorpay order flow.');
      }

      const paymentPayload: any = {
        amount: taxBreakdown.total, // âœ… Required: positive number
        paymentMethod: selectedMethod === 'razorpay' ? 'razorpay' : (selectedMethod || 'razorpay'), // âœ… Optional enum
        bookingId: currentBookingId, // âœ… Required UUID (booking should already exist)
      };

      if (category != null && String(category).trim() !== '') {
        paymentPayload.category = String(category).trim();
      }

      // âœ… Optional fields (not in schema but backend may handle)
      if (customerId) {
        paymentPayload.customerId = customerId; // âœ… Optional UUID
      }
      if (vendorId) {
        paymentPayload.vendorId = vendorId; // âœ… Optional UUID
      }

      // âœ… Wallet fields (extracted from raw body by backend)
      if (useWallet) {
        paymentPayload.useWallet = useWallet;
        paymentPayload.walletAmount = walletAmount || 0;
      }

      // âœ… Additional fields (not in schema, but backend may handle from raw body)
      // These are sent but not validated by schema
      if (appliedCoupon?.code) {
        paymentPayload.couponCode = appliedCoupon.code;
        paymentPayload.couponDiscount = couponDiscount || 0;
      }
      if (appliedPromotion?.id || bookingPromoStack?.totalSavings) {
        paymentPayload.promotionDiscount = promotionDiscount || 0;
        if (type === 'booking' && bookingPromoStack) {
          if (bookingPromoStack.vendorPromotionId) {
            paymentPayload.vendorPromotionId = bookingPromoStack.vendorPromotionId;
          }
          if (bookingPromoStack.platformPromotionId) {
            paymentPayload.platformPromotionId = bookingPromoStack.platformPromotionId;
          }
        } else if (appliedPromotion?.id && appliedPromotion.id !== 'auto') {
          paymentPayload.promotionId = appliedPromotion.id;
        }
      }
      if (selectedRazorpayOffer?.id) {
        paymentPayload.razorpayOfferId = selectedRazorpayOffer.id;
        paymentPayload.razorpayOfferDiscount = razorpayOfferDiscount || 0;
      }

      console.log('ðŸ“¤ Creating payment with payload:', paymentPayload);

      // âœ… Create payment record (bookingId is REQUIRED - booking should already exist)
      // âš ï¸ SKIP for Razorpay-only payments when finalAmount > 0 (no wallet portion):
      //    /razorpay/create-order inserts the payment row with razorpay_order_id.
      //    When the customer pays part from wallet first, we MUST call /payments/create so the backend
      //    debits wallet and leaves a pending row with razorpay_order_id NULL; create-order then reuses
      //    that row (see razorpay.razorpay.ts orphan upsert).
      const isRazorpayOnline = (paymentPayload.paymentMethod === 'razorpay' || selectedMethod === 'razorpay') && finalAmount > 0;
      const needsPaymentsCreateForWalletSplit =
        isRazorpayOnline && useWallet && (walletAmount || 0) > 0;
      const skipPaymentsCreate = isRazorpayOnline && !needsPaymentsCreateForWalletSplit;
      let paymentRes: any = null;
      if (type === 'booking' && currentBookingId && !bookingCreationDeferred && !skipPaymentsCreate) {
        // âœ… Validate bookingId is a UUID before sending
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(currentBookingId)) {
          console.error('âŒ Invalid bookingId format:', currentBookingId);
          throw new Error('Invalid booking ID format. Please try again.');
        }

        // âœ… Validate amount is a non-negative number (0 allowed for full wallet payment)
        if (paymentPayload.amount == null || paymentPayload.amount < 0 || isNaN(paymentPayload.amount)) {
          console.error('âŒ Invalid amount:', paymentPayload.amount);
          throw new Error('Invalid payment amount. Please try again.');
        }

        // âœ… Validate paymentMethod is one of the allowed values
        const allowedMethods = ['razorpay', 'wallet', 'cash', 'card', 'upi', 'netbanking'];
        if (paymentPayload.paymentMethod && !allowedMethods.includes(paymentPayload.paymentMethod)) {
          console.error('âŒ Invalid paymentMethod:', paymentPayload.paymentMethod);
          // Default to razorpay if invalid
          paymentPayload.paymentMethod = 'razorpay';
        }

        // âœ… Validate customerId and vendorId are UUIDs if provided
        if (paymentPayload.customerId && !uuidRegex.test(paymentPayload.customerId)) {
          console.warn('âš ï¸ Invalid customerId format, removing from payload:', paymentPayload.customerId);
          delete paymentPayload.customerId;
        }
        if (paymentPayload.vendorId && !uuidRegex.test(paymentPayload.vendorId)) {
          console.warn('âš ï¸ Invalid vendorId format, removing from payload:', paymentPayload.vendorId);
          delete paymentPayload.vendorId;
        }

        console.log('ðŸ“¤ Creating payment with validated payload:', {
          bookingId: paymentPayload.bookingId,
          amount: paymentPayload.amount,
          amountType: typeof paymentPayload.amount,
          paymentMethod: paymentPayload.paymentMethod,
          customerId: paymentPayload.customerId,
          vendorId: paymentPayload.vendorId,
          hasWallet: !!paymentPayload.useWallet,
          hasCoupon: !!paymentPayload.couponCode,
          hasPromotion: !!paymentPayload.promotionId,
        });
        console.log('ðŸ“¤ Full payment payload (for debugging):', JSON.stringify(paymentPayload, null, 2));

        try {
          const paymentRaw = await apiClient.post<any>('/payments/create', paymentPayload);
          // Backend wraps as { success, data: { paymentId, status, ... } }
          paymentRes =
            paymentRaw && typeof paymentRaw === 'object' && paymentRaw.success && paymentRaw.data
              ? { ...paymentRaw.data }
              : paymentRaw;
        } catch (paymentError: any) {
          // âœ… Enhanced error logging to see validation errors
          console.error('âŒ Payment creation failed:', paymentError);
          console.error('âŒ Error response:', paymentError?.response || paymentError?.responseData);
          console.error('âŒ Error data:', paymentError?.responseData);
          console.error('âŒ Error status:', paymentError?.statusCode || paymentError?.status);
          console.error('âŒ Raw response:', paymentError?.rawResponse);
          console.error('âŒ Request payload that failed:', paymentPayload);

          // Log full error object for debugging
          if (paymentError) {
            console.error('âŒ Full error object:', {
              message: paymentError.message,
              code: paymentError.code,
              statusCode: paymentError.statusCode,
              status: paymentError.status,
              response: paymentError.response,
              responseData: paymentError.responseData,
              rawResponse: paymentError.rawResponse,
              stack: paymentError.stack
            });
          }

          // Extract validation errors from backend
          // Check multiple possible locations for error data
          const errorData = paymentError?.responseData || paymentError?.response || paymentError?.data || {};
          let errorMessage = 'Failed to create payment';

          // Check for validation errors in different formats
          if (errorData?.error?.details?.errors && Array.isArray(errorData.error.details.errors)) {
            // Format: { success: false, error: { code: 'VALIDATION_ERROR', details: { errors: [...] } } }
            const validationErrors = errorData.error.details.errors.map((e: any) => {
              const path = e.path?.join('.') || e.path || 'unknown';
              return `${path}: ${e.message}`;
            }).join(', ');
            errorMessage = `Payment validation failed: ${validationErrors}`;
            console.error('âŒ Validation errors:', errorData.error.details.errors);
          } else if (errorData?.data?.errors && Array.isArray(errorData.data.errors)) {
            // Format: { data: { errors: [...] } }
            const validationErrors = errorData.data.errors.map((e: any) => {
              const path = e.path?.join('.') || e.path || 'unknown';
              return `${path}: ${e.message}`;
            }).join(', ');
            errorMessage = `Payment validation failed: ${validationErrors}`;
            console.error('âŒ Validation errors:', errorData.data.errors);
          } else if (errorData?.errors && Array.isArray(errorData.errors)) {
            // Format: { errors: [...] }
            const validationErrors = errorData.errors.map((e: any) => {
              const path = e.path?.join('.') || e.path || 'unknown';
              return `${path}: ${e.message}`;
            }).join(', ');
            errorMessage = `Payment validation failed: ${validationErrors}`;
            console.error('âŒ Validation errors:', errorData.errors);
          } else if (errorData?.error?.message) {
            // Format: { success: false, error: { code, message, details } } (backend 500)
            const step = errorData.error?.details?.step;
            errorMessage = errorData.error.message;
            if (step) errorMessage += ` (step: ${step})`;
          } else if (errorData?.error) {
            // Format: { error: '...' }
            errorMessage = typeof errorData.error === 'string' ? errorData.error : errorData.error.message || errorMessage;
          } else if (errorData?.message) {
            // Format: { message: '...' }
            errorMessage = errorData.message;
          } else if (paymentError?.message) {
            // Fallback to ApiError message
            errorMessage = paymentError.message;
          }

          toast.error(errorMessage);
          setProcessing(false);
          return;
        }
      } else {
        // For orders or Razorpay online (where /payments/create was skipped), set mock response
        paymentRes = {
          id: `payment-${Date.now()}`,
          status: 'pending',
          razorpayOrderId: null,
        };
      }

      // If fully paid with wallet
      if (paymentRes?.status === 'completed' || finalAmount === 0) {
        // If booking creation was deferred (payment policy), create booking now
        if (type === 'booking' && bookingCreationDeferred && deferredBookingPayload) {
          const createPayload = {
            ...deferredBookingPayload,
            paymentId: paymentRes?.id,
            ...(useWallet && (walletAmount || 0) > 0
              ? {
                  useWallet: true,
                  walletAmount: Math.round((walletAmount || 0) * 100) / 100,
                }
              : {}),
          } as Record<string, unknown>;
          console.log('ðŸ”„ Creating booking after wallet payment:', createPayload);
          const bookingRes = await apiClient.post<any>('/bookings/create', createPayload);
          const bookingIdValue = extractBookingIdFromResponse(bookingRes, 'After wallet payment');
          if (!bookingIdValue) {
            console.error('âŒ No booking ID after wallet payment:', bookingRes);
            throw new Error('Payment succeeded but booking creation failed. Please contact support.');
          }
          currentBookingId = bookingIdValue;
          bookingCreationDeferred = false;
        }

        // Apply promotions and coupons
        if (appliedCoupon) {
          await apiClient.post('/coupons/apply', {
            couponCode: appliedCoupon.code,
            bookingId: currentBookingId,
            orderId: currentOrderId,
            customerId,
            amount: bookingCreationDeferred ? (requiredUpfrontAmount ?? finalAmount) : taxBreakdown.total,
          });
        }

        if (appliedPromotion && type !== 'booking') {
          await apiClient.post('/promotions/apply', {
            promotionId: appliedPromotion.id,
            bookingId: currentBookingId,
            orderId: currentOrderId,
            customerId,
            amount: bookingCreationDeferred ? (requiredUpfrontAmount ?? finalAmount) : taxBreakdown.total,
          });
        }

        // Generate OTP for eligible bookings
        const otpCode = type === 'booking' && serviceStyle !== 'tele'
          ? await generateBookingOTP(currentBookingId || '', customerId)
          : undefined;

        toast.success(type === 'booking' ? 'Booking confirmed!' : 'Order confirmed!');
        onSuccess(currentBookingId || '', currentOrderId, otpCode, getPaymentSuccessMeta());
        return;
      }

      // Step 3: Create Razorpay order
      // âœ… FIX: Use longer timeout (45s) for payment operations
      console.log('ðŸ”„ [PAYMENT] Creating Razorpay order...', {
        bookingId: currentBookingId,
        amount: bookingCreationDeferred ? (requiredUpfrontAmount ?? finalAmount) : finalAmount,
        flowType,
        bookingCreationDeferred
      });
      const amountToCharge = bookingCreationDeferred
        ? (requiredUpfrontAmount ?? finalAmount)
        : finalAmount;

      let orderRes: any;
      const razorpayCreateOrderBody =
        type === 'order' && currentOrderId
          ? buildRazorpayEcommerceCreateOrderPayload(
              currentOrderId,
              amountToCharge,
              customerId
            )
          : {
              bookingId:
                flowType === 'tele-instant' || bookingCreationDeferred
                  ? undefined
                  : currentBookingId,
              amount: amountToCharge,
              customerId,
              offerId: selectedRazorpayOffer?.id,
              type:
                flowType === 'tele-instant' || bookingCreationDeferred
                  ? 'booking_prepaid'
                  : undefined,
              vendorId:
                flowType === 'tele-instant' || bookingCreationDeferred ? vendorId : undefined,
              ...(type === 'booking' && currentBookingId && useWallet
                ? { useWallet: true, walletAmount: Math.round((walletAmount || 0) * 100) / 100 }
                : {}),
            };
      try {
        orderRes = await apiClient.post<any>(
          '/razorpay/create-order',
          razorpayCreateOrderBody,
          undefined,
          45000
        );
      } catch (orderError: any) {
        console.error('âŒ [PAYMENT] Razorpay create-order API call failed:', {
          error: orderError.message,
          status: orderError.status,
          statusCode: orderError.statusCode,
          response: orderError.response,
          responseData: orderError.responseData,
        });
        // Re-throw with better error message
        const errorMsg = orderError.responseData?.error || orderError.response?.error || orderError.message || 'Failed to create payment order';
        throw new Error(`Failed to create payment order: ${errorMsg}`);
      }

      console.log('âœ… [PAYMENT] Razorpay order response (raw):', JSON.stringify(orderRes, null, 2));
      console.log('âœ… [PAYMENT] Response type:', typeof orderRes);
      console.log('âœ… [PAYMENT] Response keys:', orderRes ? Object.keys(orderRes) : 'null/undefined');

      // âœ… FIX: Handle ALL possible response structures
      // Backend returns: { orderId, keyId, amount, currency } directly via this.success()
      // But could also be wrapped in: { success: true, data: { ... } } or { data: { ... } }
      // Or error response: { error: "..." } or { success: false, error: "..." }

      // Check for error response first
      if (orderRes?.error || (orderRes?.success === false)) {
        const errorMsg = typeof orderRes.error === 'string'
          ? orderRes.error
          : orderRes.error?.message || 'Failed to create payment order';
        console.error('âŒ [PAYMENT] Error in response:', errorMsg);
        throw new Error(errorMsg);
      }

      // Extract orderId from all possible locations
      const razorpayOrderId: string =
        orderRes?.orderId ||           // Direct: { orderId: "..." }
        orderRes?.data?.orderId ||     // Wrapped: { data: { orderId: "..." } }
        orderRes?.success?.data?.orderId || // Double wrapped: { success: { data: { orderId: "..." } } }
        orderRes?.razorpay_order_id || // Alternative field name
        orderRes?.id;                  // Fallback to id

      const keyId: string | undefined =
        orderRes?.keyId ||
        orderRes?.data?.keyId ||
        orderRes?.success?.data?.keyId ||
        process.env.NEXT_PUBLIC_RAZORPAY_KEY;

      const orderAmount: number | undefined =
        orderRes?.amount ||
        orderRes?.data?.amount ||
        orderRes?.success?.data?.amount;

      console.log('ðŸ” [PAYMENT] Extracted values:', {
        razorpayOrderId: razorpayOrderId ? `${razorpayOrderId.substring(0, 20)}...` : 'MISSING',
        keyId: keyId ? `${keyId.substring(0, 8)}...` : 'missing',
        orderAmount,
        hasData: !!orderRes?.data,
        hasSuccess: !!orderRes?.success,
        responseKeys: orderRes ? Object.keys(orderRes) : []
      });

      if (!razorpayOrderId) {
        console.error('âŒ [PAYMENT] No orderId found in response. Full response structure:', {
          response: orderRes,
          stringified: JSON.stringify(orderRes, null, 2),
          type: typeof orderRes,
          isArray: Array.isArray(orderRes),
          keys: orderRes ? Object.keys(orderRes) : [],
          hasOrderId: !!orderRes?.orderId,
          hasData: !!orderRes?.data,
          dataKeys: orderRes?.data ? Object.keys(orderRes.data) : [],
        });
        throw new Error('Failed to create payment order: No order ID received from server. Please check the response structure.');
      }

      if (!keyId) {
        console.error('âŒ [PAYMENT] No keyId in response and NEXT_PUBLIC_RAZORPAY_KEY not set');
        throw new Error('Payment gateway configuration error: Razorpay key not found');
      }

      console.log('âœ… [PAYMENT] Razorpay order created successfully:', { razorpayOrderId, keyId: keyId ? `${keyId.substring(0, 8)}...` : 'missing', amount: orderAmount });

      // âœ… FIX: Wait for Razorpay script to load before opening checkout
      if (!isWarmpawzCustomerNativeWebView() && typeof window !== 'undefined' && !window.Razorpay) {
        console.log('â³ [PAYMENT] Waiting for Razorpay script to load...');
        try {
          await loadRazorpayScript();
          console.log('âœ… [PAYMENT] Razorpay script loaded successfully');
        } catch (scriptError: any) {
          console.error('âŒ [PAYMENT] Failed to load Razorpay script:', scriptError);
          throw new Error('Payment gateway script failed to load. Please refresh the page and try again.');
        }
      }

      // Step 4: Open Razorpay checkout (omit invalid offer ids / empty prefill â€” avoids Razorpay â€¦/build/undefined)
      const titlePart = [serviceName, productName].find((x) => typeof x === 'string' && String(x).trim());
      const vendorPart =
        typeof vendorName === 'string' && vendorName.trim() ? vendorName.trim() : 'Warmpawz';
      const paymentDescription = titlePart
        ? `${String(titlePart).trim()} â€” ${vendorPart}`
        : `Payment â€” ${vendorPart}`;
      const phoneDigits = customerPhone ? String(customerPhone).replace(/\D/g, '') : '';

      let resolvedCheckoutEmail: string | undefined =
        typeof customerEmail === 'string' && customerEmail.includes('@') ? customerEmail.trim() : undefined;
      if (!resolvedCheckoutEmail && customerPhone) {
        try {
          const profileResponse = (await apiClient.get(
            `/customer/profile?phone=${encodeURIComponent(customerPhone)}`
          )) as any;
          const profile = profileResponse?.profile ?? profileResponse;
          const em = profile?.email;
          if (typeof em === 'string' && em.includes('@')) {
            const t = em.trim();
            if (t) resolvedCheckoutEmail = t;
          }
        } catch {
          /* non-fatal */
        }
      }

      const rawOfferId = selectedRazorpayOffer?.id;
      const razorpayOfferIds =
        typeof rawOfferId === 'string' &&
        rawOfferId.trim() &&
        rawOfferId.trim() !== 'undefined' &&
        rawOfferId.trim() !== 'null'
          ? [rawOfferId.trim()]
          : [];
      const amountPaise = Math.max(1, Math.round(Number(amountToCharge) * 100));

      const e164Contact = digitsToRazorpayContactE164(phoneDigits);
      const prefillEmail =
        resolvedCheckoutEmail &&
        resolvedCheckoutEmail.includes('@') &&
        resolvedCheckoutEmail !== 'undefined' &&
        resolvedCheckoutEmail !== 'null'
          ? resolvedCheckoutEmail
          : undefined;
      const razorpayPrefill: Record<string, string> = {};
      if (e164Contact) razorpayPrefill.contact = e164Contact;
      if (prefillEmail) razorpayPrefill.email = prefillEmail;
      const upiVpaTrimmed = manualUpiVpa.replace(/\s+/g, '').trim().toLowerCase();
      const validPrefillVpa = upiVpaTrimmed.length > 0 && /^[\w.+-]+@[\w.-]+$/.test(upiVpaTrimmed);
      if (validPrefillVpa) {
        razorpayPrefill.vpa = upiVpaTrimmed;
        razorpayPrefill.method = 'upi';
      } else if (e164Contact && !razorpayPrefill.email) {
        // Matches wallet/shop flows: Razorpay often drops UPI on mobile/live without any prefill.email.
        razorpayPrefill.email = RAZORPAY_PREFILL_EMAIL_FALLBACK;
      }

      const processRazorpaySuccess = async (response: any) => {
        try {
          console.log('âœ… [RAZORPAY] Payment response received:', {
            order_id: response.razorpay_order_id,
            payment_id: response.razorpay_payment_id,
            has_signature: !!response.razorpay_signature,
          });

          // âœ… Step 1: Verify payment with backend (with retry)
          console.log('ðŸ”„ [RAZORPAY] Verifying payment...');
          let verifyRes: any = null;
          const MAX_VERIFY_RETRIES = 3;
          for (let attempt = 1; attempt <= MAX_VERIFY_RETRIES; attempt++) {
            try {
              verifyRes = await apiClient.post('/razorpay/verify-payment', {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }, undefined, 30000);
              console.log(`âœ… [RAZORPAY] Payment verified on attempt ${attempt}:`, verifyRes);
              break; // success â€“ exit retry loop
            } catch (verifyErr: any) {
              console.error(`âŒ [RAZORPAY] verify-payment attempt ${attempt}/${MAX_VERIFY_RETRIES} failed:`, verifyErr?.message);
              if (attempt === MAX_VERIFY_RETRIES) {
                // All retries exhausted â€“ throw so outer catch can handle
                throw verifyErr;
              }
              // Exponential backoff: 1s, 2s
              await new Promise((r) => setTimeout(r, attempt * 1000));
            }
          }

          // âœ… Instant tele: create booking via instant-after-payment (no booking until payment done)
          if (type === 'booking' && flowType === 'tele-instant') {
            const instantRes = await apiClient.post<any>('/customer/tele/instant-after-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              vendorId,
              customerId,
              petId: effectivePetId ?? null,
              serviceId: resolvedServiceId || serviceId,
              amount: amountToCharge,
              serviceName,
              vendorName,
              petName: effectivePetName,
            });
            const bid = instantRes?.bookingId;
            if (!bid) {
              throw new Error(instantRes?.error || 'Instant booking creation failed');
            }
            toast.success('Payment successful! Connecting to vet...');
            setProcessing(false);
            onSuccess(bid, response.razorpay_order_id, undefined, { isInstantTele: true });
            return;
          }

          // âœ… Queue-accepted tele: booking already exists, confirm payment and update status
          if (type === 'booking' && flowType === 'tele-queue-accepted' && currentBookingId) {
            const confirmRes = await apiClient.post<any>('/customer/tele/confirm-payment', {
              bookingId: currentBookingId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            if (!confirmRes?.success) {
              throw new Error(confirmRes?.error || 'Payment confirmation failed');
            }
            toast.success('Payment successful! Connecting to vet...');
            setProcessing(false);
            onSuccess(currentBookingId, response.razorpay_order_id, undefined, { isInstantTele: true });
            return;
          }

          // âœ… If booking creation was deferred, create booking now with payment info
          if (type === 'booking' && bookingCreationDeferred && deferredBookingPayload) {
            const createPayload = {
              ...deferredBookingPayload,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              ...(useWallet && (walletAmount || 0) > 0
                ? {
                    useWallet: true,
                    walletAmount: Math.round((walletAmount || 0) * 100) / 100,
                  }
                : {}),
            };
            console.log('ðŸ”„ Creating booking after payment:', createPayload);
            const bookingRes = await apiClient.post<any>('/bookings/create', createPayload);
            const bookingIdValue = extractBookingIdFromResponse(bookingRes, 'After Razorpay payment');
            if (!bookingIdValue) {
              console.error('âŒ No booking ID after payment:', bookingRes);
              throw new Error('Payment succeeded but booking creation failed. Please contact support.');
            }
            currentBookingId = bookingIdValue;
            bookingCreationDeferred = false;
          }

          // âœ… Step 2: Apply coupon if used
          if (appliedCoupon) {
            try {
              await apiClient.post('/coupons/apply', {
                couponCode: appliedCoupon.code,
                bookingId: currentBookingId,
                orderId: currentOrderId,
                customerId,
                amount: amountToCharge,
              });
              console.log('âœ… [COUPON] Applied successfully');
            } catch (couponErr) {
              console.warn('âš ï¸ [COUPON] Failed to apply:', couponErr);
              // Don't block payment success if coupon fails
            }
          }

          // âœ… Step 3: Apply promotion if used
          if (appliedPromotion) {
            try {
              await apiClient.post('/promotions/apply', {
                promotionId: appliedPromotion.id,
                bookingId: currentBookingId,
                orderId: currentOrderId,
                customerId,
                amount: amountToCharge,
              });
              console.log('âœ… [PROMOTION] Applied successfully');
            } catch (promoErr) {
              console.warn('âš ï¸ [PROMOTION] Failed to apply:', promoErr);
              // Don't block payment success if promotion fails
            }
          }

          // âœ… Step 4: Generate OTP for eligible bookings
          let otpCode: string | undefined = undefined;
          if (type === 'booking' && serviceStyle !== 'tele') {
            try {
              otpCode = await generateBookingOTP(currentBookingId || '', customerId);
              console.log('âœ… [OTP] Generated successfully');
            } catch (otpErr) {
              console.warn('âš ï¸ [OTP] Failed to generate:', otpErr);
              // Don't block payment success if OTP fails
            }
          }

          // âœ… Step 5: Success - booking is now confirmed
          console.log('âœ… [PAYMENT] Complete! Booking confirmed:', currentBookingId);
          toast.success('Payment successful! Booking confirmed.');
          setProcessing(false);
          onSuccess(currentBookingId || '', currentOrderId, otpCode, getPaymentSuccessMeta(
            verifyRes?.paymentMethod ||
              verifyRes?.payment_method ||
              verifyRes?.data?.paymentMethod ||
              verifyRes?.data?.payment_method
          ));
        } catch (err: any) {
          console.error('âŒ [PAYMENT] Verification failed:', err);
          const errorMessage = err?.response?.data?.error || err?.message || 'Payment verification failed';
          toast.error(`${errorMessage}. Please contact support with order ID: ${response.razorpay_order_id}`);
          setProcessing(false);
        }
      };

      const bookingIdForSlotReleaseOnDismiss: string | undefined =
        type === 'booking' &&
        flowType !== 'tele-instant' &&
        typeof currentBookingId === 'string' &&
        currentBookingId.length > 0 &&
        !bookingCreationDeferred
          ? currentBookingId
          : undefined;

      const releaseSlotIfCheckoutAbandoned = async () => {
        const bid = bookingIdForSlotReleaseOnDismiss;
        if (!bid || razorpayGatewaySuccessHandled || razorpayPaymentFailed) return;

        toast.info('Payment not completed. Complete payment from My Bookings within 5 minutes to keep your slot.');
        try {
          onPaymentAbandoned?.();
        } catch (cbErr) {
          console.warn('[PAYMENT] onPaymentAbandoned failed:', cbErr);
        }
      };

      const options: Record<string, unknown> = {
        key: keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY,
        amount: amountPaise,
        currency: 'INR',
        name: 'Warmpawz',
        description: paymentDescription,
        order_id: razorpayOrderId,
        handler: async (response: any) => {
          razorpayGatewaySuccessHandled = true;
          await processRazorpaySuccess(response);
        },
        theme: { color: '#FF8C42' },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            void releaseSlotIfCheckoutAbandoned();
          },
        },
      };
      // UPI display block (collect/intent/qr) + method.upi=true is what surfaces
      // GPay/PhonePe/Paytm intents on Capacitor Android WebView. The legacy
      // `banks` block hid UPI on many Android builds. When the user has
      // pre-entered a VPA, fall back to default layout + `prefill.vpa` (Razorpay
      // Payment Linkâ€“style) so collect runs straight through without the picker.
      if (!validPrefillVpa) {
        options.config = getWarmpawzRazorpayUpiDisplayConfig();
        options.method = { upi: true };
      }
      if (Object.keys(razorpayPrefill).length > 0) {
        options.prefill = razorpayPrefill;
      }
      if (validPrefillVpa) {
        options.method = 'upi';
      }

      console.log('ðŸš€ [PAYMENT] Opening Razorpay checkout...', {
        razorpayOrderId,
        amount: amountToCharge,
        keyId: keyId ? `${keyId.substring(0, 8)}...` : 'missing',
        nativeHost: isWarmpawzCustomerNativeWebView(),
      });

      if (isWarmpawzCustomerNativeWebView()) {
        const w = window as unknown as { ReactNativeWebView?: { postMessage: (s: string) => void } };
        const nativeOpenPayload: Record<string, unknown> = {
          description: paymentDescription,
          currency: 'INR',
          key: keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY,
          amount: amountPaise,
          name: 'Warmpawz',
          order_id: razorpayOrderId,
          ...(Object.keys(razorpayPrefill).length > 0 ? { prefill: razorpayPrefill } : {}),
          theme: { color: '#FF8C42' },
          // Keep parity with web `new Razorpay(options)` â€” UPI display block
          // (collect/intent/qr) + `method: { upi: true }` is what surfaces UPI
          // on react-native-razorpay too. With a manual VPA, switch to single
          // `method: 'upi'` + `prefill.vpa` for a straight collect flow.
          ...(!validPrefillVpa
            ? { config: getWarmpawzRazorpayUpiDisplayConfig(), method: { upi: true as const } }
            : { method: 'upi' as const }),
        };
        try {
          const resultPromise = waitForWarmpawzNativeRazorpayResult();
          w.ReactNativeWebView!.postMessage(
            JSON.stringify({ type: WARMPAWZ_RAZORPAY_NATIVE_MSG.OPEN, payload: nativeOpenPayload })
          );
          const nativeResponse = await resultPromise;
          razorpayGatewaySuccessHandled = true;
          await processRazorpaySuccess(nativeResponse);
        } catch (nativeErr: any) {
          const msg = nativeErr?.message || 'Payment cancelled';
          if (msg === 'Payment cancelled' || msg.toLowerCase().includes('cancel')) {
            toast.info('Payment cancelled');
            void releaseSlotIfCheckoutAbandoned();
          } else {
            toast.error(msg);
          }
          setProcessing(false);
        }
      } else {
        // âœ… FIX: Double-check Razorpay is available before opening (browser / PWA)
        if (!window.Razorpay) {
          console.error('âŒ [PAYMENT] Razorpay not available after script load');
          throw new Error('Payment gateway not loaded. Please refresh the page and try again.');
        }

        try {
          const razorpay = new window.Razorpay(sanitizeRazorpayInstanceOptions(options));
          // âœ… Listen for payment failures (these don't trigger the handler callback)
          razorpay.on('payment.failed', (resp: any) => {
            razorpayPaymentFailed = true;
            console.error('âŒ [RAZORPAY] Payment failed event:', {
              code: resp?.error?.code,
              description: resp?.error?.description,
              source: resp?.error?.source,
              step: resp?.error?.step,
              reason: resp?.error?.reason,
              orderId: resp?.error?.metadata?.order_id,
              paymentId: resp?.error?.metadata?.payment_id,
            });
            toast.error(`Payment failed: ${resp?.error?.description || 'Unknown error'}. Please try again.`);
            setProcessing(false);
          });
          razorpay.open();
          console.log('âœ… [PAYMENT] Razorpay checkout opened successfully');
        } catch (openError: any) {
          console.error('âŒ [PAYMENT] Failed to open Razorpay checkout:', openError);
          throw new Error(`Failed to open payment gateway: ${openError.message || 'Unknown error'}`);
        }
      }

    } catch (error: any) {
      console.error('âŒ Payment error:', error);
      console.error('âŒ Error response:', error?.response);
      console.error('âŒ Error data:', error?.response?.data);
      console.error('âŒ Error status:', error?.status);
      console.error('âŒ Error message:', error?.message);

      // Extract detailed error message
      const errorData = error?.response?.data || error?.data;
      let errorMessage = error.message || 'Payment failed';

      if (errorData?.data?.errors && Array.isArray(errorData.data.errors)) {
        const validationErrors = errorData.data.errors.map((e: any) => {
          const path = e.path?.join('.') || e.path || 'unknown';
          return `${path}: ${e.message}`;
        }).join(', ');
        errorMessage = `Payment validation failed: ${validationErrors}`;
        console.error('âŒ Validation errors:', errorData.data.errors);
      } else if (errorData?.errors && Array.isArray(errorData.errors)) {
        const validationErrors = errorData.errors.map((e: any) => {
          const path = e.path?.join('.') || e.path || 'unknown';
          return `${path}: ${e.message}`;
        }).join(', ');
        errorMessage = `Payment validation failed: ${validationErrors}`;
        console.error('âŒ Validation errors:', errorData.errors);
      } else if (errorData?.error || errorData?.message) {
        errorMessage = errorData.error || errorData.message;
      }

      toast.error(errorMessage);
      setProcessing(false);
    }
  };

  const generateBookingOTP = async (bookingId: string, customerIdParam?: string): Promise<string | undefined> => {
    // Only generate OTP for home and center services
    if (serviceStyle === 'tele' || serviceStyle === 'ecom') {
      return undefined;
    }

    try {
      const otpRes = await apiClient.post<any>('/bookings/generate-otp', {
        bookingId,
        serviceStyle,
        customerId: customerIdParam || customerId || undefined,
      });

      if (otpRes.success && otpRes.otp) {
        return otpRes.otp;
      }
    } catch (error) {
      console.error('Error generating OTP:', error);
    }

    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  if (loading) {
    const loadingShell = fillViewport
      ? appShell
        ? 'fixed inset-x-0 top-0 bottom-[var(--customer-footer-offset)] z-[60] flex items-center justify-center bg-[#FAF6F0]'
        : 'fixed inset-0 z-[60] flex items-center justify-center bg-[#FAF6F0]'
      : `flex min-h-[100dvh] w-full max-w-customer mx-auto items-center justify-center ${paymentPageBgClass}`;
    return (
      <div className={loadingShell}>
        <Loader2 className="h-12 w-12 animate-spin text-[#FF8C42]" />
      </div>
    );
  }

  // âœ… Derive display values from selectedServices when available (universal payment for all flows)
  const effectiveSelectedServices = selectedServices && selectedServices.length > 0
    ? selectedServices
    : null;
  const firstServiceFromArray = effectiveSelectedServices?.[0];

  const displayName = serviceName || productName
    || firstServiceFromArray?.name || firstServiceFromArray?.serviceName
    || 'Service';
  const displayDescription = serviceDescription || firstServiceFromArray?.description || '';
  const displayAmount = isMealPay
    ? resolvedMealPayTotal
    : Number(baseAmount) ||
      (effectiveSelectedServices
        ? effectiveSelectedServices.reduce((sum: number, s: any) => sum + (Number(s.price) || 0), 0)
        : 0);
  const displayDuration = (duration != null && (typeof duration !== 'string' || duration !== ''))
    ? Number(duration)
    : (effectiveSelectedServices
      ? effectiveSelectedServices.reduce((sum: number, s: any) => sum + (Number(s.duration) || 0), 0)
      : firstServiceFromArray?.duration);

  /** Keep in sync with globals.css --customer-footer-offset + .cw-fixed-above-customer-tabbar */
  /** Matches --customer-sticky-cta-scroll-padding (footer + fixed pay strip) */
  const mainBottomPadding = appShell
    ? 'cw-scroll-pad-tabbar-sticky-cta'
    : 'pb-[calc(10.5rem+env(safe-area-inset-bottom,0px))]';

  const paymentStats = [
    {
      value: formatPriceWithSymbol(displayAmount),
      label: 'Due',
      icon: 'wallet' as const,
    },
    {
      value:
        displayDuration != null && !Number.isNaN(Number(displayDuration))
          ? `${displayDuration} min`
          : '—',
      label: 'Duration',
      icon: 'clock' as const,
    },
    {
      value:
        type === 'meal_subscription' || type === 'meal_one_time'
          ? 'Meal plan'
          : type === 'booking'
            ? 'Booking'
            : 'Order',
      label: 'Type',
      icon: 'calendar' as const,
    },
  ];

  const viewportShellClass = fillViewport
    ? appShell
      ? 'fixed inset-x-0 top-0 bottom-[var(--customer-footer-offset)] z-[80] bg-[#FAF6F0]'
      : 'fixed inset-0 z-[80] bg-[#FAF6F0]'
    : `relative flex min-h-[100dvh] w-full ${paymentPageBgClass}`;

  /** No rounded sheet — column is layout only; cream bg lives on viewport shell + main/footer */
  const pageColumnClass =
    'mx-auto flex h-full min-h-0 w-full max-w-customer flex-col';

  return (
    <>
    <div className={viewportShellClass}>
      <div className={pageColumnClass}>
      <PaymentPageHeader className="shrink-0" onBack={onBack} stats={paymentStats} />

      <main
        className={`min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#FAF6F0] px-4 pt-4 ${mainBottomPadding}`}
      >
        {/* Address Selection (if needed and on top) */}
        {showAddressSelection && (
          <div className={paymentSecondaryCardClass}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#FF8C42]" />
                <h2 className="font-semibold text-gray-900">Delivery Address</h2>
              </div>
              <button
                onClick={() => setShowAddressModal(true)}
                className="text-sm text-[#FF8C42] font-medium hover:underline"
              >
                Change
              </button>
            </div>

            {selectedAddress ? (
              <div className="rounded-xl bg-[#FAF6F0] p-3 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
                <p className="font-medium text-gray-900">{selectedAddress.label || 'Home'}</p>
                <p className="text-sm text-gray-600">
                  {selectedAddress.addressLine1 || selectedAddress.address}, {selectedAddress.city} - {selectedAddress.pincode}
                </p>
              </div>
            ) : (
              <button
                onClick={() => setShowAddressModal(true)}
                className="w-full p-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-[#FF8C42] transition"
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Add Address
              </button>
            )}
          </div>
        )}

        {type === 'booking' && (vendorName || vendorAddress || staffName || staffPhoto) && (
          <PaymentProviderSection
            vendorName={vendorName || 'Provider'}
            vendorAddress={vendorAddress}
            staffName={staffName}
            staffPhoto={staffPhoto}
            serviceStyle={serviceStyle}
            vendorTagline={vendorTagline}
            vendorIsVerified={vendorIsVerified}
          />
        )}

        {type === 'meal_subscription' || type === 'meal_one_time' ? (
          <MealSubscriptionPaymentSummary
            planTitle={String(serviceName || productName || 'Meal plan')}
            vendorName={String(vendorName || '')}
            lines={mealSubscriptionSummaryLines || []}
            totalInr={resolvedMealPayTotal}
          />
        ) : (
          <PaymentBookingSummarySection
            summaryTitle={type === 'booking' ? 'Booking Summary' : 'Order Summary'}
            displayName={displayName}
            vendorName={vendorName}
            displayDescription={displayDescription}
            displayAmount={displayAmount}
            displayDuration={displayDuration}
            quantity={quantity}
            petName={effectivePetName}
            serviceStyle={serviceStyle}
            category={category}
            selectedServices={effectiveSelectedServices}
            includedSummary={includedSummary}
            includedItems={includedItems}
            bookingDate={type === 'booking' ? bookingDate : undefined}
            bookingTime={type === 'booking' ? bookingTime : undefined}
            showInlineAddress={
              ((serviceStyle === 'at_home' && type === 'booking') || type === 'order') && !!selectedAddress
            }
            selectedAddress={selectedAddress}
          />
        )}

        {/* Wallet Section â€” right after booking summary */}
        {wallet && wallet.balance > 0 && (
          <div className={paymentSecondaryCardClass}>
            <button
              onClick={() => setUseWallet(!useWallet)}
              className={`w-full flex items-center justify-between rounded-xl p-3 shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-all duration-150 active:scale-[0.98] touch-manipulation ${useWallet ? 'bg-green-50 ring-2 ring-green-500/40' : 'bg-[#FAF6F0]'
                }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${useWallet ? 'bg-green-100' : 'bg-orange-100'
                  }`}>
                  <Wallet className={`w-5 h-5 ${useWallet ? 'text-green-600' : 'text-[#FF8C42]'}`} />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">Warmpawz Wallet</p>
                  <p className="text-sm text-gray-500">
                    Balance: ₹{wallet.balance.toFixed(2)}
                    {wallet.loyaltyPoints && ` • ${wallet.loyaltyPoints} points`}
                  </p>
                </div>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${useWallet ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300'
                }`}>
                {useWallet && <CheckCircle2 className="w-4 h-4" />}
              </div>
            </button>
            {useWallet && (
              <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                ₹{walletAmount.toFixed(2)} will be deducted from wallet
              </p>
            )}
          </div>
        )}

        {/* Promotions & Spotlight Offers — bookings auto-apply (read-only) */}
        {type !== 'meal_subscription' && type !== 'meal_one_time' && promotions.length > 0 && (
          <div className={paymentSecondaryCardClass}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-[#FF8C42]" />
              <h2 className="font-semibold text-gray-900">
                {type === 'booking' ? 'Applied Offers' : 'Available Offers'}
              </h2>
            </div>

            <div className="space-y-2">
              {promotions.map((promo) => (
                type === 'booking' ? (
                  <div
                    key={promo.id}
                    className="w-full text-left p-3 rounded-xl border-2 border-green-500 bg-green-50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-gray-900">{promo.title}</h3>
                          <Badge className="bg-green-600 text-white text-xs">Auto-applied</Badge>
                        </div>
                        <p className="text-sm font-medium text-green-600 mt-1">
                          Save ₹{promo.discountAmount.toFixed(2)}
                        </p>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    </div>
                  </div>
                ) : (
                <button
                  key={promo.id}
                  onClick={() => applyPromotion(promo)}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all duration-150 active:scale-[0.98] touch-manipulation ${appliedPromotion?.id === promo.id
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-[#FF8C42]'
                    }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900">{promo.title}</h3>
                        {promo.type === 'spotlight' && (
                          <Badge className="bg-[#FF8C42] text-white text-xs">Spotlight</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{promo.description}</p>
                      <p className="text-sm font-medium text-green-600 mt-1">
                        Save ₹{promo.discountAmount.toFixed(2)}
                      </p>
                    </div>
                    {appliedPromotion?.id === promo.id && (
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    )}
                  </div>
                </button>
                )
              ))}
            </div>
          </div>
        )}

        {/* Coupon Section — orders only (bookings use auto-apply promotions) */}
        {type !== 'meal_subscription' && type !== 'meal_one_time' && type !== 'booking' && (
        <div className={paymentSecondaryCardClass}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-[#FF8C42]" />
              <h2 className="font-semibold text-gray-900">Coupons & Discounts</h2>
            </div>
          </div>

          {appliedCoupon ? (
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <div>
                  <p className="font-medium text-green-700">{appliedCoupon.code}</p>
                  <p className="text-sm text-green-600">You save ₹{appliedCoupon.discountAmount.toFixed(2)}</p>
                </div>
              </div>
              <button onClick={removeCoupon} className="text-red-500 hover:text-red-700">
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : showCouponInput ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Enter coupon code"
                  className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none uppercase"
                />
                <Button
                  onClick={handleApplyCoupon}
                  disabled={couponLoading}
                  className="bg-[#FF8C42] hover:bg-[#E67A35] text-white px-6"
                >
                  {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                </Button>
              </div>
              <button
                onClick={() => setShowCouponInput(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCouponInput(true)}
              className="w-full flex items-center justify-between p-3 border-2 border-dashed border-gray-200 rounded-xl hover:border-[#FF8C42] transition-all duration-150 active:scale-[0.98] touch-manipulation"
            >
              <span className="text-gray-600">Have a coupon code?</span>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>
        )}

        {/* Razorpay Offers */}
        {type !== 'meal_subscription' && type !== 'meal_one_time' && razorpayOffers.length > 0 && (
          <div className={paymentSecondaryCardClass}>
            <div className="flex items-center gap-2 mb-3">
              <Gift className="w-5 h-5 text-blue-500" />
              <h2 className="font-semibold text-gray-900">Payment Offers</h2>
            </div>

            <div className="space-y-2">
              {razorpayOffers.map((offer) => (
                <button
                  key={offer.id}
                  onClick={() => applyRazorpayOffer(offer)}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all duration-150 active:scale-[0.98] touch-manipulation ${selectedRazorpayOffer?.id === offer.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                    }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{offer.title}</h3>
                      <p className="text-sm text-gray-600">{offer.description}</p>
                      {offer.discountType === 'cashback' && (
                        <p className="text-sm font-medium text-blue-600 mt-1">
                          Get ₹{offer.discountValue} cashback
                        </p>
                      )}
                    </div>
                    {selectedRazorpayOffer?.id === offer.id && (
                      <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Price Breakdown */}
        <div className={paymentSecondaryCardClass}>
          <h2 className="font-semibold text-gray-900 mb-4">Price Details</h2>
          {priceIncludesTax && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
              List price includes GST. Taxable value and GST below add up to the amount you pay (before coupons/wallet).
            </p>
          )}

          <div className="space-y-3">
            <div className="flex justify-between text-gray-600">
              <span>{priceIncludesTax ? 'Taxable value (excl. GST)' : 'Subtotal'}</span>
              <span>₹{taxBreakdown.subtotal.toFixed(2)}</span>
            </div>

            {/* âœ… FIX: Vendor Discount - Applied directly by vendor at service level */}
            {appliedPromotion && (
              <div className="flex justify-between text-green-600">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-4 h-4" />
                  <span className="font-medium">Vendor Offer:</span> {appliedPromotion.title}
                </span>
                <span className="font-medium">-₹{promotionDiscount.toFixed(2)}</span>
              </div>
            )}

            {/* âœ… FIX: Platform Coupon - Applied at checkout level by platform */}
            {appliedCoupon && (
              <div className="flex justify-between text-blue-600">
                <span className="flex items-center gap-1">
                  <Percent className="w-4 h-4" />
                  <span className="font-medium">Platform Coupon:</span> {appliedCoupon.code}
                </span>
                <span className="font-medium">-₹{couponDiscount.toFixed(2)}</span>
              </div>
            )}

            {/* GST Breakdown */}
            {taxBreakdown.isInterState ? (
              <div className="flex justify-between text-gray-600">
                <span className="flex items-center gap-1">
                  IGST ({taxBreakdown.taxRate}%)
                  <Info className="w-3 h-3 text-gray-400" />
                </span>
                <span>₹{taxBreakdown.igst.toFixed(2)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-gray-600">
                  <span className="flex items-center gap-1">
                    CGST ({taxBreakdown.taxRate / 2}%)
                  </span>
                  <span>₹{taxBreakdown.cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span className="flex items-center gap-1">
                    SGST ({taxBreakdown.taxRate / 2}%)
                  </span>
                  <span>₹{taxBreakdown.sgst.toFixed(2)}</span>
                </div>
              </>
            )}

            {/* âœ… FIX GAP-7.1: Platform Discount (shown separately from vendor discount) */}
            {appliedPromotion && promotionDiscount > 0 && (
              <div className="flex justify-between text-blue-600">
                <span className="flex items-center gap-1">
                  <Gift className="w-4 h-4" />
                  Platform Discount
                </span>
                <span>-₹{promotionDiscount.toFixed(2)}</span>
              </div>
            )}

            {/* Platform Fees */}
            {platformFees.platformFee > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-gray-600">
                  <span className="flex items-center gap-1">
                    Platform Fee
                    <Info className="w-3 h-3 text-gray-400 cursor-help" aria-label="Platform service charge" />
                  </span>
                  <span>₹{platformFees.platformFee.toFixed(2)}</span>
                </div>
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5">
                  Platform fee is not refundable.
                </p>
              </div>
            )}

            {platformFees.convenienceFee > 0 && (
              <div className="flex justify-between text-gray-600">
                <span className="flex items-center gap-1">
                  Convenience Fee
                  <Info className="w-3 h-3 text-gray-400 cursor-help" aria-label="Online booking convenience charge" />
                </span>
                <span>₹{platformFees.convenienceFee.toFixed(2)}</span>
              </div>
            )}

            {platformFees.deliveryFee > 0 && type !== 'meal_subscription' && type !== 'meal_one_time' && (
              <div className="flex justify-between text-gray-600">
                <span className="flex items-center gap-1">
                  Delivery Fee
                </span>
                <span>₹{platformFees.deliveryFee.toFixed(2)}</span>
              </div>
            )}

            {platformFees.packagingFee > 0 && (
              <div className="flex justify-between text-gray-600">
                <span className="flex items-center gap-1">
                  Packaging Fee
                </span>
                <span>₹{platformFees.packagingFee.toFixed(2)}</span>
              </div>
            )}

            {/* Razorpay Offer Discount */}
            {selectedRazorpayOffer && (
              <div className="flex justify-between text-blue-600">
                <span className="flex items-center gap-1">
                  <Gift className="w-4 h-4" />
                  {selectedRazorpayOffer.title}
                </span>
                <span>-₹{razorpayOfferDiscount.toFixed(2)}</span>
              </div>
            )}

            {/* Wallet */}
            {useWallet && walletAmount > 0 && (
              <div className="flex justify-between text-green-600">
                <span className="flex items-center gap-1">
                  <Wallet className="w-4 h-4" />
                  Wallet
                </span>
                <span>-₹{walletAmount.toFixed(2)}</span>
              </div>
            )}

            <div className="mt-4 border-t border-[#EDE9E3] pt-4">
              <div className="flex justify-between text-lg font-bold">
                <span className="text-gray-900">Total Amount</span>
                <span className="text-[#FF8C42]">₹{finalAmount.toFixed(2)}</span>
              </div>
              {(promotionDiscount > 0 || couponDiscount > 0 || walletAmount > 0 || razorpayOfferDiscount > 0) && (
                <p className="text-sm text-green-600 mt-1">
                  You save ₹{(promotionDiscount + couponDiscount + walletAmount + razorpayOfferDiscount).toFixed(2)} on this {type}!
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Payment & refund policy summary (dynamic from backend) */}
        {(refundPolicySummary || (paymentPolicies && Object.keys(paymentPolicies).length > 0)) && (
          <div className={paymentSecondaryCardClass}>
            {refundPolicySummary && (
              <p className="text-xs text-gray-600 mb-2">
                <span className="font-medium text-gray-700">Cancellation: </span>
                {refundPolicySummary}
              </p>
            )}
            {paymentPolicies?.payment && (
              <p className="text-xs text-gray-600">
                <span className="font-medium text-gray-700">Payment: </span>
                {paymentPolicies.payment.description}
              </p>
            )}
          </div>
        )}

        {/* Saved Payment Methods */}
        {savedMethods.length > 0 && (
          <div className={paymentSecondaryCardClass}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Saved Payment Methods</h2>
              <button
                onClick={() => setShowAddPaymentModal(true)}
                className="text-sm text-[#FF8C42] font-medium hover:underline flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add New
              </button>
            </div>

            <div className="space-y-3">
              {savedMethods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setSelectedMethod(method.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all duration-150 active:scale-[0.98] touch-manipulation ${selectedMethod === method.id ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      {method.type === 'card' ? (
                        <CreditCard className="w-5 h-5 text-gray-600" />
                      ) : method.type === 'upi' ? (
                        <Smartphone className="w-5 h-5 text-gray-600" />
                      ) : (
                        <CreditCard className="w-5 h-5 text-gray-600" />
                      )}
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-900">
                        {method.type === 'card'
                          ? `${method.brand || 'Card'} •••• ${method.last4}`
                          : method.type === 'upi'
                            ? method.upiId
                            : method.bankName}
                      </p>
                      {method.isDefault && (
                        <span className="text-xs text-[#FF8C42]">Default</span>
                      )}
                    </div>
                  </div>
                  {selectedMethod === method.id && (
                    <CheckCircle2 className="w-5 h-5 text-[#FF8C42]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pay with Razorpay (default) */}
        <div className={paymentSecondaryCardClass}>
          <button
            onClick={() => setSelectedMethod('razorpay')}
            className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all duration-150 active:scale-[0.98] touch-manipulation ${selectedMethod === 'razorpay' ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
              }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Pay with Razorpay</p>
                <p className="text-xs text-gray-500">Cards, UPI, NetBanking, Wallets</p>
              </div>
            </div>
            {selectedMethod === 'razorpay' && (
              <CheckCircle2 className="w-5 h-5 text-[#FF8C42]" />
            )}
          </button>

          {selectedMethod === 'razorpay' && (
            <button
              onClick={() => setShowAddPaymentModal(true)}
              className="mt-3 w-full text-sm text-[#FF8C42] font-medium hover:underline flex items-center justify-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Save card for faster checkout
            </button>
          )}

          {selectedMethod === 'razorpay' && (
            <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
              <label htmlFor="warmpawz-upi-vpa" className="text-xs font-medium text-gray-700">
                UPI ID (optional)
              </label>
              <Input
                id="warmpawz-upi-vpa"
                type="text"
                inputMode="email"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="e.g. yourname@paytm"
                value={manualUpiVpa}
                onChange={(e) => setManualUpiVpa(e.target.value)}
                className="rounded-xl border-gray-200"
              />
              <p className="text-[11px] leading-snug text-gray-500">
                If entered, we pass this to Razorpay as <span className="font-mono">prefill.vpa</span>. Desktop checkout often
                stays QR-first; try mobile browser if collect does not appear â€” per Razorpay/NPCI rules.
              </p>
            </div>
          )}
        </div>

        {/* OTP Notice for Home/Center services */}
        {type === 'booking' && serviceStyle !== 'tele' && serviceStyle !== 'ecom' && (
          <div className="rounded-[20px] bg-blue-50 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Booking OTP</p>
                <p className="text-sm text-blue-700">
                  After payment, you'll receive a 4-digit OTP. Share this with the service provider
                  {serviceStyle === 'at_home' ? ' when they arrive at your location' : ' at the clinic'}
                  to start the service. This OTP completes the booking and releases payment to the provider.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Sticky pay bar — sits on page background, not inside scroll area */}
      <footer
        className="shrink-0 bg-[#FAF6F0] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0.75rem))] shadow-[0_-8px_30px_rgba(0,0,0,0.06)]"
        role="region"
        aria-label="Payment actions"
      >
          <div className="space-y-2">
            <Button
              onClick={() => handlePayment()}
              disabled={processing || serviceIdResolving || (showAddressSelection && !selectedAddress)}
              className="h-auto w-full rounded-full bg-gradient-to-r from-[#FF8C42] to-[#FF7029] px-6 py-4 text-lg font-bold text-white shadow-[0_8px_24px_rgba(255,107,53,0.35)] transition-all duration-150 hover:from-[#E67A35] hover:to-[#D66A25] active:scale-[0.98] touch-manipulation disabled:opacity-50"
            >
              {processing || serviceIdResolving ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {serviceIdResolving ? 'Preparing...' : 'Processing...'}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Shield className="h-5 w-5" />
                  {finalAmount === 0
                    ? `Confirm ${type === 'booking' ? 'Booking' : 'Order'}`
                    : `Pay ₹${finalAmount.toFixed(2)}`}
                </span>
              )}
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-gray-500">
              <Shield className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />
              Secured by Razorpay • 100% Safe Payments
            </p>
          </div>
      </footer>
      </div>
    </div>

    {/* Address Selection Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="w-full max-w-customer bg-white rounded-t-3xl max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
              <h3 className="font-bold text-lg">Select Address</h3>
              <button onClick={() => setShowAddressModal(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {addresses.map((addr) => (
                <button
                  key={addr.id}
                  onClick={() => {
                    setSelectedAddress(addr);
                    setShowAddressModal(false);
                  }}
                  className={`w-full text-left p-4 rounded-xl border-2 transition ${selectedAddress?.id === addr.id
                    ? 'border-[#FF8C42] bg-orange-50'
                    : 'border-gray-200 hover:border-[#FF8C42]'
                    }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{addr.label || 'Address'}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {addr.addressLine1 || addr.address}, {addr.city} - {addr.pincode}
                      </p>
                    </div>
                    {selectedAddress?.id === addr.id && (
                      <CheckCircle2 className="w-5 h-5 text-[#FF8C42] flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}
              <button
                onClick={() => {
                  // Navigate to add address
                  setShowAddressModal(false);
                  // onNavigate('add-address') - would need navigation handler
                }}
                className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl text-[#FF8C42] font-medium hover:border-[#FF8C42] transition"
              >
                <Plus className="w-5 h-5 inline mr-2" />
                Add New Address
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Method Modal */}
      {showAddPaymentModal && (
        <AddPaymentMethodModal
          customerPhone={customerPhone}
          customerId={customerId}
          onClose={() => setShowAddPaymentModal(false)}
          onSuccess={() => {
            // Refresh payment methods after saving
            loadPaymentData();
            setShowAddPaymentModal(false);
          }}
        />
      )}

      {/* Policy Acceptance Modal */}
      <PolicyAcceptanceModal
        isOpen={showPolicyModal}
        onClose={() => setShowPolicyModal(false)}
        onAccept={() => {
          // âœ… FIX: Close modal first, then set policy accepted and proceed with payment
          // This ensures the modal closes immediately and payment proceeds without double-click
          setShowPolicyModal(false);
          setPolicyAccepted(true);
          // Call handlePayment with skipPolicyCheck=true to bypass the policy check
          // since we just accepted it in the modal
          handlePayment(true);
        }}
        bookingType={type === 'booking' ? 'service' : 'order'}
        vendorId={vendorId}
        serviceId={resolvedServiceId || serviceId} // Use resolved serviceId if available
        customerId={customerId}
      />
    </>
  );
}

export default UniversalPaymentPage;
