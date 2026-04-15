'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CreditCard, Wallet, Tag, ChevronRight, ChevronDown,
  CheckCircle2, Shield, X, Percent, Info, MapPin,
  Clock, Calendar, Plus, Smartphone, Building2,
  Home, Video, Gift, Sparkles, AlertCircle, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { AddPaymentMethodModal } from './AddPaymentMethodModal';
import { formatPriceWithSymbol } from '@/lib/booking-display-utils';
import { PolicyAcceptanceModal } from '../PolicyAcceptanceModal';
import { apiClient, getApiBaseUrl } from '@/lib/api-client';
import { resolveGstDisplayRatePercent } from '@/lib/resolve-gst-display-rate';
import { petsFromApiResponse } from '@/lib/extract-pets-from-api';
import { readAndConsumeCheckoutPetSelection } from '@/lib/checkout-pet-selection';
import { ServiceDashboardHeader } from '@/components/customer/shared/ServiceDashboardHeader';

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
  type: 'booking' | 'order';

  // Service/Product details
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
  vendorAddress?: string; // ✅ NEW: Vendor/clinic address for at_center services
  staffName?: string; // ✅ NEW: Staff name for at_home services
  staffPhoto?: string; // ✅ NEW: Staff photo for at_home services

  // Schedule (for bookings)
  bookingDate?: string;
  bookingTime?: string;

  // Pet (for bookings)
  petId?: string;
  petName?: string;
  petBreed?: string;
  /** When length > 1, shows an inline selector without changing the rest of the row layout */
  petSwitcherPets?: { id: string; name: string }[];
  /** Called when the user picks a pet from the switcher, or null for “no pet” (checkout still allowed). */
  onPetSwitcherChange?: (pet: { id: string; name: string } | null) => void;

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
  selectedServices?: any[]; // ✅ NEW: Selected services for multi-service bookings

  // Customer
  customerPhone: string;
  customerId?: string;

  /** 
   * tele-scheduled: normal scheduled tele booking
   * tele-instant: payment-first, then create booking via instant-after-payment (no queue)
   * tele-queue-accepted: queue-first flow; booking already exists with pending_payment; just collect payment and confirm
   */
  flowType?: 'tele-scheduled' | 'tele-instant' | 'tele-queue-accepted';

  /**
   * fullscreen: default; CTA hugs bottom (overlays, dedicated routes).
   * appShell: matches CustomerHomeWrapper + BottomNavigation — CTA sits above the tab bar.
   */
  layoutVariant?: 'fullscreen' | 'appShell';

  // Navigation
  onBack: () => void;
  onSuccess: (bookingId: string, orderId?: string, otpCode?: string, meta?: { isInstantTele?: boolean }) => void;
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
  type: 'spotlight' | 'category_discount' | 'service_discount' | 'flash_sale';
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

/** POST /tax/calculate used to return success:true with empty items + error — treat as failure so UI does not show 9%+9% with ₹0 tax. */
function taxCalculateResponseHasPayload(res: any): boolean {
  if (!res || res.success !== true) return false;
  const err = res.error;
  if (typeof err === 'string' && err.trim()) return false;
  if (err != null && typeof err === 'object') return false;
  return Array.isArray(res.items) && res.items.length > 0;
}

