'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft, Clock, MapPin, Calendar, Check, X, Copy,
  AlertCircle, RefreshCw, Eye, EyeOff, Package, ChevronRight,
  Key, XCircle, CalendarClock, Wallet, CreditCard, Phone, Star,
  Navigation, MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, isCustomerWebDevMealPlanOrdersEnabled } from '@/lib/api-client';
import { getBookingResponsePayload, pickBookingApiMessage } from '@/lib/booking-response-message';
import { copyTextToClipboard } from '@/lib/shareUtils';
import {
  getServiceStyleDisplayLabel,
  formatPriceWithSymbol,
  customerBookingStatusShowsCheckInOtp,
} from '@/lib/booking-display-utils';
import { BookingListCardPricing } from '@/components/customer/pricing/BookingListCardPricing';
import { MarketplaceStatus } from '@/components/customer/marketplace/MarketplaceStatus';
import { mapBookingStatusTone } from '@/lib/marketplace/map-status';
import {
  formatIstBookingCompletedLine,
  formatIstBookingWhen,
} from '@/lib/ist-display-format';
import { formatLocalDateYYYYMMDD } from '@/lib/local-calendar-date';
import {
  derivePaymentSourcesFromBooking,
  formatPaymentSourcesShortLabel,
  bookingSourcesHasGatewayPayment,
} from '@/lib/payment-display-utils';
import type { PaymentSource } from '@/lib/payment-display-utils';
import {
  buildBookingCardPriceView,
  extractBookingFinancial,
  resolveBookingListAllInAmount,
} from '@/lib/pricing/booking-financial';
import {
  buildRefundStripCopy,
  cancelledByLabel,
  humanizeCancellationReason,
  type BookingRefundSummary,
} from '@/lib/booking-cancel-display';
import {
  isBookingAwaitingPayment,
  isPaymentHoldActive,
  isPaymentHoldExpired,
  PaymentHoldBanner,
  resolvePaymentHoldExpiresAt,
} from '@/lib/payment-hold-ui';
import { isAppReviewDemoAccount } from '@/lib/app-review-demo-account';

import { useRouter } from 'next/navigation';
import { BookingDetailModal } from '../BookingDetailModal';
import { RateServiceModal } from '../RateServiceModal';
import { ServiceDashboardHeader } from '../shared/ServiceDashboardHeader';
import { BookingsHeaderBackground } from './BookingsHeaderBackground';
import {
  MyBookingsTrackingRow,
  MyBookingsFilterTabs,
  MyBookingsEmptyState,
  MyBookingsBookingCardShell,
  MyBookingsMetaRow,
  MyBookingsQuickAction,
  MY_BOOKINGS_CONTENT_SHELL_CLASS,
  type MyBookingsFilterId,
} from './my-bookings-ui';
import { UtensilsCrossed, CheckCircle2 } from 'lucide-react';
/** Flip to `true` to restore navigation from My Bookings (one-line re-enable). */
export const PHARMACY_ORDERS_ENABLED = false;

const ORDERS_MEAL_PLANS_ROUTE = '/orders/meal-plans';
const ORDERS_PHARMACY_ROUTE = '/orders/pharmacy';

function mealPlanOrdersUrl(phone: string) {
  return phone ? `${ORDERS_MEAL_PLANS_ROUTE}?phone=${encodeURIComponent(phone)}` : ORDERS_MEAL_PLANS_ROUTE;
}

function pharmacyOrdersUrl(phone: string) {
  return phone ? `${ORDERS_PHARMACY_ROUTE}?phone=${encodeURIComponent(phone)}` : ORDERS_PHARMACY_ROUTE;
}

interface BookingOccurrence {
  occurrenceId: string;
  sessionNumber: number;
  scheduledDate: string;
  scheduledTime: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  otp?: string;
  completedAt?: string;
  completedBy?: string;
}

interface Booking {
  bookingId: string;
  serviceType: string;
  serviceName: string;
  vendorId: string;
  vendorName: string;
  vendorPhone?: string; // ✅ FIX: Added vendor phone
  vendorContact?: string; // ✅ FIX: Added vendor contact
  vendorRating?: number; // ✅ FIX: Added vendor rating
  staffId?: string;
  staffName?: string;
  petId: string;
  petName: string;
  customerPhone: string;
  serviceStyle: string;
  bookingDate: string;
  bookingTime: string;
  duration: number;
  price: number;
  basePrice?: number;
  discountAmount?: number;
  paidAmount?: number;
  couponCode?: string;
  status: 'pending' | 'pending_payment' | 'confirmed' | 'in_progress' | 'arrived' | 'completed' | 'cancelled';
  completionOTP?: string;
  isPackage: boolean;
  packagePurchaseId?: string;
  packageDetails?: {
    totalSessions?: number;
    completedSessions?: number;
    frequency?: string;
    unlimited?: boolean;
    remainingSessions?: number | string;
    packagePurchaseId?: string;
  };
  occurrences?: BookingOccurrence[];
  createdAt: string;
  specialInstructions?: string;
  requiresStartOTP?: boolean;
  startOTP?: string;
  startTime?: string;
  endTime?: string;
  actualDuration?: number;
  // ✅ Added for OTP display
  otpCode?: string;
  otpVerified?: boolean;
  paymentStatus?: string;
  paymentHoldExpiresAt?: string | null;
  paymentSources?: PaymentSource[];
  /** When the booking was marked completed (for tele: aligns with video call end when backend sends it). */
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  cancelledBy?: string | null;
  refundSummary?: BookingRefundSummary | null;
  /** True when this row is a visit booked against a package slot. */
  isPackageSession?: boolean;
  /** 1-based slot index within the package. */
  packageSessionNumber?: number;
}

function isTeleBookingRow(b: { serviceStyle?: string; serviceType?: string; serviceName?: string }) {
  return (
    ['tele', 'video_consultation', 'video', 'online'].includes(b.serviceStyle || '') ||
    ['tele', 'video_consultation', 'video', 'online'].includes(b.serviceType || '') ||
    (b.serviceName || '').toLowerCase().includes('video') ||
    (b.serviceName || '').toLowerCase().includes('tele')
  );
}

interface MyBookingsProps {
  phone: string;
  onBack: () => void;
  /** Left X: full exit to home (shell reset). When set with onBack, header matches profile-style X + Back. */
  onCloseToHome?: () => void;
  initialBookingId?: string; // To open a specific booking
  /** When set, closing the detail modal (opened via initialBookingId) runs this instead of showing the list. */
  onCloseInitialBookingDetail?: () => void;
  /** From live tracking etc.: `/bookings?reviewBookingId=` opens rate modal when list loads */
  reviewBookingIdFromUrl?: string | null;
  onReorderMedicine?: (medications: any[]) => void;
  onNavigate?: (
    screen: string,
    data?: Record<string, unknown>
  ) => void;
}

function PendingPaymentHoldBanner({
  expiresAt,
  onPayNow,
  onExpired,
}: {
  expiresAt: string | null | undefined;
  onPayNow: (e: React.MouseEvent) => void;
  onExpired?: () => void;
}) {
  return (
    <PaymentHoldBanner
      expiresAt={expiresAt}
      onPayNow={onPayNow}
      onExpired={onExpired}
      holdMessage="Your slot is held until the timer ends."
    />
  );
}

