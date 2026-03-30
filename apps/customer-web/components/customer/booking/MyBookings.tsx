'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft, Clock, MapPin, Calendar, Check, X, Copy,
  AlertCircle, RefreshCw, Eye, EyeOff, Package, ChevronRight,
  Key, XCircle, CalendarClock, Wallet, CreditCard, Phone, Star,
  Navigation, MessageSquare, UtensilsCrossed,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { copyTextToClipboard } from '@/lib/shareUtils';
import { getServiceStyleDisplayLabel, formatPriceWithSymbol } from '@/lib/booking-display-utils';
import { extractBookingsArray } from '@/lib/customer-booking-normalize';

import { useRouter } from 'next/navigation';
import { BookingDetailModal } from '../BookingDetailModal';
import { RateServiceModal } from '../RateServiceModal';
import { ServiceDashboardHeader } from '../shared/ServiceDashboardHeader';

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
  /** Backend may return additional values (e.g. scheduled, vendor_on_way). */
  status: string;
  completionOTP?: string;
  isPackage: boolean;
  packageDetails?: {
    totalSessions: number;
    completedSessions: number;
    frequency: string;
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
}

interface MyBookingsProps {
  phone: string;
  onBack: () => void;
  initialBookingId?: string; // To open a specific booking
  onReorderMedicine?: (medications: any[]) => void;
  onNavigate?: (screen: string, data?: { bookingId?: string }) => void; // For diagnostics-reports, sample-collection-tracking, etc.
}