function petsListForPaymentPicker(data: unknown): { id: string; name: string }[] {
  return petsFromApiResponse(data).map((p) => ({ id: p.id, name: p.name }));
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
  bookingDate,
  bookingTime,
  petId,
  petName,
  petBreed,
  petSwitcherPets,
  onPetSwitcherChange,
  addressId,
  address,
  showAddressSelection = false,
  baseAmount,
  priceIncludesTax = false,
  duration,
  quantity = 1,
  selectedServices,
  customerPhone,
  customerId,
  flowType,
  layoutVariant = 'fullscreen',
  onBack,
  onSuccess,
}: UniversalPaymentPageProps) {
  const router = useRouter();
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

  // ✅ CRITICAL: Resolved serviceId (UUID) - resolved early to avoid issues
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
  const [razorpayOffers, setRazorpayOffers] = useState<RazorpayOffer[]>([]);
  const [selectedRazorpayOffer, setSelectedRazorpayOffer] = useState<RazorpayOffer | null>(null);
  const [paymentPolicies, setPaymentPolicies] = useState<Record<string, { title: string; description: string; details?: string[] }> | null>(null);
  const [refundPolicySummary, setRefundPolicySummary] = useState<string | null>(null);

  const [taxBreakdown, setTaxBreakdown] = useState<TaxBreakdown>({
    subtotal: baseAmount,
    cgst: 0,
    sgst: 0,
    igst: 0,
    totalTax: 0,
    total: baseAmount,
    taxRate: 18,
    isInterState: false,
  });

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
  const [fetchedPetsForPicker, setFetchedPetsForPicker] = useState<{ id: string; name: string }[]>([]);
  /** Bumps when user returns to this tab (e.g. after adding a pet on /pets) so the picker refetches. */
  const [petsListRefreshNonce, setPetsListRefreshNonce] = useState(0);
  const [localPetSelection, setLocalPetSelection] = useState<{ id: string; name: string } | null>(null);

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

  const calculateTax = useCallback(async () => {
    const catalogServiceId = resolvedServiceId || serviceId;
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
            id: catalogServiceId || productId || bookingId || 'item',
            type: type === 'booking' ? 'service' : 'product',
            serviceId: type === 'booking' ? catalogServiceId : undefined,
            bookingId: type === 'booking' ? bookingId : undefined,
            productId: type === 'order' ? productId : undefined,
            amount: baseAmount,
            quantity,
            category: category || 'pet_services',
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
    serviceId,
    serviceStyle,
    type,
    vendorId,
    priceIncludesTax,
  ]);

  useEffect(() => {
    loadPaymentData();
    loadRazorpayScript();
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
          console.log('✅ [SUBSCRIPTION] Booking covered by subscription:', coverageRes.subscription);
          setSubscriptionCovered(true);
          setActiveSubscription(coverageRes.subscription);

          // If subscription covers this booking, set amount to 0
          // The payment will be processed as a subscription booking
        }
      } catch (error: any) {
        // Subscription check failed - proceed with normal payment; surface so it's not silent
        console.log('ℹ️ [SUBSCRIPTION] No active subscription or check failed:', error.message);
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

  useEffect(() => {
    setLocalPetSelection(null);
  }, [bookingId, orderId, type]);

  const petListWasHiddenRef = useRef(false);
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') petListWasHiddenRef.current = true;
      if (document.visibilityState === 'visible' && petListWasHiddenRef.current) {
        setPetsListRefreshNonce((n) => n + 1);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (type !== 'booking' || petSwitcherPets !== undefined) return;
    let cancelled = false;
    (async () => {
      try {
        let list: { id: string; name: string }[] = [];
        if (customerId) {
          try {
            const res = await apiClient.get<unknown>(`/customer/${customerId}/pets`);
            list = petsListForPaymentPicker(res);
          } catch {
            list = [];
          }
        }
        if (!cancelled && list.length === 0 && customerPhone) {
          try {
            const byQuery = await apiClient.get<unknown>(
              `/customer/pets?phone=${encodeURIComponent(customerPhone)}`
            );
            list = petsListForPaymentPicker(byQuery);
          } catch {
            /* try path route next */
          }
        }
        if (!cancelled && list.length === 0 && customerPhone) {
          try {
            const byPath = await apiClient.get<unknown>(
              `/customer/pets/${encodeURIComponent(customerPhone)}`
            );
            list = petsListForPaymentPicker(byPath);
          } catch {
            list = [];
          }
        }
        if (!cancelled) setFetchedPetsForPicker(list);
      } catch {
        if (!cancelled) setFetchedPetsForPicker([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type, petSwitcherPets, customerId, customerPhone, petsListRefreshNonce]);

  useEffect(() => {
    if (type !== 'booking') return;
    const applyCheckoutSelection = () => {
      const payload = readAndConsumeCheckoutPetSelection();
      if (!payload) return;
      if ('skip' in payload) {
        if (onPetSwitcherChange) onPetSwitcherChange(null);
        else setLocalPetSelection(null);
        return;
      }
      const p = payload.pet;
      if (onPetSwitcherChange) onPetSwitcherChange({ id: p.id, name: p.name });
      else setLocalPetSelection({ id: p.id, name: p.name });
    };
    applyCheckoutSelection();
    const onVisible = () => {
      if (document.visibilityState === 'visible') applyCheckoutSelection();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', applyCheckoutSelection);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', applyCheckoutSelection);
    };
  }, [type, onPetSwitcherChange]);

  //  Resolve serviceId early (before payment flow)
  useEffect(() => {
    const resolveServiceId = async () => {
      if (!serviceId || !vendorId || type !== 'booking') {
        return; // Only resolve for bookings with serviceId
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      // If already a UUID, no need to resolve
      if (uuidRegex.test(serviceId)) {
        setResolvedServiceId(serviceId);
        return;
      }

      // If numeric, try to resolve
      console.log(`🔄 Resolving serviceId "${serviceId}" to UUID...`);
      setServiceIdResolving(true);

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
              console.log(`✅ [SERVICE-RESOLUTION] Found services from endpoint: ${endpoint}`);
              break;
            }
          } catch (e: any) {
            console.warn(`⚠️ [SERVICE-RESOLUTION] Endpoint ${endpoint} failed:`, e.message);
            continue; // Try next endpoint
          }
        }

        if (vendorServicesRes) {
          // ✅ CRITICAL: Handle different API response formats
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

          console.log('📦 [SERVICE-RESOLUTION-EARLY] Extracted services:', {
            count: services.length,
            sample: services[0],
            responseKeys: Object.keys(vendorServicesRes),
          });

          // Ensure services is an array before calling .find()
          if (!Array.isArray(services)) {
            console.error('❌ [SERVICE-RESOLUTION-EARLY] Services is not an array:', typeof services, services);
            // Don't throw - will be caught during payment
            return;
          }

          // Look for service with matching numeric ID
          const matchingService = services.find((s: any) =>
            s.id === serviceId ||
            s.serviceId === serviceId ||
            s.service_id === serviceId ||
            String(s.id) === String(serviceId) ||
            String(s.serviceId) === String(serviceId) ||
            String(s.service_id) === String(serviceId)
          );

          if (matchingService) {
            // ✅ FIX: Prioritize id (vendor_services.id) over service_id (services.id reference)
            // bookings.service_id must reference vendor_services.id, not services.id
            if (uuidRegex.test(matchingService.id)) {
              setResolvedServiceId(matchingService.id);
              console.log(`✅ Resolved serviceId "${serviceId}" to vendor_services.id: "${matchingService.id}"`);
            } else if (uuidRegex.test(matchingService.service_id || matchingService.serviceId)) {
              // Fallback: if id is not a UUID, try service_id (shouldn't happen normally)
            const resolved = matchingService.service_id || matchingService.serviceId;
              setResolvedServiceId(resolved);
              console.log(`✅ Resolved serviceId "${serviceId}" to service_id: "${resolved}"`);
            } else {
              console.warn(`⚠️ Could not resolve serviceId "${serviceId}" - service found but no UUID available`);
            }
          } else {
            console.warn(`⚠️ Service "${serviceId}" not found in vendor services`);
          }
        }
      } catch (error: any) {
        console.warn(`⚠️ Failed to resolve serviceId "${serviceId}":`, error.message);
        // Don't set error - will be caught during booking creation
      } finally {
        setServiceIdResolving(false);
      }
    };

    resolveServiceId();
  }, [serviceId, vendorId, type]);

  //  Pre-load Razorpay script on component mount so it's ready when user clicks payment
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.Razorpay) {
      console.log('🔄 [RAZORPAY] Pre-loading Razorpay script on component mount...');
      loadRazorpayScript().catch((error) => {
        console.warn('⚠️ [RAZORPAY] Failed to pre-load script (will retry on payment):', error.message);
        // Don't show error to user - will retry when payment button is clicked
      });
    } else if (window.Razorpay) {
      console.log('✅ [RAZORPAY] Razorpay script already loaded');
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

    console.log('[UniversalPaymentPage] 🔌 Setting up SSE to monitor vendor cancellation');

    const eventSource = new EventSource(sseUrl);

    // Listen for ended event (vendor cancels after accepting)
    eventSource.addEventListener('ended', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[UniversalPaymentPage] ❌ Booking ended/cancelled:', data);

        // Show error toast
        toast.error(data.message || 'This consultation has been cancelled. Please try another vet.');

        // Close SSE connection
        eventSource.close();

        // ✅ CRITICAL: Immediately rollback to previous page
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
        console.log('[UniversalPaymentPage] ❌ Vendor rejected/cancelled:', data);

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
      console.log('[UniversalPaymentPage] 🔌 SSE connection established');
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
      console.log('[UniversalPaymentPage] 🧹 Cleaning up SSE connection');
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
      // Load applicable promotions (public endpoint – no admin auth required)
      const promoRes = await apiClient.get<any>(
        `/promotions/applicable?category=${category || ''}&serviceStyle=${serviceStyle || ''}&amount=${baseAmount}`
      );

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

        const spotlight = applicablePromos.find((p: PromotionOffer) => p.type === 'spotlight');
        if (spotlight && spotlight.applicable) {
          setAppliedPromotion(spotlight);
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
  const promotionDiscount = appliedPromotion?.discountAmount || 0;
  const couponDiscount = appliedCoupon?.discountAmount || 0;
  const razorpayOfferDiscount = selectedRazorpayOffer?.discountValue || 0;

  // Apply discounts to subtotal (before tax for some, after tax for others - following standard practice)
  const subtotalAfterDiscounts = Math.max(0, taxBreakdown.subtotal - promotionDiscount - couponDiscount);

  // Recalculate tax on discounted amount if needed (or keep original tax - business logic)
  const finalTax = taxBreakdown.totalTax; // Or recalculate on discounted amount
  const totalAfterDiscounts = subtotalAfterDiscounts + finalTax + platformFees.total;

  const walletAmount = useWallet && wallet ? Math.min(wallet.balance, totalAfterDiscounts - razorpayOfferDiscount) : 0;

  // ✅ NEW: If subscription covers this booking, final amount is 0
  const finalAmount = subscriptionCovered ? 0 : Math.max(0, totalAfterDiscounts - razorpayOfferDiscount - walletAmount);

  const effectivePetsForPicker = petSwitcherPets ?? fetchedPetsForPicker;
  const effectivePetId = onPetSwitcherChange ? petId : (localPetSelection?.id ?? petId);
  const effectivePetName = onPetSwitcherChange ? petName : (localPetSelection?.name ?? petName);
  const selectedPetDisplayName =
    (effectivePetName?.trim() ||
      (effectivePetId && effectivePetsForPicker.some((x) => x.id === effectivePetId)
        ? effectivePetsForPicker.find((x) => x.id === effectivePetId)!.name.trim()
        : '')) || '';

  const handlePayment = async (skipPolicyCheck: boolean = false) => {
    // Check if policies have been accepted (for bookings)
    // ✅ FIX: Allow skipping policy check when called from modal acceptance
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
      let bookingCreationDeferred = false;
      let deferredBookingPayload: Record<string, unknown> | null = null;
      let requiredUpfrontAmount: number | null = null;

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

        // ✅ CRITICAL: Resolve serviceId to UUID BEFORE creating booking
        // This MUST happen synchronously here to ensure we have the UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        let finalServiceId = resolvedServiceId || serviceId;

        // ✅ FIX: If selectedServices is provided, use the first service's id (vendor_services.id)
        // This ensures we use vendor_services.id instead of services.id to match the foreign key constraint
        console.log(`🔍 [SERVICE-ID-RESOLUTION] Initial serviceId: "${serviceId}", resolvedServiceId: "${resolvedServiceId}", finalServiceId: "${finalServiceId}"`);
        console.log(`🔍 [SERVICE-ID-RESOLUTION] selectedServices:`, selectedServices);
        
        if (selectedServices && selectedServices.length > 0) {
          const firstSelectedService = selectedServices[0];
          console.log(`🔍 [SERVICE-ID-RESOLUTION] First selected service:`, {
            id: firstSelectedService.id,
            serviceId: firstSelectedService.serviceId,
            service_id: firstSelectedService.service_id,
            hasId: !!firstSelectedService.id,
            idIsUUID: firstSelectedService.id ? uuidRegex.test(String(firstSelectedService.id)) : false,
            hasServiceId: !!firstSelectedService.serviceId,
            serviceIdIsUUID: firstSelectedService.serviceId ? uuidRegex.test(String(firstSelectedService.serviceId)) : false,
            fullObject: firstSelectedService,
          });
          
          // ✅ CRITICAL: Prioritize id field (vendor_services.id) over serviceId (services.id)
          // The id field should be vendor_services.id which is what bookings.service_id FK requires
          const candidateId = firstSelectedService.id;
          const candidateServiceId = firstSelectedService.serviceId || firstSelectedService.service_id;
          
          if (candidateId && uuidRegex.test(String(candidateId))) {
            finalServiceId = String(candidateId);
            console.log(`✅ [SERVICE-ID-RESOLUTION] Using serviceId from selectedServices[0].id (vendor_services.id): "${finalServiceId}"`);
          } else if (candidateServiceId && uuidRegex.test(String(candidateServiceId))) {
            // ⚠️ WARNING: This might be services.id, not vendor_services.id
            // We'll use it but log a warning - the backend validation will catch if it's wrong
            finalServiceId = String(candidateServiceId);
            console.warn(`⚠️ [SERVICE-ID-RESOLUTION] Using serviceId from selectedServices[0].serviceId (might be services.id, not vendor_services.id): "${finalServiceId}"`);
          } else {
            console.warn(`⚠️ [SERVICE-ID-RESOLUTION] selectedServices[0] has no valid UUID in id or serviceId fields`);
          }
        } else {
          console.log(`ℹ️ [SERVICE-ID-RESOLUTION] No selectedServices provided, using finalServiceId: "${finalServiceId}"`);
        }
        
        console.log(`🔍 [SERVICE-ID-RESOLUTION] Final resolved serviceId before sync resolution: "${finalServiceId}"`);

        // ✅ CRITICAL: Only resolve if we don't already have a valid UUID from selectedServices
        // If selectedServices provided a valid UUID, skip the synchronous resolution to avoid overriding it
        const hasValidServiceIdFromSelectedServices = selectedServices && selectedServices.length > 0 && 
          selectedServices[0].id && uuidRegex.test(selectedServices[0].id);

        // If not a UUID, resolve it NOW (synchronously)
        // BUT skip if we already got a valid UUID from selectedServices
        if (!uuidRegex.test(finalServiceId) && !hasValidServiceIdFromSelectedServices) {
          console.log(`🔄 Resolving serviceId "${finalServiceId}" to UUID synchronously...`);

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
                  console.log(`✅ [SERVICE-RESOLUTION-SYNC] Found services from endpoint: ${endpoint}`);
                  break;
                }
              } catch (e: any) {
                console.warn(`⚠️ [SERVICE-RESOLUTION-SYNC] Endpoint ${endpoint} failed:`, e.message);
                continue; // Try next endpoint
              }
            }

            if (vendorServicesRes) {
              // ✅ CRITICAL: Handle different API response formats
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

              console.log('📦 [SERVICE-RESOLUTION] Extracted services:', {
                count: services.length,
                sample: services[0],
                responseKeys: Object.keys(vendorServicesRes),
              });

              // Ensure services is an array before calling .find()
              if (!Array.isArray(services)) {
                console.error('❌ [SERVICE-RESOLUTION] Services is not an array:', typeof services, services);
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
                // ✅ FIX: Prioritize id (vendor_services.id) over service_id (services.id reference)
                // bookings.service_id must reference vendor_services.id, not services.id
                if (uuidRegex.test(matchingService.id)) {
                  finalServiceId = matchingService.id;
                  setResolvedServiceId(matchingService.id);
                  console.log(`✅ Synchronously resolved serviceId "${serviceId}" to vendor_services.id: "${matchingService.id}"`);
                } else if (uuidRegex.test(matchingService.service_id || matchingService.serviceId)) {
                  // Fallback: if id is not a UUID, try service_id (shouldn't happen normally)
                const resolved = matchingService.service_id || matchingService.serviceId;
                  finalServiceId = resolved;
                  setResolvedServiceId(resolved);
                  console.log(`✅ Synchronously resolved serviceId "${serviceId}" to service_id: "${resolved}"`);
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
            console.error('❌ Failed to resolve serviceId:', resolveError);
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
            // ✅ FIX: Also extract coordinates from JSON coordinates field
            if (!addressLat && !addressLng && addr.coordinates) {
              try {
                const coords = typeof addr.coordinates === 'string' ? JSON.parse(addr.coordinates) : addr.coordinates;
                if (coords?.lat) addressLat = Number(coords.lat);
                if (coords?.lng) addressLng = Number(coords.lng);
              } catch { /* ignore */ }
            }
            // ✅ CRITICAL FIX: Pass the address ID so the backend can look up detailed fields (flat, house, floor, building)
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

        // ✅ NEW: Check if subscription covers this booking
        if (subscriptionCovered && activeSubscription) {
          console.log('📋 Creating subscription-covered booking (0 payment)...');

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
            console.warn('⚠️ Subscription booking failed, proceeding with normal payment:', subError);
            // Fall through to normal payment flow
            setSubscriptionCovered(false);
          }
        }

        // Create booking with correct API format
        // ✅ CRITICAL: CreateBookingRequestSchema requires customerId (UUID). Resolve from customerPhone if missing.
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

        // ✅ finalServiceId is already resolved and validated above

        // Normalize bookingTime to HH:MM or HH:MM:SS (backend schema expects this)
        const timeMatch = typeof bookingTime === 'string' && bookingTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
        const normalizedBookingTime = timeMatch
          ? (timeMatch[3] !== undefined ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:${timeMatch[3]}` : `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`)
          : bookingTime;

        // ✅ FINAL CHECK: If selectedServices is provided, ensure we use vendor_services.id
        // This is a last-ditch check to prevent using services.id instead of vendor_services.id
        if (selectedServices && selectedServices.length > 0) {
          const firstSelectedService = selectedServices[0];
          if (firstSelectedService.id && uuidRegex.test(String(firstSelectedService.id))) {
            // Only override if current finalServiceId doesn't match the vendor_services.id
            if (finalServiceId !== String(firstSelectedService.id)) {
              console.warn(`⚠️ [FINAL-CHECK] Overriding finalServiceId "${finalServiceId}" with selectedServices[0].id "${firstSelectedService.id}"`);
              finalServiceId = String(firstSelectedService.id);
            }
          }
        }

        const bookingPayload: Record<string, unknown> = {
          customerId: resolvedCustomerId, // ✅ Required UUID (resolved above)
          vendorId: vendorId, // ✅ Required UUID
          serviceId: finalServiceId, // ✅ Required UUID (resolved above)
          serviceName: serviceName, // ✅ Service name for booking
          bookingDate: bookingDate, // ✅ Format: YYYY-MM-DD
          bookingTime: normalizedBookingTime, // ✅ Format: HH:MM or HH:MM:SS
          serviceType: serviceTypeValue, // ✅ Required enum
          amount: taxBreakdown.total, // ✅ Number (schema allows >= 0)
          ...(couponDiscount + (appliedPromotion?.discountAmount || 0) > 0
            ? {
                discountAmount: couponDiscount + (appliedPromotion?.discountAmount || 0),
                ...(appliedCoupon?.code ? { couponCode: appliedCoupon.code } : {}),
              }
            : {}),
          petId: effectivePetId || undefined, // ✅ Optional UUID
          petName: effectivePetName || undefined, // ✅ Pet name for booking
          customerPhone: customerPhone, // ✅ Customer phone
          customerName: customerNameValue, // ✅ Customer name
          address: addressValue, // ✅ Optional string
          notes: '', // ✅ Optional string
          // ✅ NEW: Pass selected services for multi-service bookings
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
        // ✅ at_home: pass city, state, pincode, latitude, longitude for commute and backend (CreateBookingRequestSchema)
        if (addressCity !== undefined) bookingPayload.city = addressCity;
        if (addressState !== undefined) bookingPayload.state = addressState;
        if (addressPincode !== undefined) bookingPayload.pincode = addressPincode;
        if (addressLat !== undefined) bookingPayload.latitude = addressLat;
        if (addressLng !== undefined) bookingPayload.longitude = addressLng;
        // ✅ CRITICAL FIX: Pass addressId so backend can store address_id in booking
        // This allows vendor-side to look up detailed address fields (flat, house, floor, building)
        if (addressIdForBooking) bookingPayload.addressId = addressIdForBooking;

        console.log('📋 Creating booking with validated payload:', {
          ...bookingPayload,
          originalServiceId: serviceId, // Log original
          resolvedServiceId: finalServiceId, // Log resolved UUID
          selectedServicesDebug: selectedServices ? selectedServices.map(s => ({ id: s.id, serviceId: s.serviceId, service_id: s.service_id })) : null,
        });
        console.log('📋 [CRITICAL] Final serviceId being sent to backend:', finalServiceId);

        // ✅ Payment policy aware: attempt booking creation (may be blocked if upfront payment required)
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
            console.log(`🔄 Trying booking endpoint: ${endpoint}`);
            bookingRes = await apiClient.post<any>(endpoint, bookingPayload);
            console.log(`✅ Booking created with endpoint: ${endpoint}`);
            break; // Success, exit loop
          } catch (error: any) {
            lastError = error;
            const is404 = error?.statusCode === 404 ||
              error?.status === 404 ||
              error?.response?.status === 404 ||
              (error?.message && error.message.includes('404'));

            if (is404) {
              console.warn(`⚠️ ${endpoint} returned 404, trying next endpoint...`);
              continue; // Try next endpoint
            }

            // ✅ Payment-required flow: do not throw, proceed to payment
            const errorResponse = (error as any)?.response ?? (error as any)?.responseData ?? (error as any)?.responseBody ?? (error as any)?.originalError;
            const errorCode = errorResponse?.error?.code || errorResponse?.code;
            const is402 = (error as any)?.statusCode === 402 || (error as any)?.status === 402;
            if (is402 || ['PAYMENT_REQUIRED', 'PAYMENT_NOT_COMPLETED', 'PAYMENT_INSUFFICIENT'].includes(errorCode)) {
              paymentRequiredError = error;
              console.warn('⚠️ Booking creation blocked until payment is completed. Proceeding to payment.', {
                endpoint,
                errorCode,
                details: errorResponse?.error?.details || errorResponse?.details,
              });
              break;
            }

            {
              // Not a 404, might be validation error - log details and throw
              const err = error as any;
              console.error(`❌ ${endpoint} failed with non-404 error:`, error);
              console.error('❌ Error response:', errorResponse);
              console.error('❌ Error status:', err?.status ?? err?.statusCode);
              console.error('❌ Error message:', error?.message);

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
                errorMessage = path ? `${errorMessage} (${path}: ${msg})` : `${errorMessage} — ${msg}`;
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
          console.error('❌ All booking creation endpoints failed');
          throw lastError || new Error('All booking creation endpoints returned 404. Lambda may need redeployment.');
        }

        // P2: Treat 200-with-error as failure (resilient parsing)
        if (bookingRes?.error || bookingRes?.success === false) {
          const errMsg = typeof bookingRes?.error === 'string' ? bookingRes.error : (bookingRes?.error?.message ?? bookingRes?.error ?? 'Booking creation failed');
          throw new Error(errMsg);
        }

        // Forensic: extract booking ID from any response shape (wrapped, idempotency, double-wrapped, deep)
        const bookingIdValue = extractBookingIdFromResponse(bookingRes, 'Initial booking create');

        console.log('📋 Booking creation response:', {
          fullResponse: bookingRes,
          extractedBookingId: bookingIdValue,
          hasData: !!bookingRes?.data,
          dataKeys: bookingRes?.data ? Object.keys(bookingRes.data) : [],
        });

        if (!bookingIdValue && !bookingCreationDeferred) {
          console.error('❌ No booking ID in response:', bookingRes);
          throw new Error('Failed to create booking: No booking ID returned');
        }

        if (bookingIdValue && !UUID_REGEX.test(bookingIdValue)) {
          console.error('❌ Invalid bookingId format from API:', bookingIdValue);
          throw new Error('Invalid booking ID format received from server');
        }

        if (bookingIdValue) {
          currentBookingId = bookingIdValue;
          console.log('✅ Booking ID set:', currentBookingId);
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

        if (!orderRes.orderId && !orderRes.id) {
          throw new Error('Failed to create order');
        }
        currentOrderId = orderRes.orderId || orderRes.id;
      }

      // Step 2: Create payment record (only when booking already exists)
      // ✅ If booking creation is deferred, skip payment record creation here
      if (type === 'order' && !currentOrderId) {
        console.log('⚠️ Order payment - skipping payment record creation (order handles payment)');
        // For orders, proceed directly to Razorpay
      }

      // ✅ For bookings, only create payment record if booking already exists
      if (type === 'booking' && (!currentBookingId || bookingCreationDeferred)) {
        console.log('ℹ️ Booking creation deferred; payment record will be created by Razorpay order flow.');
      }

      const paymentPayload: any = {
        amount: taxBreakdown.total, // ✅ Required: positive number
        paymentMethod: selectedMethod === 'razorpay' ? 'razorpay' : (selectedMethod || 'razorpay'), // ✅ Optional enum
        bookingId: currentBookingId, // ✅ Required UUID (booking should already exist)
      };

      if (category != null && String(category).trim() !== '') {
        paymentPayload.category = String(category).trim();
      }

      // ✅ Optional fields (not in schema but backend may handle)
      if (customerId) {
        paymentPayload.customerId = customerId; // ✅ Optional UUID
      }
      if (vendorId) {
        paymentPayload.vendorId = vendorId; // ✅ Optional UUID
      }

      // ✅ Wallet fields (extracted from raw body by backend)
      if (useWallet) {
        paymentPayload.useWallet = useWallet;
        paymentPayload.walletAmount = walletAmount || 0;
      }

      // ✅ Additional fields (not in schema, but backend may handle from raw body)
      // These are sent but not validated by schema
      if (appliedCoupon?.code) {
        paymentPayload.couponCode = appliedCoupon.code;
        paymentPayload.couponDiscount = couponDiscount || 0;
      }
      if (appliedPromotion?.id) {
        paymentPayload.promotionId = appliedPromotion.id;
        paymentPayload.promotionDiscount = promotionDiscount || 0;
      }
      if (selectedRazorpayOffer?.id) {
        paymentPayload.razorpayOfferId = selectedRazorpayOffer.id;
        paymentPayload.razorpayOfferDiscount = razorpayOfferDiscount || 0;
      }

      console.log('📤 Creating payment with payload:', paymentPayload);

      // ✅ Create payment record (bookingId is REQUIRED - booking should already exist)
      // ⚠️ SKIP for Razorpay online payments when finalAmount > 0:
      //    /razorpay/create-order already inserts the payment record with razorpay_order_id.
      //    Calling /payments/create here would create a duplicate (orphan) record without razorpay_order_id.
      const isRazorpayOnline = (paymentPayload.paymentMethod === 'razorpay' || selectedMethod === 'razorpay') && finalAmount > 0;
      let paymentRes: any = null;
      if (type === 'booking' && currentBookingId && !bookingCreationDeferred && !isRazorpayOnline) {
        // ✅ Validate bookingId is a UUID before sending
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(currentBookingId)) {
          console.error('❌ Invalid bookingId format:', currentBookingId);
          throw new Error('Invalid booking ID format. Please try again.');
        }

        // ✅ Validate amount is a non-negative number (0 allowed for full wallet payment)
        if (paymentPayload.amount == null || paymentPayload.amount < 0 || isNaN(paymentPayload.amount)) {
          console.error('❌ Invalid amount:', paymentPayload.amount);
          throw new Error('Invalid payment amount. Please try again.');
        }

        // ✅ Validate paymentMethod is one of the allowed values
        const allowedMethods = ['razorpay', 'wallet', 'cash', 'card', 'upi', 'netbanking'];
        if (paymentPayload.paymentMethod && !allowedMethods.includes(paymentPayload.paymentMethod)) {
          console.error('❌ Invalid paymentMethod:', paymentPayload.paymentMethod);
          // Default to razorpay if invalid
          paymentPayload.paymentMethod = 'razorpay';
        }

        // ✅ Validate customerId and vendorId are UUIDs if provided
        if (paymentPayload.customerId && !uuidRegex.test(paymentPayload.customerId)) {
          console.warn('⚠️ Invalid customerId format, removing from payload:', paymentPayload.customerId);
          delete paymentPayload.customerId;
        }
        if (paymentPayload.vendorId && !uuidRegex.test(paymentPayload.vendorId)) {
          console.warn('⚠️ Invalid vendorId format, removing from payload:', paymentPayload.vendorId);
          delete paymentPayload.vendorId;
        }

        console.log('📤 Creating payment with validated payload:', {
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
        console.log('📤 Full payment payload (for debugging):', JSON.stringify(paymentPayload, null, 2));

        try {
          paymentRes = await apiClient.post<any>('/payments/create', paymentPayload);
        } catch (paymentError: any) {
          // ✅ Enhanced error logging to see validation errors
          console.error('❌ Payment creation failed:', paymentError);
          console.error('❌ Error response:', paymentError?.response || paymentError?.responseData);
          console.error('❌ Error data:', paymentError?.responseData);
          console.error('❌ Error status:', paymentError?.statusCode || paymentError?.status);
          console.error('❌ Raw response:', paymentError?.rawResponse);
          console.error('❌ Request payload that failed:', paymentPayload);

          // Log full error object for debugging
          if (paymentError) {
            console.error('❌ Full error object:', {
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
            console.error('❌ Validation errors:', errorData.error.details.errors);
          } else if (errorData?.data?.errors && Array.isArray(errorData.data.errors)) {
            // Format: { data: { errors: [...] } }
            const validationErrors = errorData.data.errors.map((e: any) => {
              const path = e.path?.join('.') || e.path || 'unknown';
              return `${path}: ${e.message}`;
            }).join(', ');
            errorMessage = `Payment validation failed: ${validationErrors}`;
            console.error('❌ Validation errors:', errorData.data.errors);
          } else if (errorData?.errors && Array.isArray(errorData.errors)) {
            // Format: { errors: [...] }
            const validationErrors = errorData.errors.map((e: any) => {
              const path = e.path?.join('.') || e.path || 'unknown';
              return `${path}: ${e.message}`;
            }).join(', ');
            errorMessage = `Payment validation failed: ${validationErrors}`;
            console.error('❌ Validation errors:', errorData.errors);
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
          } as Record<string, unknown>;
          console.log('🔄 Creating booking after wallet payment:', createPayload);
          const bookingRes = await apiClient.post<any>('/bookings/create', createPayload);
          const bookingIdValue = extractBookingIdFromResponse(bookingRes, 'After wallet payment');
          if (!bookingIdValue) {
            console.error('❌ No booking ID after wallet payment:', bookingRes);
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

        if (appliedPromotion) {
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
        onSuccess(currentBookingId || '', currentOrderId, otpCode);
        return;
      }

      // Step 3: Create Razorpay order
      // ✅ FIX: Use longer timeout (45s) for payment operations
      console.log('🔄 [PAYMENT] Creating Razorpay order...', {
        bookingId: currentBookingId,
        amount: bookingCreationDeferred ? (requiredUpfrontAmount ?? finalAmount) : finalAmount,
        flowType,
        bookingCreationDeferred
      });
      const amountToCharge = bookingCreationDeferred
        ? (requiredUpfrontAmount ?? finalAmount)
        : finalAmount;

      let orderRes: any;
      try {
        orderRes = await apiClient.post<any>('/razorpay/create-order', {
          // Instant tele: no booking until after payment; use booking_prepaid
          bookingId: (flowType === 'tele-instant' || bookingCreationDeferred) ? undefined : currentBookingId,
          orderId: currentOrderId,
          amount: amountToCharge,
          customerId,
          offerId: selectedRazorpayOffer?.id,
          type: (flowType === 'tele-instant' || bookingCreationDeferred) ? 'booking_prepaid' : undefined,
          vendorId: (flowType === 'tele-instant' || bookingCreationDeferred) ? vendorId : undefined,
        }, undefined, 45000); // ✅ FIX: 45 second timeout for payment operations
      } catch (orderError: any) {
        console.error('❌ [PAYMENT] Razorpay create-order API call failed:', {
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

      console.log('✅ [PAYMENT] Razorpay order response (raw):', JSON.stringify(orderRes, null, 2));
      console.log('✅ [PAYMENT] Response type:', typeof orderRes);
      console.log('✅ [PAYMENT] Response keys:', orderRes ? Object.keys(orderRes) : 'null/undefined');

      // ✅ FIX: Handle ALL possible response structures
      // Backend returns: { orderId, keyId, amount, currency } directly via this.success()
      // But could also be wrapped in: { success: true, data: { ... } } or { data: { ... } }
      // Or error response: { error: "..." } or { success: false, error: "..." }

      // Check for error response first
      if (orderRes?.error || (orderRes?.success === false)) {
        const errorMsg = typeof orderRes.error === 'string'
          ? orderRes.error
          : orderRes.error?.message || 'Failed to create payment order';
        console.error('❌ [PAYMENT] Error in response:', errorMsg);
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

      console.log('🔍 [PAYMENT] Extracted values:', {
        razorpayOrderId: razorpayOrderId ? `${razorpayOrderId.substring(0, 20)}...` : 'MISSING',
        keyId: keyId ? `${keyId.substring(0, 8)}...` : 'missing',
        orderAmount,
        hasData: !!orderRes?.data,
        hasSuccess: !!orderRes?.success,
        responseKeys: orderRes ? Object.keys(orderRes) : []
      });

      if (!razorpayOrderId) {
        console.error('❌ [PAYMENT] No orderId found in response. Full response structure:', {
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
        console.error('❌ [PAYMENT] No keyId in response and NEXT_PUBLIC_RAZORPAY_KEY not set');
        throw new Error('Payment gateway configuration error: Razorpay key not found');
      }

      console.log('✅ [PAYMENT] Razorpay order created successfully:', { razorpayOrderId, keyId: keyId ? `${keyId.substring(0, 8)}...` : 'missing', amount: orderAmount });

      // ✅ FIX: Wait for Razorpay script to load before opening checkout
      if (typeof window !== 'undefined' && !window.Razorpay) {
        console.log('⏳ [PAYMENT] Waiting for Razorpay script to load...');
        try {
          await loadRazorpayScript();
          console.log('✅ [PAYMENT] Razorpay script loaded successfully');
        } catch (scriptError: any) {
          console.error('❌ [PAYMENT] Failed to load Razorpay script:', scriptError);
          throw new Error('Payment gateway script failed to load. Please refresh the page and try again.');
        }
      }

      // Step 4: Open Razorpay checkout
      const options = {
        key: keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY,
        amount: amountToCharge * 100,
        currency: 'INR',
        name: 'Warmpawz',
        description: `${serviceName || productName} - ${vendorName}`,
        order_id: razorpayOrderId,
        handler: async (response: any) => {
          try {
            console.log('✅ [RAZORPAY] Payment response received:', {
              order_id: response.razorpay_order_id,
              payment_id: response.razorpay_payment_id,
              has_signature: !!response.razorpay_signature,
            });

            // ✅ Step 1: Verify payment with backend (with retry)
            console.log('🔄 [RAZORPAY] Verifying payment...');
            let verifyRes: any = null;
            const MAX_VERIFY_RETRIES = 3;
            for (let attempt = 1; attempt <= MAX_VERIFY_RETRIES; attempt++) {
              try {
                verifyRes = await apiClient.post('/razorpay/verify-payment', {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }, undefined, 30000);
                console.log(`✅ [RAZORPAY] Payment verified on attempt ${attempt}:`, verifyRes);
                break; // success – exit retry loop
              } catch (verifyErr: any) {
                console.error(`❌ [RAZORPAY] verify-payment attempt ${attempt}/${MAX_VERIFY_RETRIES} failed:`, verifyErr?.message);
                if (attempt === MAX_VERIFY_RETRIES) {
                  // All retries exhausted – throw so outer catch can handle
                  throw verifyErr;
                }
                // Exponential backoff: 1s, 2s
                await new Promise((r) => setTimeout(r, attempt * 1000));
              }
            }

            // ✅ Instant tele: create booking via instant-after-payment (no booking until payment done)
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

            // ✅ Queue-accepted tele: booking already exists, confirm payment and update status
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

            // ✅ If booking creation was deferred, create booking now with payment info
            if (type === 'booking' && bookingCreationDeferred && deferredBookingPayload) {
              const createPayload = {
                ...deferredBookingPayload,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
              };
              console.log('🔄 Creating booking after payment:', createPayload);
              const bookingRes = await apiClient.post<any>('/bookings/create', createPayload);
              const bookingIdValue = extractBookingIdFromResponse(bookingRes, 'After Razorpay payment');
              if (!bookingIdValue) {
                console.error('❌ No booking ID after payment:', bookingRes);
                throw new Error('Payment succeeded but booking creation failed. Please contact support.');
              }
              currentBookingId = bookingIdValue;
              bookingCreationDeferred = false;
            }

            // ✅ Step 2: Apply coupon if used
            if (appliedCoupon) {
              try {
                await apiClient.post('/coupons/apply', {
                  couponCode: appliedCoupon.code,
                  bookingId: currentBookingId,
                  orderId: currentOrderId,
                  customerId,
                  amount: amountToCharge,
                });
                console.log('✅ [COUPON] Applied successfully');
              } catch (couponErr) {
                console.warn('⚠️ [COUPON] Failed to apply:', couponErr);
                // Don't block payment success if coupon fails
              }
            }

            // ✅ Step 3: Apply promotion if used
            if (appliedPromotion) {
              try {
                await apiClient.post('/promotions/apply', {
                  promotionId: appliedPromotion.id,
                  bookingId: currentBookingId,
                  orderId: currentOrderId,
                  customerId,
                  amount: amountToCharge,
                });
                console.log('✅ [PROMOTION] Applied successfully');
              } catch (promoErr) {
                console.warn('⚠️ [PROMOTION] Failed to apply:', promoErr);
                // Don't block payment success if promotion fails
              }
            }

            // ✅ Step 4: Generate OTP for eligible bookings
            let otpCode: string | undefined = undefined;
            if (type === 'booking' && serviceStyle !== 'tele') {
              try {
                otpCode = await generateBookingOTP(currentBookingId || '', customerId);
                console.log('✅ [OTP] Generated successfully');
              } catch (otpErr) {
                console.warn('⚠️ [OTP] Failed to generate:', otpErr);
                // Don't block payment success if OTP fails
              }
            }

            // ✅ Step 5: Success - booking is now confirmed
            console.log('✅ [PAYMENT] Complete! Booking confirmed:', currentBookingId);
            toast.success('Payment successful! Booking confirmed.');
            setProcessing(false);
            onSuccess(currentBookingId || '', currentOrderId, otpCode);
          } catch (err: any) {
            console.error('❌ [PAYMENT] Verification failed:', err);
            const errorMessage = err?.response?.data?.error || err?.message || 'Payment verification failed';
            toast.error(`${errorMessage}. Please contact support with order ID: ${response.razorpay_order_id}`);
            setProcessing(false);
          }
        },
        prefill: {
          contact: customerPhone,
        },
        theme: {
          color: '#FF8C42',
        },
        offers: selectedRazorpayOffer ? [selectedRazorpayOffer.id] : [],
        modal: {
          ondismiss: () => {
            console.log('ℹ️ [RAZORPAY] Checkout dismissed by user');
            setProcessing(false);
            toast.info('Payment cancelled');
          },
        },
      };

      // ✅ FIX: Double-check Razorpay is available before opening
      if (!window.Razorpay) {
        console.error('❌ [PAYMENT] Razorpay not available after script load');
        throw new Error('Payment gateway not loaded. Please refresh the page and try again.');
      }

      console.log('🚀 [PAYMENT] Opening Razorpay checkout...', {
        razorpayOrderId,
        amount: amountToCharge,
        keyId: keyId ? `${keyId.substring(0, 8)}...` : 'missing'
      });

      try {
        const razorpay = new window.Razorpay(options);
        // ✅ Listen for payment failures (these don't trigger the handler callback)
        razorpay.on('payment.failed', (resp: any) => {
          console.error('❌ [RAZORPAY] Payment failed event:', {
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
        console.log('✅ [PAYMENT] Razorpay checkout opened successfully');
      } catch (openError: any) {
        console.error('❌ [PAYMENT] Failed to open Razorpay checkout:', openError);
        throw new Error(`Failed to open payment gateway: ${openError.message || 'Unknown error'}`);
      }

    } catch (error: any) {
      console.error('❌ Payment error:', error);
      console.error('❌ Error response:', error?.response);
      console.error('❌ Error data:', error?.response?.data);
      console.error('❌ Error status:', error?.status);
      console.error('❌ Error message:', error?.message);

      // Extract detailed error message
      const errorData = error?.response?.data || error?.data;
      let errorMessage = error.message || 'Payment failed';

      if (errorData?.data?.errors && Array.isArray(errorData.data.errors)) {
        const validationErrors = errorData.data.errors.map((e: any) => {
          const path = e.path?.join('.') || e.path || 'unknown';
          return `${path}: ${e.message}`;
        }).join(', ');
        errorMessage = `Payment validation failed: ${validationErrors}`;
        console.error('❌ Validation errors:', errorData.data.errors);
      } else if (errorData?.errors && Array.isArray(errorData.errors)) {
        const validationErrors = errorData.errors.map((e: any) => {
          const path = e.path?.join('.') || e.path || 'unknown';
          return `${path}: ${e.message}`;
        }).join(', ');
        errorMessage = `Payment validation failed: ${validationErrors}`;
        console.error('❌ Validation errors:', errorData.errors);
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
    return (
      <div className="flex min-h-screen min-h-[100dvh] w-full max-w-customer mx-auto flex-col items-center justify-center bg-orange-50">
        <Loader2 className="h-12 w-12 animate-spin text-[#FF8C42]" />
      </div>
    );
  }

  // ✅ Derive display values from selectedServices when available (universal payment for all flows)
  const effectiveSelectedServices = selectedServices && selectedServices.length > 0
    ? selectedServices
    : null;
  const firstServiceFromArray = effectiveSelectedServices?.[0];

  const displayName = serviceName || productName
    || firstServiceFromArray?.name || firstServiceFromArray?.serviceName
    || 'Service';
  const displayDescription = serviceDescription || firstServiceFromArray?.description || '';
  const displayAmount = Number(baseAmount) || (effectiveSelectedServices
    ? effectiveSelectedServices.reduce((sum: number, s: any) => sum + (Number(s.price) || 0), 0)
    : 0);
  const displayDuration = (duration != null && (typeof duration !== 'string' || duration !== ''))
    ? Number(duration)
    : (effectiveSelectedServices
      ? effectiveSelectedServices.reduce((sum: number, s: any) => sum + (Number(s.duration) || 0), 0)
      : firstServiceFromArray?.duration);

  const appShell = layoutVariant === 'appShell';
  /** Keep in sync with globals.css --customer-footer-offset + .cw-fixed-above-customer-tabbar */
  const ctaBottomClass = appShell
    ? 'cw-fixed-above-customer-tabbar'
    : 'bottom-[max(1rem,env(safe-area-inset-bottom,1rem))]';
  /** Matches --customer-sticky-cta-scroll-padding (footer + fixed pay strip) */
  const mainBottomPadding = appShell
    ? 'cw-scroll-pad-tabbar-sticky-cta'
    : 'pb-[calc(10.5rem+env(safe-area-inset-bottom,0px))]';

  const paymentStats = [
    { value: formatPriceWithSymbol(displayAmount), label: 'Due' },
    {
      value: displayDuration != null && !Number.isNaN(Number(displayDuration)) ? `${displayDuration} min` : '—',
      label: 'Duration',
    },
    { value: type === 'booking' ? 'Booking' : 'Order', label: 'Type' },
  ];

  return (
    <div className="flex min-h-screen min-h-[100dvh] w-full max-w-customer mx-auto flex-col bg-orange-50">
      <ServiceDashboardHeader
        className="sticky top-0 z-50 shrink-0"
        serviceName="Payment"
        serviceSubtitle="Secure checkout"
        serviceIcon={Shield}
        iconColor="text-white"
        stats={paymentStats}
        onBack={onBack}
        showBackButton
      />

      <main className={`flex-1 space-y-4 overflow-y-auto px-4 py-4 ${mainBottomPadding}`}>
        {/* Address Selection (if needed and on top) */}
        {showAddressSelection && (
          <Card className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
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
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
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
          </Card>
        )}

        {type === 'booking' && (vendorName || vendorAddress || staffName || staffPhoto) && (
          <Card className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-bold text-gray-900">Your provider</h2>
            <div className="flex gap-3">
              {staffPhoto ? (
                <img
                  src={staffPhoto}
                  alt=""
                  className="h-14 w-14 flex-shrink-0 rounded-full object-cover ring-2 ring-orange-100"
                />
              ) : (
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                  {serviceStyle === 'at_center' ? (
                    <Building2 className="h-7 w-7" />
                  ) : (
                    <Home className="h-7 w-7" />
                  )}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900">{vendorName || 'Provider'}</p>
                {staffName && staffName.trim() !== (vendorName || '').trim() && (
                  <p className="text-sm text-gray-600">Professional: {staffName}</p>
                )}
                {vendorAddress && (
                  <p className="mt-1 flex items-start gap-2 text-sm text-gray-600">
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#FF8C42]" />
                    <span>{vendorAddress}</span>
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        {type === 'booking' && (
          <Card className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <button
              type="button"
              onClick={() => router.push('/pets?forCheckout=1')}
              className="flex w-full items-center justify-between gap-3 rounded-xl text-left transition-all duration-150 active:scale-[0.98] active:bg-gray-50 touch-manipulation"
            >
              <span className="shrink-0 text-sm font-medium text-gray-700">Pet</span>
              <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                <span className="truncate text-right text-sm font-semibold text-gray-900">
                  {selectedPetDisplayName || 'Select Pet'}
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
              </div>
            </button>
          </Card>
        )}

        {/* Booking/Order Summary - Universal display for all service booking flows */}
        <Card className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {type === 'booking' ? 'Booking Summary' : 'Order Summary'}
          </h2>

          {/* Multi-service or single service display */}
          {effectiveSelectedServices && effectiveSelectedServices.length > 0 ? (
            <div className="space-y-3 pb-4 border-b border-gray-100">
              {effectiveSelectedServices.map((svc: any, idx: number) => {
                const svcName = svc.name || svc.serviceName || 'Service';
                const svcPrice = Number(svc.price) || 0;
                const svcDuration = svc.duration != null ? Number(svc.duration) : null;
                const svcStyle = svc.serviceStyle || svc.service_style || serviceStyle;
                return (
                  <div key={svc.id || svc.serviceId || idx} className="flex items-start gap-4">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${svcStyle === 'tele' ? 'bg-blue-100' :
                      svcStyle === 'at_home' ? 'bg-green-100' :
                        svcStyle === 'at_center' ? 'bg-purple-100' : 'bg-orange-100'
                      }`}>
                      {svcStyle === 'tele' ? '📱' : svcStyle === 'at_home' ? '🏠' : svcStyle === 'at_center' ? '🏥' : '🛒'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900">{svcName}</h3>
                      {idx === 0 && <p className="text-sm text-gray-500">{vendorName}</p>}
                      {svcDuration != null && svcDuration > 0 && (
                        <p className="text-sm text-gray-400 flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" /> {svcDuration} mins
                        </p>
                      )}
                    </div>
                    <p className="font-bold text-[#FF8C42]">{formatPriceWithSymbol(svcPrice)}</p>
                  </div>
                );
              })}
              {effectiveSelectedServices.length > 1 && (
                <div className="flex justify-between items-center pt-2 font-bold">
                  <span>Subtotal</span>
                  <span className="text-[#FF8C42]">{formatPriceWithSymbol(displayAmount)}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-4 pb-4 border-b border-gray-100">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${serviceStyle === 'tele' ? 'bg-blue-100' :
                serviceStyle === 'at_home' ? 'bg-green-100' :
                  serviceStyle === 'at_center' ? 'bg-purple-100' : 'bg-orange-100'
                }`}>
                {serviceStyle === 'tele' ? '📱' : serviceStyle === 'at_home' ? '🏠' : serviceStyle === 'at_center' ? '🏥' : '🛒'}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900">{displayName}</h3>
                <p className="text-sm text-gray-500">{vendorName}</p>
                {displayDescription && (
                  <p className="text-sm text-gray-400 mt-1 line-clamp-2">{displayDescription}</p>
                )}
                {displayDuration != null && displayDuration > 0 && (
                  <p className="text-sm text-gray-400 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" /> {displayDuration} mins
                  </p>
                )}
                {quantity > 1 && (
                  <p className="text-sm text-gray-400 mt-1">Quantity: {quantity}</p>
                )}
              </div>
              <p className="font-bold text-[#FF8C42]">{formatPriceWithSymbol(displayAmount)}</p>
            </div>
          )}

          {/* Schedule (for bookings) */}
          {type === 'booking' && (bookingDate || bookingTime) && (
            <div className="flex items-center gap-3 py-3 border-b border-gray-100">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <p className="text-sm text-gray-500">Schedule</p>
                <p className="font-medium">
                  {bookingDate && new Date(bookingDate).toLocaleDateString('en-IN', {
                    weekday: 'short', day: 'numeric', month: 'short'
                  })}
                  {bookingTime && ` at ${bookingTime}`}
                </p>
              </div>
            </div>
          )}

          {/* Address (for home services/orders) */}
          {((serviceStyle === 'at_home' && type === 'booking') || type === 'order') && selectedAddress && (
            <div className="flex items-center gap-3 py-3">
              <MapPin className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <p className="text-sm text-gray-500">Delivery Address</p>
                <p className="font-medium">{selectedAddress.label || 'Home'}</p>
                <p className="text-sm text-gray-500">
                  {selectedAddress.addressLine1 || selectedAddress.address}, {selectedAddress.city} - {selectedAddress.pincode}
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Promotions & Spotlight Offers */}
        {promotions.length > 0 && (
          <Card className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-[#FF8C42]" />
              <h2 className="font-semibold text-gray-900">Available Offers</h2>
            </div>

            <div className="space-y-2">
              {promotions.map((promo) => (
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
              ))}
            </div>
          </Card>
        )}

        {/* Coupon Section */}
        <Card className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
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
        </Card>

        {/* Razorpay Offers */}
        {razorpayOffers.length > 0 && (
          <Card className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
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
          </Card>
        )}

        {/* Wallet Section */}
        {wallet && wallet.balance > 0 && (
          <Card className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <button
              onClick={() => setUseWallet(!useWallet)}
              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all duration-150 active:scale-[0.98] touch-manipulation ${useWallet ? 'border-green-500 bg-green-50' : 'border-gray-200'
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
          </Card>
        )}

        {/* Price Breakdown */}
        <Card className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
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

            {/* ✅ FIX: Vendor Discount - Applied directly by vendor at service level */}
            {appliedPromotion && (
              <div className="flex justify-between text-green-600">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-4 h-4" />
                  <span className="font-medium">Vendor Offer:</span> {appliedPromotion.title}
                </span>
                <span className="font-medium">-₹{promotionDiscount.toFixed(2)}</span>
              </div>
            )}

            {/* ✅ FIX: Platform Coupon - Applied at checkout level by platform */}
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

            {/* ✅ FIX GAP-7.1: Platform Discount (shown separately from vendor discount) */}
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

            {platformFees.deliveryFee > 0 && (
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

            <div className="border-t border-gray-200 pt-3 mt-3">
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
        </Card>

        {/* Payment & refund policy summary (dynamic from backend) */}
        {(refundPolicySummary || (paymentPolicies && Object.keys(paymentPolicies).length > 0)) && (
          <Card className="bg-gray-50 rounded-2xl p-4 shadow-sm border border-gray-100">
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
          </Card>
        )}

        {/* Saved Payment Methods */}
        {savedMethods.length > 0 && (
          <Card className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
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
          </Card>
        )}

        {/* Pay with Razorpay (default) */}
        <Card className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
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
        </Card>

        {/* OTP Notice for Home/Center services */}
        {type === 'booking' && serviceStyle !== 'tele' && serviceStyle !== 'ecom' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
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

      {/* Fixed CTA — same max width as BottomNavigation (max-w-customer) */}
      <div
        className={`pointer-events-none fixed left-0 right-0 z-[100] mx-auto w-full max-w-customer px-4 ${ctaBottomClass}`}
      >
        <div className="pointer-events-auto w-full space-y-2">
          <Button
            onClick={() => handlePayment()}
            disabled={processing || serviceIdResolving || (showAddressSelection && !selectedAddress)}
            className="h-auto w-full rounded-full bg-gradient-to-r from-[#FF8C42] to-[#FF7029] px-6 py-4 text-lg font-bold text-white shadow-md transition-all duration-150 hover:from-[#E67A35] hover:to-[#D66A25] active:scale-[0.98] touch-manipulation disabled:opacity-50"
          >
            {processing || serviceIdResolving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                {serviceIdResolving ? 'Preparing...' : 'Processing...'}
              </span>
            ) : (
              <>
                <Shield className="w-5 h-5 mr-2" />
                {finalAmount === 0 ? `Confirm ${type === 'booking' ? 'Booking' : 'Order'}` : `Pay ₹${finalAmount.toFixed(2)}`}
              </>
            )}
          </Button>
          <p className="flex items-center justify-center gap-1 text-center text-xs text-gray-600">
            <Shield className="h-3 w-3 shrink-0 text-gray-500" />
            Secured by Razorpay • 100% Safe Payments
          </p>
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
          // ✅ FIX: Close modal first, then set policy accepted and proceed with payment
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

    </div>
  );
}

export default UniversalPaymentPage;