export function MyBookings({
  phone,
  onBack,
  onCloseToHome,
  initialBookingId,
  onCloseInitialBookingDetail,
  reviewBookingIdFromUrl,
  onReorderMedicine,
  onNavigate,
}: MyBookingsProps) {
  const router = useRouter();
  const reviewDemoAccount = isAppReviewDemoAccount(phone);

  const [mealPlanOrdersEnabled, setMealPlanOrdersEnabled] = useState(false);
  useEffect(() => {
    setMealPlanOrdersEnabled(isCustomerWebDevMealPlanOrdersEnabled());
  }, []);

  const navigateToMealPlanOrders = () => {
    if (!mealPlanOrdersEnabled) return;
    if (onNavigate) {
      onNavigate('meal-plan-orders');
      return;
    }
    router.push(mealPlanOrdersUrl(phone));
  };

  const navigateToPharmacyOrders = () => {
    if (!PHARMACY_ORDERS_ENABLED) return;
    router.push(pharmacyOrdersUrl(phone));
  };

  const effectivePhone =
    phone ||
    (typeof window !== 'undefined'
      ? (localStorage.getItem('customerPhone') || localStorage.getItem('customer_phone') || '')
      : '');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'upcoming' | 'completed'>('all');
  const [showOTP, setShowOTP] = useState<string | null>(null);
  const [copiedOTP, setCopiedOTP] = useState<string | null>(null);
  /** Reveal mask for end-of-service OTP after check-in (in_progress at_home). */
  const [showCompletionOtpFor, setShowCompletionOtpFor] = useState<string | null>(null);

  // ✅ New state for cancel/reschedule modals
  const [showCancelModal, setShowCancelModal] = useState<string | null>(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<'wallet' | 'original'>('wallet');
  const [processing, setProcessing] = useState(false);
  const [refundPreviewLoading, setRefundPreviewLoading] = useState(false);
  const [estimatedRefund, setEstimatedRefund] = useState<{
    percentage: number;
    amount: number;
    source?: string;
    policyApplied?: boolean;
    platformFeeApplies?: boolean;
  } | null>(null);
  // ✅ FIX: Add state for review modal
  const [showReviewModal, setShowReviewModal] = useState<{ bookingId: string; vendorId: string; serviceName: string } | null>(null);
  const reviewFromUrlHandledRef = useRef<string | null>(null);
  const openedFromInitialBookingRef = useRef(false);

  // ✅ FIX: User profile data for consistent header
  const [userName, setUserName] = useState('User');
  const [userProfilePhoto, setUserProfilePhoto] = useState<string | undefined>(undefined);

  useEffect(() => {
    console.log('[MyBookings] init', {
      phoneProp: phone,
      effectivePhone,
      hasPhone: Boolean(effectivePhone),
    });
    loadBookings();
    // ✅ FIX: Load user profile for header display
    const loadUserProfile = async () => {
      try {
        const profileResponse = await apiClient.get(`/customer/profile?phone=${encodeURIComponent(phone)}`) as any;
        if (profileResponse?.profile || profileResponse) {
          const profile = profileResponse.profile || profileResponse;
          setUserName(profile.name || profile.fullName || profile.full_name || 'User');
          setUserProfilePhoto(profile.profilePhoto || profile.profile_image_url || profile.photo);
        }
      } catch (error) {
        console.error('[MyBookings] Error loading user profile:', error);
      }
    };
    if (effectivePhone) {
      loadUserProfile();
    }
  }, [phone, effectivePhone]);

  useEffect(() => {
    if (initialBookingId && bookings.length > 0) {
      const booking = bookings.find(b => b.bookingId === initialBookingId);
      if (booking) {
        openedFromInitialBookingRef.current = true;
        setSelectedBooking(booking);
      }
    }
  }, [initialBookingId, bookings]);

  useEffect(() => {
    const rid = reviewBookingIdFromUrl?.trim();
    if (!rid || bookings.length === 0) return;
    if (reviewFromUrlHandledRef.current === rid) return;
    const b = bookings.find((x) => x.bookingId === rid);
    if (b?.status === 'completed') {
      reviewFromUrlHandledRef.current = rid;
      setShowReviewModal({
        bookingId: b.bookingId,
        vendorId: b.vendorId,
        serviceName: b.serviceName,
      });
      try {
        const u = new URL(window.location.href);
        u.searchParams.delete('reviewBookingId');
        window.history.replaceState({}, '', `${u.pathname}${u.search}${u.hash}`);
      } catch {
        /* ignore */
      }
    }
  }, [reviewBookingIdFromUrl, bookings]);

  const loadBookings = async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        setLoading(true);
      }
      if (!phone) {
        if (!effectivePhone) {
          console.warn('[MyBookings] No phone available; skipping bookings fetch');
          setBookings([]);
          if (!options?.silent) {
            setLoading(false);
          }
          return;
        }
      }

      // Prefer phone-convenience endpoint (normalizes phone formats like +91 / 10-digit).
      let result: any;
      try {
        result = await apiClient.get<any>(`/customer/bookings?phone=${encodeURIComponent(effectivePhone)}`);
      } catch (primaryError) {
        // Backward compatibility fallback for deployments where convenience route is unavailable.
        console.warn('[MyBookings] Primary bookings endpoint failed, falling back:', primaryError);
        result = await apiClient.get<any>(`/customer/${encodeURIComponent(effectivePhone)}/bookings`);
      }

      let rawBookings: any[] = [];
      if (Array.isArray(result)) {
        rawBookings = result;
      } else {
        rawBookings = result.bookings || result.data?.bookings || [];
      }

      // ✅ DEBUG: Log diagnostic bookings to see what data we're getting
      console.log('[MyBookings] Loaded bookings:', rawBookings.length);
      const diagnosticBookings = rawBookings.filter((b: any) => {
        const serviceTypeLower = (b.service_type || b.serviceType || '').toLowerCase();
        return serviceTypeLower === 'diagnostics' || serviceTypeLower.includes('diagnostic');
      });
      if (diagnosticBookings.length > 0) {
        console.log('[MyBookings] Found diagnostic bookings:', diagnosticBookings.map((b: any) => ({
          id: b.id,
          serviceName: b.service_name,
          serviceType: b.service_type,
          notes: b.notes,
          selected_services: b.selected_services,
          selectedServices: b.selectedServices,
        })));
      }

      // Map API response to Booking interface
      const mappedBookings: Booking[] = rawBookings.map((b: any) => {
        // ✅ FIX: Parse diagnostic test names for diagnostic bookings (same logic as BookingDetailModal)
        let serviceName = b.service_name || b.serviceName || b.service?.name || 'Consultation';

        // Check if this is a diagnostic booking
        const serviceTypeLower = (b.service_type || b.serviceType || '').toLowerCase();
        const serviceIdLower = (b.service_id || b.serviceId || '').toLowerCase();
        const serviceNameLower = (serviceName || '').toLowerCase();
        const serviceCategoryLower = (b.service_category || b.serviceCategory || '').toLowerCase();
        const vendorNameLower = (b.vendor_name || b.vendorName || '').toLowerCase();

        // ✅ ENHANCED: More robust diagnostic detection
        const isDiagnostic = serviceTypeLower === 'diagnostics' ||
          serviceCategoryLower === 'diagnostics' ||
          serviceIdLower === 'diagnostics' ||
          serviceIdLower.includes('diagnostic') ||
          serviceNameLower.includes('diagnostic') ||
          serviceNameLower.includes('lab') ||
          serviceNameLower.includes('test') ||
          serviceNameLower === 'x-ray' || // Common fallback name for diagnostics
          vendorNameLower.includes('dia cent') || // Specific vendor
          vendorNameLower.includes('diagnostic') ||
          vendorNameLower.includes('lab');

        // If diagnostic, try to get test names from notes or selected_services
        if (isDiagnostic) {
          try {
            let diagnosticTestNames: string[] = [];

            // Method 1: Parse notes.tests
            if (b.notes) {
              const notesData = typeof b.notes === 'string'
                ? JSON.parse(b.notes || '{}')
                : (b.notes || {});
              if (Array.isArray(notesData.tests) && notesData.tests.length > 0) {
                diagnosticTestNames = notesData.tests.map((t: any) => t.name || t.testName || t.test_name).filter(Boolean);
              }
            }

            // Method 2: Check selected_services
            if (diagnosticTestNames.length === 0 && b.selected_services) {
              const selectedServices = Array.isArray(b.selected_services)
                ? b.selected_services
                : (typeof b.selected_services === 'string' ? JSON.parse(b.selected_services || '[]') : []);
              if (selectedServices.length > 0) {
                diagnosticTestNames = selectedServices.map((s: any) => s.name || s.testName || s.test_name || s.serviceName).filter(Boolean);
              }
            }

            // Method 3: Check selectedServices (camelCase)
            if (diagnosticTestNames.length === 0 && b.selectedServices) {
              const selectedServices = Array.isArray(b.selectedServices) ? b.selectedServices : [];
              if (selectedServices.length > 0) {
                diagnosticTestNames = selectedServices.map((s: any) => s.name || s.testName || s.test_name || s.serviceName).filter(Boolean);
              }
            }

            // Use test names if found, otherwise keep the original service name
            if (diagnosticTestNames.length > 0) {
              serviceName = diagnosticTestNames.join(', ');
            }
          } catch (e) {
            console.warn('[MyBookings] Failed to parse diagnostic test names:', e);
          }
        }

        return {
          bookingId: b.id || b.bookingId,
          serviceType: b.service_type || b.serviceType || 'at_center',
          serviceName: serviceName,
          vendorId: b.vendor_id || b.vendorId,
          vendorName: b.vendor_name || b.vendorName || b.vendor?.business_name || b.vendor?.businessName || 'Unknown Vendor',
          vendorPhone: b.vendor_phone || b.vendorPhone || b.vendor?.phone, // ✅ FIX: Map vendor phone
          vendorContact: b.vendor_contact || b.vendorContact || b.vendor?.contact, // ✅ FIX: Map vendor contact
          vendorRating: b.vendor_rating ? Number(b.vendor_rating) : (b.vendor?.rating ? Number(b.vendor.rating) : undefined), // ✅ FIX: Map vendor rating
          staffId: b.staff_id || b.staffId,
          staffName: b.staff_name || b.staffName,
          petId: b.pet_id || b.petId || '',
          petName: b.pet_name || b.petName || 'N/A',
          customerPhone: b.customer_phone || b.customerPhone || phone,
          serviceStyle: b.service_style || b.serviceStyle || b.service_type || 'at_center',
          bookingDate: b.booking_date || b.bookingDate || b.scheduled_date,
          bookingTime: b.booking_time || b.bookingTime || b.scheduled_time || '',
          duration: b.duration || 30,
          price: parseFloat(b.total_amount || b.totalAmount || b.price || 0),
          paidAmount: parseFloat(b.total_amount || b.totalAmount || b.price || 0),
          basePrice: parseFloat(b.base_price || b.basePrice || 0) || undefined,
          discountAmount:
            parseFloat(b.discount_amount || b.discountAmount || 0) || undefined,
          couponCode: b.coupon_code || b.couponCode,
          status: b.status || 'pending',
          completionOTP: b.completion_otp || b.completionOTP,
          isPackage: Boolean(
            b.is_package ||
              b.isPackage ||
              b.package_purchase_id ||
              b.packagePurchaseId ||
              b.is_package_session ||
              b.isPackageSession
          ),
          packagePurchaseId:
            b.package_purchase_id ||
            b.packagePurchaseId ||
            b.package_details?.packagePurchaseId ||
            b.packageDetails?.packagePurchaseId,
          packageDetails: b.package_details || b.packageDetails,
          isPackageSession: Boolean(b.is_package_session ?? b.isPackageSession),
          packageSessionNumber:
            b.package_session_number != null
              ? Number(b.package_session_number)
              : b.packageSessionNumber != null
                ? Number(b.packageSessionNumber)
                : undefined,
          occurrences: b.occurrences,
          createdAt: b.created_at || b.createdAt,
          specialInstructions: b.notes || b.special_instructions,
          requiresStartOTP: b.requires_start_otp,
          startOTP: b.start_otp || b.startOTP,
          startTime: b.start_time,
          endTime: b.end_time,
          actualDuration: b.actual_duration,
          // ✅ Map OTP and payment status
          otpCode: b.otp_code || b.otpCode,
          otpVerified: b.otp_verified || b.otpVerified,
          paymentStatus: b.payment_status || b.paymentStatus,
          paymentHoldExpiresAt:
            b.payment_hold_expires_at || b.paymentHoldExpiresAt || null,
          paymentSources: derivePaymentSourcesFromBooking(b),
          completedAt:
            b.completed_at ||
            b.completedAt ||
            b.video_call_ended_at ||
            b.videoCallEndedAt ||
            '',
          cancelledAt: b.cancelled_at || b.cancelledAt || undefined,
          cancellationReason:
            b.cancellation_reason || b.cancellationReason || undefined,
          cancelledBy: b.cancelled_by ?? b.cancelledBy ?? null,
          refundSummary: b.refundSummary ?? b.refund_summary ?? null,
        };
      });

      // Hide package child session rows from My Bookings: a package purchase is
      // surfaced as ONE parent canonical booking. Per-session OTPs / tracker /
      // directions live on /my-packages → PackageSessionTrackingPanel, NOT here.
      const visibleBookings = mappedBookings.filter((b) => !b.isPackageSession);

      visibleBookings.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      setBookings(visibleBookings);
    } catch (error) {
      console.error('Error loading bookings:', error);
      setBookings([]);
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  };

  const refreshAfterHoldExpired = useCallback(() => {
    void loadBookings({ silent: true });
  }, [effectivePhone, phone]);

  const copyOTP = (otp: string, id: string) => {
    copyTextToClipboard(otp);
    setCopiedOTP(id);
    setTimeout(() => setCopiedOTP(null), 2000);
    toast.success('OTP copied to clipboard');
  };

  // ✅ Load refund preview (wallet = 100%; original = cancellation policy)
  const loadRefundPreview = async (booking: Booking, method: 'wallet' | 'original') => {
    setRefundPreviewLoading(true);
    try {
      const ps = String(booking.paymentStatus || '').toLowerCase();
      if (ps && !['paid', 'completed', 'pending_payment'].includes(ps)) {
        setEstimatedRefund({ percentage: 0, amount: 0, source: 'default', policyApplied: false });
        return;
      }
      const result = await apiClient.post('/customer/bookings/refund-preview', {
        bookingId: booking.bookingId,
        refundMethod: method,
      }) as any;
      const payload = (result as any)?.data ?? result;
      const refund = payload?.refund ?? payload;
      if (refund && typeof refund.refundPercentage === 'number') {
        setEstimatedRefund({
          percentage: refund.refundPercentage,
          amount: typeof refund.refundAmount === 'number' ? refund.refundAmount : 0,
          source: refund.source,
          policyApplied: refund.policyApplied,
          platformFeeApplies:
            refund.platformFeeApplies === true ||
            (typeof refund.platformFeeNonRefundable === 'number' && refund.platformFeeNonRefundable > 0),
        });
      } else {
        setEstimatedRefund({ percentage: 0, amount: 0, source: 'default', policyApplied: false });
      }
    } catch (error) {
      console.error('Error loading refund preview:', error);
      setEstimatedRefund({ percentage: 0, amount: 0, source: 'default', policyApplied: false });
    } finally {
      setRefundPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (!showCancelModal) return;
    const booking = bookings.find((b) => b.bookingId === showCancelModal);
    if (booking) {
      void loadRefundPreview(booking, refundMethod);
    }
  }, [showCancelModal, refundMethod]);

  // ✅ Handle cancel booking
  const handleCancelBooking = async (bookingId: string) => {
    if (!cancellationReason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }

    setProcessing(true);
    try {
      const result = await apiClient.post(`/bookings/${bookingId}/cancel`, {
        reason: cancellationReason,
        refundMethod: refundMethod,
      }) as any;

      const payload = getBookingResponsePayload(result);
      if (result.success) {
        toast.success(pickBookingApiMessage(result, 'Booking cancelled successfully'));
        const refund = (payload.refund ?? (result as any).refund) as Record<string, unknown> | null | undefined;
        if (refund && typeof refund.message === 'string' && refund.message.trim()) {
          toast.info(refund.message.trim());
        } else if (refund && typeof refund.amount === 'number' && refund.amount > 0) {
          toast.info(
            `Refund of ₹${refund.amount} will be credited to ${refundMethod === 'wallet' ? 'your wallet' : 'original payment method'}`
          );
        }
        setShowCancelModal(null);
        setCancellationReason('');
        loadBookings(); // Refresh list
      } else {
        const err = (result as any).error;
        const errText =
          typeof err === 'string' ? err : err && typeof err === 'object' && typeof err.message === 'string' ? err.message : null;
        toast.error(errText || 'Failed to cancel booking');
      }
    } catch (error: any) {
      console.error('Cancel booking error:', error);
      toast.error(error.message || 'Failed to cancel booking');
    } finally {
      setProcessing(false);
    }
  };

  // ✅ Open cancel modal and load refund policy
  const openCancelModal = (booking: Booking, e: React.MouseEvent) => {
    e.stopPropagation();
    setEstimatedRefund(null);
    setCancellationReason('');
    if (!bookingSourcesHasGatewayPayment(booking.paymentSources ?? [])) {
      setRefundMethod('wallet');
    }
    setShowCancelModal(booking.bookingId);
  };

  // ✅ Open reschedule modal
  const openRescheduleModal = (bookingId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowRescheduleModal(bookingId);
  };

  const handleResumePayment = async (booking: Booking, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onNavigate) {
      toast.error('Unable to open payment from here. Try booking again.');
      return;
    }
    try {
      const res = (await apiClient.get(
        `/customer/bookings/${booking.bookingId}/payment-resume?phone=${encodeURIComponent(effectivePhone)}`
      )) as { success?: boolean; resume?: Record<string, unknown>; error?: string };
      if (!res?.success || !res.resume) {
        toast.error(res?.error || 'Payment window expired');
        loadBookings();
        return;
      }
      const r = res.resume;
      const payable =
        typeof r.payableAmount === 'number'
          ? r.payableAmount
          : typeof r.amount === 'number'
            ? r.amount
            : Number(r.payableAmount ?? r.amount ?? 0);
      const basePrice =
        typeof r.basePrice === 'number' && r.basePrice > 0
          ? r.basePrice
          : Number(r.basePrice ?? r.base_price ?? 0);
      onNavigate('payment', {
        bookingId: r.bookingId,
        vendorId: r.vendorId,
        vendorName: r.vendorName,
        serviceId: r.serviceId,
        serviceName: r.serviceName,
        serviceType: r.serviceStyle || r.serviceType,
        serviceStyle: r.serviceStyle || r.serviceType,
        bookingDate: r.bookingDate,
        bookingTime: r.bookingTime,
        petId: r.petId,
        totalAmount: payable,
        price: basePrice > 0 ? basePrice : payable,
        basePrice: basePrice > 0 ? basePrice : undefined,
        lockedPayableAmount: payable,
        razorpayOrderId: r.razorpayOrderId,
        financialSnapshot: r.financialSnapshot ?? null,
        selectedServices: Array.isArray(r.selectedServices) ? r.selectedServices : undefined,
        flowType: 'payment-resume',
        returnScreen: 'my-bookings',
      });
    } catch (err: unknown) {
      console.error('[MyBookings] payment resume failed:', err);
      toast.error('Could not resume payment. Please try again.');
    }
  };

  // ✅ Check if booking can be cancelled/rescheduled
  const canCancelOrReschedule = (booking: Booking): boolean => {
    if (isPaymentHoldExpired(booking) || booking.status === 'cancelled') return false;
    return ['pending', 'pending_payment', 'confirmed'].includes(booking.status);
  };

  const getBookingStatusText = (booking: Booking): string => {
    if (isPaymentHoldExpired(booking)) return 'Cancelled';
    return getStatusText(booking.status);
  };

  // ✅ FIX: Ensure pending, confirmed, in_progress, arrived, scheduled all show in "Upcoming"
  const filteredBookings = bookings.filter(booking => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'upcoming') {
      return (
        ['pending', 'pending_payment', 'confirmed', 'in_progress', 'arrived', 'scheduled'].includes(
          booking.status
        ) && !isPaymentHoldExpired(booking)
      );
    }
    if (activeFilter === 'completed') {
      return (
        booking.status === 'completed' ||
        booking.status === 'cancelled' ||
        isPaymentHoldExpired(booking)
      );
    }
    return true;
  });

  const getStatusText = (status: string) => {
    if (status === 'pending_payment') return 'Pending payment';
    return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
  };

  if (selectedBooking) {
    return (
      <BookingDetailModal
        bookingId={selectedBooking.bookingId}
        petId={selectedBooking.petId}
        phone={phone}
        onClose={() => {
          if (openedFromInitialBookingRef.current && onCloseInitialBookingDetail) {
            openedFromInitialBookingRef.current = false;
            onCloseInitialBookingDetail();
            return;
          }
          setSelectedBooking(null);
        }}
        onReorderMedicine={onReorderMedicine}
        onNavigate={onNavigate}
      />
    );
  }

  // ✅ FIX: Include all active statuses in "Upcoming" count
  const dashboardStats = [
    {
      value: String(bookings.length),
      label: 'Total',
      accent: 'orange' as const,
      icon: <Calendar className="h-4 w-4" strokeWidth={2.25} aria-hidden />,
    },
    {
      value: String(
        bookings.filter((b) =>
          ['pending', 'confirmed', 'in_progress', 'arrived', 'scheduled'].includes(b.status)
        ).length
      ),
      label: 'Upcoming',
      accent: 'purple' as const,
      icon: <Clock className="h-4 w-4" strokeWidth={2.25} aria-hidden />,
    },
    {
      value: String(bookings.filter((b) => b.status === 'completed' || b.status === 'cancelled').length),
      label: 'Completed',
      accent: 'green' as const,
      icon: <CheckCircle2 className="h-4 w-4" strokeWidth={2.25} aria-hidden />,
    },
  ];

  return (
    <div className="min-h-screen w-full max-w-customer mx-auto bg-white">
      <ServiceDashboardHeader
        serviceName="My Bookings"
        serviceSubtitle="View and manage your appointments"
        serviceIcon={Calendar}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        onCloseToHome={onCloseToHome}
        headerVariant="premium"
        headerBackground={<BookingsHeaderBackground />}
        bottomEdge="flat"
      />

      <div
        className={`${MY_BOOKINGS_CONTENT_SHELL_CLASS} mx-auto max-w-customer space-y-4 px-4 pb-4 sm:px-5`}
        style={{ paddingBottom: 'max(1.25rem, var(--customer-tabbar-content-pad))' }}
      >
        {!reviewDemoAccount ? (
        <MyBookingsTrackingRow
          tone="emerald"
          icon={UtensilsCrossed}
          title="Meal Plan Orders & Tracking"
          description={
            mealPlanOrdersEnabled
              ? 'Track your meal plan deliveries and access order status'
              : 'Coming soon — track meal plan deliveries and order status here.'
          }
          disabled={!mealPlanOrdersEnabled}
          onClick={navigateToMealPlanOrders}
          ariaLabel={
            mealPlanOrdersEnabled
              ? 'Open meal plan orders and tracking'
              : 'Meal plan orders and tracking — coming soon'
          }
        />
        ) : null}

        {!reviewDemoAccount ? (
        <MyBookingsTrackingRow
          tone="blue"
          icon={Package}
          title="Pharmacy Orders & Tracking"
          description={
            PHARMACY_ORDERS_ENABLED
              ? 'Track your pharmacy orders and access order status'
              : 'Coming soon — pharmacy order tracking will be available here.'
          }
          disabled={!PHARMACY_ORDERS_ENABLED}
          showSoonBadge={!PHARMACY_ORDERS_ENABLED}
          onClick={navigateToPharmacyOrders}
          ariaLabel={
            PHARMACY_ORDERS_ENABLED
              ? 'Open pharmacy orders and tracking'
              : 'Pharmacy orders and tracking — coming soon'
          }
        />
        ) : null}

        <MyBookingsFilterTabs
          activeFilter={activeFilter}
          onFilterChange={(id) => setActiveFilter(id as MyBookingsFilterId)}
        />

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 my-bookings-fade-in">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-[0_4px_20px_rgba(15,23,42,0.08)]">
              <RefreshCw className="h-7 w-7 animate-spin text-[#FF8C42]" aria-hidden />
            </div>
            <p className="text-sm font-medium text-gray-500">Loading your bookings…</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <MyBookingsEmptyState activeFilter={activeFilter} />
        ) : (
          filteredBookings.map((booking, cardIndex) => {
            // ✅ DEBUG: Log serviceStyle/serviceType for home visit bookings
            const isAtHome = booking.serviceStyle === 'at_home' || booking.serviceType === 'at_home';
            if (booking.serviceName?.toLowerCase().includes('home visit') || isAtHome) {
              console.log('[MyBookings] Home Visit Booking:', {
                bookingId: booking.bookingId,
                serviceName: booking.serviceName,
                serviceStyle: booking.serviceStyle,
                serviceType: booking.serviceType,
                isAtHome,
                status: booking.status,
                willShowTracker: isAtHome && ['confirmed', 'in_progress', 'vendor_on_way', 'on_way'].includes(booking.status),
              });
            }
            return (
              <MyBookingsBookingCardShell
                key={booking.bookingId}
                animationDelayMs={Math.min(cardIndex * 45, 360)}
                onClick={() => setSelectedBooking(booking)}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1 leading-snug">{booking.serviceName}</h3>
                    {/* ✅ FIX: Format vendor name like "Hospital" for clinics, "Salon" for grooming */}
                    <p className="text-sm text-gray-600 font-medium">
                      {booking.vendorName}
                      {booking.serviceType === 'vet' || booking.serviceType === 'veterinarian' ? ' Hospital' :
                        booking.serviceType === 'grooming' ? ' Salon' :
                          booking.serviceType === 'training' ? ' Centre' : ''}
                    </p>
                    {/* ✅ NEW: Rating display on booking card */}
                    {booking.vendorRating && (
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs text-gray-600">{booking.vendorRating}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <MarketplaceStatus
                      label={getBookingStatusText(booking)}
                      tone={mapBookingStatusTone(booking.status, {
                        paymentHoldExpired: isPaymentHoldExpired(booking),
                      })}
                    />
                    {booking.paymentStatus === 'paid' && (
                      <>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          Paid
                        </span>
                        {booking.paymentSources && booking.paymentSources.length > 0 && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 max-w-[8rem] truncate text-right"
                            title={formatPaymentSourcesShortLabel(booking.paymentSources)}
                          >
                            {formatPaymentSourcesShortLabel(booking.paymentSources)}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <MyBookingsMetaRow icon={Calendar}>
                    {booking.status === 'completed' &&
                    isTeleBookingRow(booking) &&
                    booking.completedAt
                      ? formatIstBookingCompletedLine(
                          String(booking.bookingDate || '').slice(0, 10),
                          booking.completedAt,
                        )
                      : formatIstBookingWhen(
                          String(booking.bookingDate || '').slice(0, 10),
                          String(booking.bookingTime || ''),
                        )}
                  </MyBookingsMetaRow>
                  <MyBookingsMetaRow icon={MapPin}>
                    {getServiceStyleDisplayLabel(booking.serviceStyle, booking.serviceType, booking.serviceName)}
                  </MyBookingsMetaRow>
                </div>

                {isBookingAwaitingPayment(booking) &&
                booking.paymentStatus !== 'paid' &&
                (isPaymentHoldActive(booking) || isPaymentHoldExpired(booking)) ? (
                  <PendingPaymentHoldBanner
                    expiresAt={resolvePaymentHoldExpiresAt(booking)}
                    onPayNow={(e) => handleResumePayment(booking, e)}
                    onExpired={refreshAfterHoldExpired}
                  />
                ) : null}

                {/* ✅ ENHANCED: Quick Action Buttons (Directions for at_center, Tracker for at_home, Call, Review) */}
                {/* ✅ Directions button for at_center only - NEVER for at_home, tele, or video */}
                {(() => {
                  const isAtHome = booking.serviceStyle === 'at_home' || booking.serviceType === 'at_home';
                  const isTeleOrVideo = ['tele', 'video_consultation', 'video', 'online'].includes(booking.serviceStyle || '') ||
                    ['tele', 'video_consultation', 'video', 'online'].includes(booking.serviceType || '') ||
                    (booking.serviceName || '').toLowerCase().includes('video') ||
                    (booking.serviceName || '').toLowerCase().includes('tele');
                  const isAtCenter = (booking.serviceStyle === 'at_center' || booking.serviceType === 'at_center') && !isTeleOrVideo;
                  return !isAtHome && isAtCenter && !isTeleOrVideo && ['confirmed', 'pending', 'completed'].includes(booking.status);
                })() && (
                    <div className="mt-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <MyBookingsQuickAction
                        tone="blue"
                        icon={Navigation}
                        label="Directions"
                        onClick={(e) => {
                          e.stopPropagation();
                          const address = encodeURIComponent(booking.vendorName);
                          window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank');
                        }}
                      />
                      <MyBookingsQuickAction
                        tone="green"
                        icon={Phone}
                        label="Call"
                        onClick={(e) => {
                          e.stopPropagation();
                          const vendorPhone = booking.vendorPhone || booking.vendorContact;
                          if (vendorPhone) {
                            window.location.href = `tel:${vendorPhone}`;
                          } else {
                            toast.info('Vendor contact not available');
                          }
                        }}
                      />
                      {booking.status === 'completed' && (
                        <MyBookingsQuickAction
                          tone="yellow"
                          icon={Star}
                          label="Review"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowReviewModal({
                              bookingId: booking.bookingId,
                              vendorId: booking.vendorId,
                              serviceName: booking.serviceName,
                            });
                          }}
                        />
                      )}
                    </div>
                  )}

                {/* ✅ Tracker button for at_home services (replaces Directions) - check both serviceType and serviceStyle */}
                {/* ✅ Hide tracker when vendor has arrived or service is completed */}
                {/* ✅ Hide tracker for package parent rows — per-session tracker lives on /my-packages */}
                {(() => {
                  const isAtHome = booking.serviceStyle === 'at_home' || booking.serviceType === 'at_home';
                  const isPackageParent = Boolean(
                    (booking.isPackage || booking.packagePurchaseId) && !booking.isPackageSession
                  );
                  if (isPackageParent) return false;
                  // Show tracker for: confirmed, in_progress, vendor_on_way, on_way, in_transit
                  // Hide tracker for: arrived, completed, cancelled, pending
                  const showTrackerStatuses = ['confirmed', 'in_progress', 'vendor_on_way', 'on_way', 'in_transit', 'arrived'];
                  const hideTrackerStatuses = ['completed', 'cancelled'];
                  const shouldShowTracker = isAtHome &&
                    showTrackerStatuses.includes(booking.status) &&
                    !hideTrackerStatuses.includes(booking.status);

                  // Debug logging
                  if (isAtHome && !shouldShowTracker) {
                    console.log('[MyBookings] Tracker hidden for booking:', {
                      bookingId: booking.bookingId,
                      serviceStyle: booking.serviceStyle,
                      serviceType: booking.serviceType,
                      status: booking.status,
                      isAtHome,
                      isInShowList: showTrackerStatuses.includes(booking.status),
                      isInHideList: hideTrackerStatuses.includes(booking.status),
                    });
                  }

                  return shouldShowTracker;
                })() && (
                    <div className="mt-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <MyBookingsQuickAction
                        tone="blue"
                        icon={Navigation}
                        label="Tracker"
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('[MyBookings] Navigating to tracking page:', {
                            bookingId: booking.bookingId,
                            serviceStyle: booking.serviceStyle,
                            status: booking.status,
                            serviceName: booking.serviceName,
                          });
                          if (onNavigate) {
                            onNavigate('gps-tracking', { bookingId: booking.bookingId });
                          } else {
                            const trackingUrl = phone
                              ? `/tracking/${booking.bookingId}?phone=${encodeURIComponent(phone)}`
                              : `/tracking/${booking.bookingId}`;
                            router.push(trackingUrl);
                          }
                        }}
                      />
                      <MyBookingsQuickAction
                        tone="green"
                        icon={Phone}
                        label="Call"
                        onClick={(e) => {
                          e.stopPropagation();
                          const vendorPhone = booking.vendorPhone || booking.vendorContact;
                          if (vendorPhone) {
                            window.location.href = `tel:${vendorPhone}`;
                          } else {
                            toast.info('Vendor contact not available');
                          }
                        }}
                      />
                      {booking.status === 'completed' && (
                        <MyBookingsQuickAction
                          tone="yellow"
                          icon={Star}
                          label="Review"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowReviewModal({
                              bookingId: booking.bookingId,
                              vendorId: booking.vendorId,
                              serviceName: booking.serviceName,
                            });
                          }}
                        />
                      )}
                    </div>
                  )}

                {/* ✅ OTP Display for confirmed bookings (includes otpCode, completionOTP, startOTP) */}
                {/* Show OTP for confirmed bookings with OTP, regardless of payment status (handles COD) */}
                {/* Hide for package parent rows — per-session OTP lives on /my-packages */}
                {!(
                  (booking.isPackage || booking.packagePurchaseId) && !booking.isPackageSession
                ) &&
                  (booking.otpCode || booking.completionOTP || booking.startOTP) &&
                  customerBookingStatusShowsCheckInOtp(booking.status) &&
                  !booking.otpVerified && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between bg-orange-50 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <Key className="w-4 h-4 text-orange-600" />
                          <span className="text-sm font-medium text-orange-800">
                            {booking.serviceStyle === 'at_home' || booking.serviceType === 'at_home'
                              ? 'Service OTP'
                              : booking.serviceStyle === 'at_center' || booking.serviceType === 'at_center'
                                ? 'Check-in OTP'
                                : 'Booking OTP'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-lg font-bold text-orange-600 tracking-wider">
                            {showOTP === booking.bookingId
                              ? (booking.otpCode || booking.completionOTP || booking.startOTP)
                              : '****'}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowOTP(showOTP === booking.bookingId ? null : booking.bookingId);
                            }}
                            className="p-1 hover:bg-orange-100 rounded"
                          >
                            {showOTP === booking.bookingId ? <EyeOff className="w-4 h-4 text-orange-600" /> : <Eye className="w-4 h-4 text-orange-600" />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyOTP((booking.otpCode || booking.completionOTP || booking.startOTP)!, booking.bookingId);
                            }}
                            className="p-1 hover:bg-orange-100 rounded"
                          >
                            {copiedOTP === booking.bookingId ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-orange-600" />}
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 text-center">
                        {booking.serviceStyle === 'at_home' || booking.serviceType === 'at_home'
                          ? 'Share this OTP with the vendor when they arrive'
                          : booking.serviceStyle === 'at_center' || booking.serviceType === 'at_center'
                            ? 'Share this OTP with the vendor at check-in'
                            : 'Share this OTP with the vendor to complete the service'}
                      </p>
                    </div>
                  )}

                {/* OTP Verified Badge — hidden for package parent rows */}
                {booking.otpVerified &&
                  !(
                    (booking.isPackage || booking.packagePurchaseId) && !booking.isPackageSession
                  ) && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center gap-2 bg-green-50 rounded-lg p-2 text-green-700">
                        <Check className="w-4 h-4" />
                        <span className="text-sm">Check-in completed</span>
                      </div>
                    </div>
                  )}

                {/* End-of-service OTP: shown after vendor used start OTP (walker / at-home in_progress) */}
                {/* Hide for package parent rows — per-session end OTP lives on /my-packages */}
                {!(
                  (booking.isPackage || booking.packagePurchaseId) && !booking.isPackageSession
                ) &&
                  booking.otpVerified &&
                  booking.status === 'in_progress' &&
                  (booking.serviceStyle === 'at_home' || booking.serviceType === 'at_home') &&
                  (booking.completionOTP || booking.otpCode) && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/90 p-3" onClick={(e) => e.stopPropagation()}>
                      <div className="mb-2 flex items-center gap-2">
                        <Key className="h-4 w-4 text-amber-800" />
                        <span className="text-sm font-semibold text-amber-900">End-of-service OTP</span>
                      </div>
                      <p className="mb-2 text-xs text-amber-900/90">
                        When the walk or visit is finished, share this code with your provider so they can complete the booking.
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-lg font-bold tracking-wider text-amber-950">
                          {showCompletionOtpFor === booking.bookingId
                            ? String(booking.completionOTP || booking.otpCode)
                            : '••••••'}
                        </span>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowCompletionOtpFor(
                                showCompletionOtpFor === booking.bookingId ? null : booking.bookingId
                              );
                            }}
                            className="rounded p-1.5 hover:bg-amber-100"
                            aria-label={showCompletionOtpFor === booking.bookingId ? 'Hide OTP' : 'Show OTP'}
                          >
                            {showCompletionOtpFor === booking.bookingId ? (
                              <EyeOff className="h-4 w-4 text-amber-800" />
                            ) : (
                              <Eye className="h-4 w-4 text-amber-800" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyOTP(String(booking.completionOTP || booking.otpCode), `${booking.bookingId}-end`);
                            }}
                            className="rounded p-1.5 hover:bg-amber-100"
                            aria-label="Copy end OTP"
                          >
                            {copiedOTP === `${booking.bookingId}-end` ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4 text-amber-800" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                {booking.status === 'cancelled' && (
                  <div className="mt-3 space-y-2">
                    <div className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2.5">
                      <p className="text-sm font-semibold text-rose-900">
                        {cancelledByLabel(booking.cancelledBy)}
                      </p>
                      {humanizeCancellationReason(booking.cancellationReason) ? (
                        <p className="text-xs text-rose-800/80 mt-0.5 line-clamp-2">
                          {humanizeCancellationReason(booking.cancellationReason)}
                        </p>
                      ) : null}
                    </div>
                    {(() => {
                      const refundCopy = buildRefundStripCopy(booking.refundSummary);
                      if (!refundCopy) return null;
                      return (
                        <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                          <p className="text-sm font-semibold text-emerald-900">
                            {refundCopy.title}
                          </p>
                          <p className="text-xs text-emerald-800/80 mt-0.5">
                            {refundCopy.subtitle}
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {booking.isPackage &&
                  (booking.packageDetails || booking.packagePurchaseId) && (
                  <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm min-w-0">
                      <Package className="w-4 h-4 shrink-0 text-purple-600" />
                      <span className="text-purple-600">
                        {booking.packageDetails
                          ? booking.packageDetails.unlimited
                            ? 'Unlimited package'
                            : `${booking.packageDetails.completedSessions ?? 0}/${booking.packageDetails.totalSessions ?? '—'} sessions completed`
                          : 'Package session'}
                      </span>
                    </div>
                    {(booking.packagePurchaseId ||
                      booking.packageDetails?.packagePurchaseId) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const pid =
                            booking.packagePurchaseId || booking.packageDetails?.packagePurchaseId;
                          if (!pid) return;
                          router.push('/my-packages');
                        }}
                        className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 font-medium"
                      >
                        Track package
                      </button>
                    )}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                  <div>
                    {(() => {
                      const fin = extractBookingFinancial({
                        notes: booking.specialInstructions,
                        base_price: booking.basePrice,
                        total_amount: booking.paidAmount ?? booking.price,
                        discount_amount: booking.discountAmount,
                        coupon_code: booking.couponCode,
                        payment_status: booking.paymentStatus,
                        paymentSources: booking.paymentSources,
                      });
                      const allIn =
                        fin.finalPaid > 0.009
                          ? fin.finalPaid
                          : resolveBookingListAllInAmount({
                              specialInstructions: booking.specialInstructions,
                              paidAmount: booking.paidAmount,
                              price: booking.price,
                              paymentSources: booking.paymentSources,
                            });
                      const priceView = buildBookingCardPriceView(fin, allIn);

                      return (
                        <BookingListCardPricing
                          view={priceView}
                          couponCode={booking.couponCode}
                          isPaid={fin.isPaid}
                        />
                      );
                    })()}
                    {booking.paymentStatus === 'paid' &&
                      booking.paymentSources &&
                      booking.paymentSources.length > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          via {formatPaymentSourcesShortLabel(booking.paymentSources)}
                        </p>
                      )}
                  </div>

                  {/* ✅ Action Buttons */}
                  {canCancelOrReschedule(booking) && (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => openRescheduleModal(booking.bookingId, e)}
                        className="text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center gap-1"
                      >
                        <CalendarClock className="w-3 h-3" />
                        Reschedule
                      </button>
                      <button
                        onClick={(e) => openCancelModal(booking, e)}
                        className="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-1"
                      >
                        <XCircle className="w-3 h-3" />
                        Cancel
                      </button>
                    </div>
                  )}

                  {!canCancelOrReschedule(booking) && (
                    <span className="flex items-center gap-0.5 text-sm font-semibold text-[#FF8C42]">
                      View
                      <ChevronRight className="w-5 h-5" aria-hidden />
                    </span>
                  )}
                </div>
              </MyBookingsBookingCardShell>
            );
          })
        )}
      </div>

      {/* ✅ Cancel Booking Modal */}
      {showCancelModal && (() => {
        const cancelModalBooking = bookings.find((b) => b.bookingId === showCancelModal);
        const canRefundToOriginal = bookingSourcesHasGatewayPayment(
          cancelModalBooking?.paymentSources ?? []
        );
        return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500" />
                Cancel Booking
              </h3>
              <button
                onClick={() => {
                  setShowCancelModal(null);
                  setCancellationReason('');
                  setEstimatedRefund(null);
                }}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Refund Method Selection */}
            {estimatedRefund && estimatedRefund.amount > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Refund to</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setRefundMethod('wallet')}
                    className={`flex-1 p-3 rounded-lg border-2 flex items-center justify-center gap-2 ${refundMethod === 'wallet'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <Wallet className="w-5 h-5" />
                    <span className="font-medium">Warmpawz Wallet</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => canRefundToOriginal && setRefundMethod('original')}
                    disabled={!canRefundToOriginal}
                    className={`flex-1 p-3 rounded-lg border-2 flex items-center justify-center gap-2 ${refundMethod === 'original'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                      } ${!canRefundToOriginal ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <CreditCard className="w-5 h-5" />
                    <span className="font-medium">Original Payment</span>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {refundMethod === 'wallet'
                    ? '100% refund to your Warmpawz wallet — cancellation policy does not apply'
                    : canRefundToOriginal
                      ? 'Refund per cancellation policy to original payment (5–7 business days). Wallet portion returns to wallet if split-paid.'
                      : 'Original payment refund is unavailable for wallet-only bookings.'}
                </p>
              </div>
            )}

            {/* Refund estimate */}
            {(refundPreviewLoading || estimatedRefund) && (
              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Refund Information</h4>
                {refundPreviewLoading && !estimatedRefund ? (
                  <p className="text-sm text-blue-700">Loading refund estimate…</p>
                ) : estimatedRefund ? (
                  <>
                    <p className="text-sm text-blue-700">
                      {refundMethod === 'wallet' ? (
                        <>
                          <span className="font-semibold">100%</span> refund to Warmpawz wallet
                          <span className="block text-xs text-blue-600 mt-1">
                            Cancellation policy does not apply for wallet refunds
                          </span>
                        </>
                      ) : (
                        <>
                          {(estimatedRefund.policyApplied && estimatedRefund.source !== 'default')
                            ? 'Refund as per cancellation policy'
                            : 'Estimated refund per cancellation policy'}{' '}
                          <span className="font-semibold">{estimatedRefund.percentage}%</span>
                          {estimatedRefund.source && estimatedRefund.source !== 'wallet_full_refund' && (
                            <span className="block text-xs text-blue-600 mt-1">
                              Source: {(estimatedRefund.source || '').replace(/_/g, ' ')}
                              {!estimatedRefund.policyApplied && ' (no policy configured)'}
                            </span>
                          )}
                        </>
                      )}
                    </p>
                    {refundMethod === 'original' && estimatedRefund.platformFeeApplies && (
                      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5 mt-2">
                        Platform fee is not refundable.
                      </p>
                    )}
                    <p className="text-lg font-bold text-blue-800 mt-1">
                      Estimated Refund: {formatPriceWithSymbol(estimatedRefund.amount)}
                    </p>
                  </>
                ) : null}
              </div>
            )}

            {/* Reason Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Reason for cancellation *</label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Please provide a reason for cancellation..."
                className="w-full p-3 border rounded-lg resize-none h-24 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCancelModal(null);
                  setCancellationReason('');
                }}
                className="flex-1 py-3 px-4 rounded-lg border border-gray-300 font-medium hover:bg-gray-50"
                disabled={processing}
              >
                Keep Booking
              </button>
              <button
                onClick={() => handleCancelBooking(showCancelModal)}
                disabled={processing || !cancellationReason.trim()}
                className="flex-1 py-3 px-4 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Confirm Cancellation'
                )}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ✅ Reschedule Booking Modal */}
      {showRescheduleModal && (
        <RescheduleModal
          bookingId={showRescheduleModal}
          booking={bookings.find(b => b.bookingId === showRescheduleModal)!}
          onClose={() => setShowRescheduleModal(null)}
          onRescheduled={() => {
            setShowRescheduleModal(null);
            loadBookings();
            toast.success('Booking rescheduled successfully');
          }}
        />
      )}

      {/* ✅ FIX: Review Modal */}
      {showReviewModal && (
        <RateServiceModal
          bookingId={showReviewModal.bookingId}
          vendorId={showReviewModal.vendorId}
          vendorName={bookings.find(b => b.bookingId === showReviewModal.bookingId)?.vendorName || 'Vendor'}
          customerId={phone}
          onClose={() => setShowReviewModal(null)}
          onSuccess={() => {
            setShowReviewModal(null);
            loadBookings(); // Reload to show updated review status
            toast.success('Thank you for your review!');
          }}
        />
      )}
    </div>
  );
}