export function MyBookings({ phone, onBack, initialBookingId, onReorderMedicine, onNavigate }: MyBookingsProps) {
  const router = useRouter();
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

  // ✅ New state for cancel/reschedule modals
  const [showCancelModal, setShowCancelModal] = useState<string | null>(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<'wallet' | 'original'>('wallet');
  const [processing, setProcessing] = useState(false);
  const [estimatedRefund, setEstimatedRefund] = useState<{ percentage: number; amount: number; source?: string; policyApplied?: boolean } | null>(null);
  // ✅ FIX: Add state for review modal
  const [showReviewModal, setShowReviewModal] = useState<{ bookingId: string; vendorId: string; serviceName: string } | null>(null);

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
        setSelectedBooking(booking);
      }
    }
  }, [initialBookingId, bookings]);

  const loadBookings = async () => {
    try {
      setLoading(true);

      if (!phone && !effectivePhone) {
        console.warn('[MyBookings] No phone available; skipping bookings fetch');
        setBookings([]);
        return;
      }

      // Prefer phone-convenience endpoint (normalizes phone formats like +91 / 10-digit).
      let result: any;
      try {
        result = await apiClient.get<any>(
          `/customer/bookings?phone=${encodeURIComponent(effectivePhone)}`
        );
      } catch (primaryError) {
        // Backward compatibility fallback for deployments where convenience route is unavailable.
        console.warn('[MyBookings] Primary bookings endpoint failed, falling back:', primaryError);
        result = await apiClient.get<any>(
          `/customer/${encodeURIComponent(effectivePhone)}/bookings`
        );
      }

      const rawBookings = extractBookingsArray(result);

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
          bookingId: String(b.id ?? b.booking_id ?? b.bookingId ?? ''),
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
          status: String(b.status ?? b.booking_status ?? b.bookingStatus ?? 'pending'),
          completionOTP: b.completion_otp || b.completionOTP,
          isPackage: b.is_package || b.isPackage || false,
          packageDetails: b.package_details || b.packageDetails,
          occurrences: b.occurrences,
          createdAt: b.created_at || b.createdAt,
          specialInstructions: b.notes || b.special_instructions,
          requiresStartOTP: b.requires_start_otp,
          startOTP: b.start_otp,
          startTime: b.start_time,
          endTime: b.end_time,
          actualDuration: b.actual_duration,
          // ✅ Map OTP and payment status
          otpCode: b.otp_code || b.otpCode,
          otpVerified: b.otp_verified || b.otpVerified,
          paymentStatus: b.payment_status || b.paymentStatus,
        };
      });

      // Sort: most recent bookings first
      mappedBookings.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      setBookings(mappedBookings.filter((row) => row.bookingId));
    } catch (error) {
      console.error('Error loading bookings:', error);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const copyOTP = (otp: string, id: string) => {
    copyTextToClipboard(otp);
    setCopiedOTP(id);
    setTimeout(() => setCopiedOTP(null), 2000);
    toast.success('OTP copied to clipboard');
  };

  // ✅ Load refund preview based on actual backend policy (refund tiers / rules)
  const loadRefundPreview = async (booking: Booking) => {
    try {
      if (booking.paymentStatus !== 'paid') {
        setEstimatedRefund({ percentage: 0, amount: 0, source: 'default', policyApplied: false });
        return;
      }
      const result = await apiClient.post('/customer/bookings/refund-preview', { bookingId: booking.bookingId }) as any;
      const payload = (result as any)?.data ?? result;
      const refund = payload?.refund ?? payload;
      if (refund && typeof refund.refundPercentage === 'number') {
        setEstimatedRefund({
          percentage: refund.refundPercentage,
          amount: typeof refund.refundAmount === 'number' ? refund.refundAmount : 0,
          source: refund.source,
          policyApplied: refund.policyApplied,
        });
      } else {
        setEstimatedRefund({ percentage: 0, amount: 0, source: 'default', policyApplied: false });
      }
    } catch (error) {
      console.error('Error loading refund preview:', error);
      setEstimatedRefund({ percentage: 0, amount: 0, source: 'default', policyApplied: false });
    }
  };

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

      const payload = result.data ?? result;
      if (result.success) {
        toast.success('Booking cancelled successfully');
        const refund = payload.refund ?? result.refund;
        if (refund && typeof refund.amount === 'number') {
          toast.success(`Refund of ₹${refund.amount} will be credited to ${refundMethod === 'wallet' ? 'your wallet' : 'original payment method'}`);
        }
        setShowCancelModal(null);
        setCancellationReason('');
        loadBookings(); // Refresh list
      } else {
        toast.error(result.error || 'Failed to cancel booking');
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
    loadRefundPreview(booking);
    setShowCancelModal(booking.bookingId);
  };

  // ✅ Open reschedule modal
  const openRescheduleModal = (bookingId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowRescheduleModal(bookingId);
  };

  // ✅ Check if booking can be cancelled/rescheduled
  const canCancelOrReschedule = (booking: Booking): boolean => {
    // Can only cancel/reschedule pending or confirmed bookings
    return ['pending', 'confirmed'].includes(booking.status);
  };

  // ✅ FIX: Ensure pending, confirmed, in_progress, arrived, scheduled all show in "Upcoming"
  const filteredBookings = bookings.filter(booking => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'upcoming') {
      // Include all active booking statuses
      return ['pending', 'confirmed', 'in_progress', 'arrived', 'scheduled'].includes(booking.status);
    }
    if (activeFilter === 'completed') {
      return booking.status === 'completed' || booking.status === 'cancelled';
    }
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-orange-100 text-orange-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string | undefined | null) => {
    const s = String(status ?? 'pending').replace(/_/g, ' ').trim() || 'pending';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  if (selectedBooking) {
    return (
      <BookingDetailModal
        bookingId={selectedBooking.bookingId}
        petId={selectedBooking.petId}
        phone={phone}
        onClose={() => setSelectedBooking(null)}
        onReorderMedicine={onReorderMedicine}
        onNavigate={onNavigate}
      />
    );
  }

  // ✅ FIX: Include all active statuses in "Upcoming" count
  const dashboardStats = [
    { value: String(bookings.length), label: 'Total' },
    { value: String(bookings.filter(b => ['pending', 'confirmed', 'in_progress', 'arrived', 'scheduled'].includes(b.status)).length), label: 'Upcoming' },
    { value: String(bookings.filter(b => b.status === 'completed' || b.status === 'cancelled').length), label: 'Completed' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-customer mx-auto">
      <ServiceDashboardHeader
        serviceName="My Bookings"
        serviceSubtitle="View and manage your appointments"
        serviceIcon={Calendar}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-[#FF8C42]"
      />

      <div className="max-w-customer mx-auto">
        {/* Meal Plan Orders - Access meal tracker at will (OBJECTIVE 1) */}
        <div className="px-4 py-3 bg-white border-b border-gray-100">
          <button
            onClick={() => router.push(phone ? `/orders/meal-plans?phone=${encodeURIComponent(phone)}` : '/orders/meal-plans')}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 font-medium hover:bg-emerald-100 transition-colors"
          >
            <UtensilsCrossed className="w-5 h-5" />
            Meal Plan Orders & Tracking
          </button>
          <p className="text-xs text-gray-500 mt-1.5 text-center">Track your meal plan deliveries and access order status</p>
        </div>

        {/* Pharmacy Orders - Access pharmacy order tracker */}
        <div className="px-4 py-3 bg-white border-b border-gray-100">
          <button
            onClick={() => router.push(phone ? `/orders/pharmacy?phone=${encodeURIComponent(phone)}` : '/orders/pharmacy')}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 font-medium hover:bg-blue-100 transition-colors"
          >
            <Package className="w-5 h-5" />
            Pharmacy Orders & Tracking
          </button>
          <p className="text-xs text-gray-500 mt-1.5 text-center">Track your pharmacy orders and access order status</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 px-4 py-3 bg-white border-b border-gray-100">
          {[
            { id: 'all', label: 'All' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'completed', label: 'Completed' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as any)}
              className={`flex-1 py-2 px-4 rounded-lg text-sm transition-colors ${activeFilter === tab.id
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings List */}
      <div className="max-w-customer mx-auto p-4 space-y-3 pb-20">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <RefreshCw className="w-8 h-8 text-[#FF8C42] animate-spin" />
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="text-center py-20">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No bookings found</p>
            <p className="text-sm text-gray-400 mt-1">
              {activeFilter === 'all' ? 'Book your first service to get started!' : `No ${activeFilter} bookings`}
            </p>
          </div>
        ) : (
          filteredBookings.map((booking) => {
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
              <div
                key={booking.bookingId}
                onClick={() => setSelectedBooking(booking)}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:border-[#FF8C42] cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-medium mb-1">{booking.serviceName}</h3>
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
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(booking.status)}`}>
                      {getStatusText(booking.status)}
                    </span>
                    {booking.paymentStatus === 'paid' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        Paid
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(booking.bookingDate).toLocaleDateString()} at {booking.bookingTime}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{getServiceStyleDisplayLabel(booking.serviceStyle, booking.serviceType, booking.serviceName)}</span>
                  </div>
                </div>

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
                    <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Open Google Maps with vendor location
                          const address = encodeURIComponent(booking.vendorName);
                          window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank');
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-sm font-medium"
                      >
                        <Navigation className="w-4 h-4" />
                        Directions
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Trigger call (on mobile) or show number
                          const vendorPhone = booking.vendorPhone || booking.vendorContact;
                          if (vendorPhone) {
                            window.location.href = `tel:${vendorPhone}`;
                          } else {
                            toast.info('Vendor contact not available');
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 text-sm font-medium"
                      >
                        <Phone className="w-4 h-4" />
                        Call
                      </button>
                      {/* ✅ NEW: Review button for completed bookings */}
                      {booking.status === 'completed' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // ✅ FIX: Open RateServiceModal directly instead of navigation
                            setShowReviewModal({
                              bookingId: booking.bookingId,
                              vendorId: booking.vendorId,
                              serviceName: booking.serviceName
                            });
                          }}
                          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-yellow-50 text-yellow-600 rounded-lg hover:bg-yellow-100 text-sm font-medium"
                        >
                          <Star className="w-4 h-4" />
                          Review
                        </button>
                      )}
                    </div>
                  )}

                {/* ✅ Tracker button for at_home services (replaces Directions) - check both serviceType and serviceStyle */}
                {/* ✅ Hide tracker when vendor has arrived or service is completed */}
                {(() => {
                  const isAtHome = booking.serviceStyle === 'at_home' || booking.serviceType === 'at_home';
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
                    <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // ✅ Navigate to tracking page via in-app navigation
                          console.log('[MyBookings] Navigating to tracking page:', {
                            bookingId: booking.bookingId,
                            serviceStyle: booking.serviceStyle,
                            status: booking.status,
                            serviceName: booking.serviceName,
                          });
                          if (onNavigate) {
                            onNavigate('gps-tracking', { bookingId: booking.bookingId });
                          } else {
                            // Fallback: direct navigation (requires CloudFront rewrite)
                            const trackingUrl = phone
                              ? `/tracking/${booking.bookingId}?phone=${encodeURIComponent(phone)}`
                              : `/tracking/${booking.bookingId}`;
                            router.push(trackingUrl);
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-sm font-medium"
                      >
                        <Navigation className="w-4 h-4" />
                        Tracker
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Trigger call (on mobile) or show number
                          const vendorPhone = booking.vendorPhone || booking.vendorContact;
                          if (vendorPhone) {
                            window.location.href = `tel:${vendorPhone}`;
                          } else {
                            toast.info('Vendor contact not available');
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 text-sm font-medium"
                      >
                        <Phone className="w-4 h-4" />
                        Call
                      </button>
                      {/* ✅ NEW: Review button for completed bookings */}
                      {booking.status === 'completed' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowReviewModal({
                              bookingId: booking.bookingId,
                              vendorId: booking.vendorId,
                              serviceName: booking.serviceName
                            });
                          }}
                          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-yellow-50 text-yellow-600 rounded-lg hover:bg-yellow-100 text-sm font-medium"
                        >
                          <Star className="w-4 h-4" />
                          Review
                        </button>
                      )}
                    </div>
                  )}

                {/* ✅ OTP Display for confirmed bookings (includes otpCode, completionOTP, startOTP) */}
                {/* Show OTP for confirmed bookings with OTP, regardless of payment status (handles COD) */}
                {(booking.otpCode || booking.completionOTP || booking.startOTP) &&
                  (booking.status === 'confirmed' || booking.status === 'in_progress' || booking.status === 'arrived') &&
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

                {/* OTP Verified Badge */}
                {booking.otpVerified && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center gap-2 bg-green-50 rounded-lg p-2 text-green-700">
                      <Check className="w-4 h-4" />
                      <span className="text-sm">Check-in completed</span>
                    </div>
                  </div>
                )}

                {booking.isPackage && booking.packageDetails && (
                  <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Package className="w-4 h-4 text-purple-600" />
                      <span className="text-purple-600">
                        {booking.packageDetails.completedSessions}/{booking.packageDetails.totalSessions} sessions completed
                      </span>
                    </div>
                    {/* ✅ View Package button to track multi-visit packages */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Navigate to package tracking - could use a callback prop or router
                        window.location.href = `/packages/${booking.bookingId}`;
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 font-medium"
                    >
                      Track Package
                    </button>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                  <span className="font-medium">{formatPriceWithSymbol(booking.price)}</span>

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
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ✅ Cancel Booking Modal */}
      {showCancelModal && (
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

            {/* Refund Policy Info */}
            {estimatedRefund && (
              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Refund Information</h4>
                <p className="text-sm text-blue-700">
                  {(estimatedRefund.policyApplied && estimatedRefund.source !== 'default')
                    ? 'Refund as per policy'
                    : 'Estimated refund'}{' '}
                  <span className="font-semibold">{estimatedRefund.percentage}%</span>
                </p>
                {estimatedRefund.source && (
                  <p className="text-xs text-blue-600 mt-1">
                    Source: {(estimatedRefund.source || '').replace(/_/g, ' ')}
                    {!estimatedRefund.policyApplied && ' (no policy configured)'}
                  </p>
                )}
                <p className="text-lg font-bold text-blue-800 mt-1">
                  Estimated Refund: {formatPriceWithSymbol(estimatedRefund.amount)}
                </p>
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
                    onClick={() => setRefundMethod('original')}
                    className={`flex-1 p-3 rounded-lg border-2 flex items-center justify-center gap-2 ${refundMethod === 'original'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <CreditCard className="w-5 h-5" />
                    <span className="font-medium">Original Payment</span>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {refundMethod === 'wallet'
                    ? 'Instant credit to your Warmpawz wallet for future bookings'
                    : 'Refund to original payment method (3-7 business days)'}
                </p>
              </div>
            )}

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
      )}

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
        date: date.toISOString().split('T')[0],
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
        `/customer/vendor/${booking.vendorId}/available-slots?date=${selectedDate}&serviceStyle=${booking.serviceStyle || 'at_center'}`
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
        onRescheduled();
      } else {
        toast.error(result.error || 'Failed to reschedule');
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
              {new Date(booking.bookingDate).toLocaleDateString()} at {booking.bookingTime}
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