// ✅ Reschedule Modal Component
function RescheduleModal({
  bookingId,
  booking,
  onClose,
  onRescheduled
}: {
  bookingId: string;
  booking: Booking;
  onClose: () => void;
  onRescheduled: () => void;
}) {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<{ time: string; available: boolean; booked?: boolean }[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Generate next 30 days
  const generateDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 1; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push({
        date: formatLocalDateYYYYMMDD(date),
        label: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      });
    }
    return dates;
  };

  const dates = generateDates();

  // Load available slots when date changes
  useEffect(() => {
    if (selectedDate && booking.vendorId) {
      loadAvailableSlots();
    }
  }, [selectedDate]);

  const loadAvailableSlots = async () => {
    setLoading(true);
    try {
      const result = await apiClient.get(
        `/customer/vendor/${booking.vendorId}/available-slots?date=${encodeURIComponent(selectedDate)}&serviceStyle=${encodeURIComponent(booking.serviceStyle || 'at_center')}`
      ) as any;
      setAvailableSlots(result.slots || []);
    } catch (error) {
      console.error('Error loading slots:', error);
      setAvailableSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!selectedDate || !selectedTime) {
      toast.error('Please select date and time');
      return;
    }

    setProcessing(true);
    try {
      const result = await apiClient.post(`/bookings/${bookingId}/reschedule`, {
        newDate: selectedDate,
        newTime: selectedTime,
      }) as any;

      if (result.success) {
        toast.success(pickBookingApiMessage(result, 'Booking rescheduled successfully'));
        onRescheduled();
      } else {
        const err = (result as any).error;
        const errText =
          typeof err === 'string' ? err : err && typeof err === 'object' && typeof err.message === 'string' ? err.message : null;
        toast.error(errText || 'Failed to reschedule');
      }
    } catch (error: any) {
      console.error('Reschedule error:', error);
      toast.error(error.message || 'Failed to reschedule booking');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-blue-500" />
            Reschedule Booking
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Current Booking Info */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-600">Current Appointment</p>
            <p className="font-medium">{booking.serviceName}</p>
            <p className="text-sm text-gray-700">
              {booking.status === 'completed' &&
              isTeleBookingRow(booking) &&
              booking.completedAt
                ? formatIstBookingCompletedLine(
                    String(booking.bookingDate || '').slice(0, 10),
                    booking.completedAt,
                  )
                : formatIstBookingWhen(
                    String(booking.bookingDate || '').slice(0, 10),
                    String(booking.bookingTime || ''),
                  )}
            </p>
          </div>

          {/* Date Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Select New Date</label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {dates.map(({ date, label }) => (
                <button
                  key={date}
                  onClick={() => {
                    setSelectedDate(date);
                    setSelectedTime('');
                  }}
                  className={`p-2 rounded-lg border text-sm transition-colors ${selectedDate === date
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white border-gray-200 hover:border-orange-300'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Time Selection */}
          {selectedDate && (
            <div>
              <label className="block text-sm font-medium mb-2">Select New Time</label>
              {loading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-orange-500" />
                </div>
              ) : availableSlots.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No slots available for this date</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.time}
                      onClick={() => slot.available && setSelectedTime(slot.time)}
                      disabled={!slot.available}
                      className={`p-2 rounded-lg border text-sm transition-colors ${selectedTime === slot.time
                          ? 'bg-orange-500 text-white border-orange-500'
                          : slot.available
                            ? 'bg-white border-gray-200 hover:border-orange-300'
                            : slot.booked
                              ? 'bg-red-50 text-red-400 border-red-200 cursor-not-allowed line-through'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                      {slot.time}
                      {slot.booked && <span className="block text-[10px]">Booked</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="sticky bottom-0 bg-white p-4 border-t flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-lg border border-gray-300 font-medium hover:bg-gray-50"
            disabled={processing}
          >
            Cancel
          </button>
          <button
            onClick={handleReschedule}
            disabled={processing || !selectedDate || !selectedTime}
            className="flex-1 py-3 px-4 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              'Confirm Reschedule'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
