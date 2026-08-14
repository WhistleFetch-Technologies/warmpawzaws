'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Calendar, Clock, User, Phone, Mail, Navigation, X, AlertTriangle, Wallet as WalletIcon, Video, MessageSquare, HelpCircle, Copy, Key, Check } from 'lucide-react';
import { navigateToBookingSupport } from '@/lib/support-contact';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { copyTextToClipboard } from '@/lib/shareUtils';
import { isWarmpawzPayEnabled } from '@/lib/warmpawz-pay/wpay-feature-flag';
import {
  getResolvedCustomerId,
  isCustomerDatabaseUuid,
  persistCustomerDatabaseId,
} from '@/lib/customer-id-storage';
import { ServiceDashboardHeader } from './shared/ServiceDashboardHeader';
import { formatPriceWithSymbol, customerBookingShowsServiceOtp } from '@/lib/booking-display-utils';
import { isPackageCustomerCancelAllowed } from '@/lib/package-cancel-eligibility';
import {
  derivePaymentSourcesFromBooking,
  bookingSourcesHasGatewayPayment,
} from '@/lib/payment-display-utils';
import {
  isWarmpawzAppointmentsBookingRow,
  isWarmpawzNutritionBookingRow,
  resolveCustomerBookingDisplayName,
} from '@/lib/warmpawz-appointments-customer';

type AppointmentRefundEstimate = {
  percentage: number;
  amount: number;
  platformFeeApplies: boolean;
  source?: string;
  eligible?: boolean;
  policyApplied?: boolean;
};

interface AppointmentDetailsViewProps {
  appointmentId: string;
  /** Login phone — used to resolve DB customer UUID for API auth. */
  phone: string;
  onBack: () => void;
  onReschedule?: (appointmentId: string) => void;
  onCancel?: (appointmentId: string) => void;
}

export function normalizeAppointmentDetailPayload(raw: Record<string, unknown> | null | undefined) {
  if (!raw) return { appointment: null as any, vendor: null as any, staff: null as any, location: null as any };
  const date = String(raw.appointment_date ?? raw.date ?? '');
  let timeRaw = String(raw.appointment_time ?? raw.startTime ?? raw.start_time ?? '0:0');
  if (timeRaw.length > 5 && timeRaw.includes('.')) timeRaw = timeRaw.split('.')[0] ?? timeRaw;
  const serviceStyle = String(raw.service_style ?? raw.serviceStyle ?? '').toLowerCase() || 'at_center';

  const catalogFallback = String(
    raw.joined_service_name ?? raw.booking_service_name ?? raw.service_name ?? raw.serviceName ?? 'Service',
  );

  const appointment = {
    ...raw,
    date: date || raw.date,
    startTime: timeRaw,
    serviceName: resolveCustomerBookingDisplayName(raw, catalogFallback),
    serviceStyle,
    duration: raw.duration,
    status: String(raw.status ?? 'scheduled').toLowerCase(),
    amount: raw.amount ?? raw.total_amount,
    vendorId: raw.vendor_id ?? raw.vendorId,
    vendorName: raw.vendor_name ?? raw.vendorName,
    staffId: raw.staff_id ?? raw.staffId,
    bookingId: raw.booking_id ?? raw.bookingId,
    otpCode: raw.otp_code ?? raw.otpCode ?? raw.completion_otp ?? raw.completionOTP,
    otpVerified: Boolean(raw.otp_verified ?? raw.otpVerified),
    commerceMode: raw.commerce_mode ?? raw.commerceMode,
  };

  const vendorName = String(raw.vendor_name ?? '');
  const vendorPhone = raw.vendor_phone != null ? String(raw.vendor_phone) : undefined;
  const vendor =
    vendorName || vendorPhone
      ? { clinicName: vendorName, fullName: vendorName, phone: vendorPhone, email: undefined }
      : null;

  const addr = raw.vendor_address != null ? String(raw.vendor_address) : '';
  const location =
    addr || vendorName
      ? { name: vendorName || 'Location', address: addr || vendorName, latitude: raw.latitude, longitude: raw.longitude }
      : null;

  return { appointment, vendor, staff: null, location };
}

async function resolveCustomerDatabaseIdForPhone(loginPhone: string): Promise<string | null> {
  const cached = getResolvedCustomerId();
  if (cached) return cached;
  if (!loginPhone?.trim()) return null;
  try {
    const res = (await apiClient.get(
      `/customer/profile?phone=${encodeURIComponent(loginPhone.trim())}`
    )) as Record<string, unknown>;
    const p = (res.profile ?? res) as Record<string, unknown>;
    const id = p?.id ?? p?.customer_id;
    if (typeof id === 'string' && isCustomerDatabaseUuid(id)) {
      persistCustomerDatabaseId(id);
      return id;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function AppointmentDetailsView({
  appointmentId,
  phone,
  onBack,
  onReschedule,
  onCancel
}: AppointmentDetailsViewProps) {
  const router = useRouter();
  const [appointment, setAppointment] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [staff, setStaff] = useState<any>(null);
  const [location, setLocation] = useState<any>(null);
  const [customerDbId, setCustomerDbId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<'wallet' | 'original'>('wallet');
  const [cancelling, setCancelling] = useState(false);
  const [estimatedRefund, setEstimatedRefund] = useState<AppointmentRefundEstimate | null>(null);
  const [refundPreviewLoading, setRefundPreviewLoading] = useState(false);
  const [copiedOtp, setCopiedOtp] = useState(false);

  const loadAppointmentDetails = useCallback(async () => {
    if (!appointmentId || appointmentId === 'undefined') return;
    const id = appointmentId.trim();
    if (!id) return;
    try {
      setLoading(true);
      const cid = await resolveCustomerDatabaseIdForPhone(phone);
      setCustomerDbId(cid);
      if (!cid) {
        setAppointment(null);
        setVendor(null);
        setStaff(null);
        setLocation(null);
        return;
      }
      const q = `customerId=${encodeURIComponent(cid)}`;
      const data = await apiClient.get<{ appointment?: Record<string, unknown> }>(
        `/appointment/${id}?${q}`
      );
      const raw = data.appointment ?? (data as any).data?.appointment;
      const normalized = normalizeAppointmentDetailPayload(
        raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
      );
      setAppointment(normalized.appointment);
      setVendor(normalized.vendor);
      setStaff(normalized.staff);
      setLocation(normalized.location);
    } catch (error) {
      console.error('Error loading appointment:', error);
      setAppointment(null);
    } finally {
      setLoading(false);
    }
  }, [appointmentId, phone]);

  useEffect(() => {
    loadAppointmentDetails();
  }, [loadAppointmentDetails]);

  const loadRefundPreview = useCallback(async (method: 'wallet' | 'original') => {
    const id = appointmentId.trim();
    if (!id) return;
    setRefundPreviewLoading(true);
    setEstimatedRefund(null);
    try {
      const ps = String(
        appointment?.payment_status ?? appointment?.paymentStatus ?? ''
      ).toLowerCase();
      if (ps && !['paid', 'completed', 'pending_payment'].includes(ps)) {
        setEstimatedRefund({ percentage: 0, amount: 0, platformFeeApplies: false });
        return;
      }
      const result = (await apiClient.post('/customer/bookings/refund-preview', {
        bookingId: id,
        refundMethod: method,
      })) as Record<string, unknown>;
      const payload = (result as any)?.data ?? result;
      const refund = (payload as any)?.refund ?? payload;
      if (refund && typeof refund.refundPercentage === 'number') {
        setEstimatedRefund({
          percentage: refund.refundPercentage,
          amount: typeof refund.refundAmount === 'number' ? refund.refundAmount : 0,
          platformFeeApplies:
            refund.platformFeeApplies === true ||
            (typeof refund.platformFeeNonRefundable === 'number' && refund.platformFeeNonRefundable > 0),
          source: typeof refund.source === 'string' ? refund.source : undefined,
          eligible: typeof refund.eligible === 'boolean' ? refund.eligible : undefined,
          policyApplied: refund.policyApplied === true,
        });
      } else {
        setEstimatedRefund({ percentage: 0, amount: 0, platformFeeApplies: false });
      }
    } catch {
      setEstimatedRefund({ percentage: 0, amount: 0, platformFeeApplies: false });
    } finally {
      setRefundPreviewLoading(false);
    }
  }, [appointmentId, appointment?.payment_status, appointment?.paymentStatus]);

  useEffect(() => {
    if (!showCancelModal) return;
    void loadRefundPreview(refundMethod);
  }, [showCancelModal, refundMethod, loadRefundPreview]);

  const openCancelAppointmentModal = () => {
    setCancelReason('');
    setEstimatedRefund(null);
    const sources = derivePaymentSourcesFromBooking(appointment ?? {});
    if (!bookingSourcesHasGatewayPayment(sources)) {
      setRefundMethod('wallet');
    }
    setShowCancelModal(true);
  };

  if (!appointmentId || appointmentId === 'undefined' || !appointmentId.trim()) {
    return null;
  }

  const handleGetDirections = () => {
    if (location?.latitude && location?.longitude) {
      // Open Google Maps with directions
      const url = `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`;
      window.open(url, '_blank');
    } else if (location?.address) {
      // Fallback to address search
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}`;
      window.open(url, '_blank');
    }
  };

  const handleCancelAppointment = async () => {
    if (!cancelReason.trim()) {
      alert('Please provide a reason for cancellation');
      return;
    }

    if (!customerDbId) {
      alert('Unable to verify your account. Please try again.');
      return;
    }

    try {
      setCancelling(true);
      const data = await apiClient.post<{ success?: boolean }>(
        `/appointment/${appointmentId.trim()}/cancel?customerId=${encodeURIComponent(customerDbId)}`,
        {
          reason: cancelReason,
          refundMethod
        }
      );

      if (data.success !== false) {
        const root = ((data as any)?.data ?? data) as Record<string, unknown>;
        const refund = root?.refund as { amount?: number; message?: string } | undefined;
        const refundAmount = typeof refund?.amount === 'number' ? refund.amount : 0;
        const msg =
          typeof refund?.message === 'string' && refund.message.trim()
            ? refund.message.trim()
            : refundAmount > 0
              ? `Refund of ₹${refundAmount.toFixed(2)} will be processed to your ${refundMethod === 'wallet' ? 'wallet' : 'original payment method'}.`
              : 'Appointment cancelled successfully.';
        alert(`Appointment cancelled successfully! ${msg}`);
        setShowCancelModal(false);
        setEstimatedRefund(null);
        loadAppointmentDetails(); // Refresh
        if (onCancel) onCancel(appointmentId);
      } else {
        alert((data as any).error || 'Failed to cancel appointment');
      }
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      alert('Failed to cancel appointment');
    } finally {
      setCancelling(false);
    }
  };

  const canReschedule = () => {
    if (!appointment) return false;
    if (appointment.status === 'completed' || appointment.status === 'cancelled') return false;
    if (appointment.status === 'in_progress') return false;
    if (appointment.isPackage && appointment.completedSessions > 0) return false;
    return true;
  };

  const canCancel = () => {
    if (!appointment) return false;
    if (appointment.status === 'completed' || appointment.status === 'cancelled') return false;
    if (appointment.status === 'in_progress') return false;
    return isPackageCustomerCancelAllowed({
      isPackage: appointment.isPackage,
      packageDetails: { completedSessions: appointment.completedSessions },
    });
  };

  const isTeleActive =
    appointment?.serviceStyle === 'tele' &&
    (appointment?.status === 'confirmed' ||
      appointment?.status === 'scheduled' ||
      appointment?.status === 'in_progress');

  const formatDate = (date: string) => {
    if (!date) return '—';
    const d = new Date(date.includes('T') ? date : `${date}T12:00:00`);
    if (Number.isNaN(d.getTime())) return date;
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-customer mx-auto">
        <ServiceDashboardHeader
          serviceName="Appointment"
          serviceSubtitle="Loading details…"
          serviceIcon={Calendar}
          stats={[
            { value: '…', label: 'Date' },
            { value: '…', label: 'Status' },
          ]}
          onBack={onBack}
          showBackButton
        />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-purple-200 border-t-purple-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading appointment…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-customer mx-auto">
        <ServiceDashboardHeader
          serviceName="Appointment"
          serviceSubtitle="Not available"
          serviceIcon={Calendar}
          stats={[
            { value: '—', label: 'Date' },
            { value: '—', label: 'Status' },
          ]}
          onBack={onBack}
          showBackButton
        />
        <div className="flex items-center justify-center py-16 px-4">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <p className="text-gray-900 font-medium">We could not load this appointment</p>
            <p className="text-sm text-gray-500 mt-1">It may have been removed or you may need to sign in again.</p>
            <Button onClick={onBack} className="mt-6 rounded-xl bg-[#FF8C42] hover:bg-[#e67d35]">
              Go back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const statDate =
    appointment.date &&
    formatDate(typeof appointment.date === 'string' ? appointment.date : String(appointment.date));
  const statStatus = (appointment.status || '').replace(/_/g, ' ') || '—';
  const isWapptAppointment = isWarmpawzAppointmentsBookingRow(appointment);
  const showServiceOtp = customerBookingShowsServiceOtp({
    status: appointment.status,
    otpVerified: appointment.otpVerified,
    otpCode: appointment.otpCode,
    isWappt: isWapptAppointment,
  });
  const showPayBillCta =
    isWapptAppointment &&
    isWarmpawzPayEnabled() &&
    appointment.status !== 'cancelled' &&
    Boolean(String(appointment.vendorId ?? '').trim());

  return (
    <>
      <div className="min-h-screen bg-gray-50 w-full max-w-customer mx-auto pb-24">
        <ServiceDashboardHeader
          serviceName="Appointment"
          serviceSubtitle={appointment.serviceName || 'Details'}
          serviceIcon={Calendar}
          stats={[
            { value: statDate || '—', label: 'When' },
            { value: statStatus, label: 'Status' },
          ]}
          onBack={onBack}
          showBackButton
        />

      <div className="p-4 space-y-4">
        {/* Date & Time */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-gray-900 mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#FF8C42]" />
            Date & Time
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Date</span>
              <span className="text-gray-900">{formatDate(appointment.date)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Time</span>
              <span className="text-gray-900">{formatTime(appointment.startTime)}</span>
            </div>
            {appointment.duration && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Duration</span>
                <span className="text-gray-900">{appointment.duration} minutes</span>
              </div>
            )}
          </div>
        </div>

        {/* Service Details */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <h3 className="text-gray-900 mb-3">Service Information</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Service</span>
              <span className="text-gray-900">{appointment.serviceName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Type</span>
              <span className="text-gray-900">
                {appointment.serviceStyle === 'at_home' ? '🏠 Home Visit' :
                 appointment.serviceStyle === 'tele' ? '📹 Video Consultation' :
                 '🏥 At Center'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {isWarmpawzAppointmentsBookingRow(appointment) &&
                appointment.serviceStyle !== 'tele' &&
                !isWarmpawzNutritionBookingRow(appointment)
                  ? 'Appointment fee'
                  : 'Amount'}
              </span>
              <span className="text-green-600">₹{appointment.amount}</span>
            </div>
          </div>
        </div>

        {showServiceOtp && (
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Key className="w-5 h-5 text-orange-700" />
              <div>
                <h3 className="font-semibold text-orange-900">
                  {appointment.status === 'completed' ? 'Service completion OTP' : 'Check-in OTP'}
                </h3>
                <p className="text-xs text-orange-700">
                  Share this code with your provider to confirm the visit
                </p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 mb-3 text-center">
              <span className="text-3xl font-bold text-orange-600 tracking-[0.4em] font-mono">
                {String(appointment.otpCode)}
              </span>
            </div>
            <Button
              type="button"
              className="w-full bg-orange-500 hover:bg-orange-600"
              onClick={() => {
                copyTextToClipboard(String(appointment.otpCode));
                setCopiedOtp(true);
                setTimeout(() => setCopiedOtp(false), 2000);
              }}
            >
              {copiedOtp ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy OTP
                </>
              )}
            </Button>
          </div>
        )}

        {showPayBillCta && (
          <Button
            type="button"
            className="w-full bg-[#FF8C42] hover:bg-[#e67d35] text-white"
            onClick={() => {
              const vendorId = String(appointment.vendorId).trim();
              router.push(`/warmpawz-pay/vendors/${encodeURIComponent(vendorId)}`);
            }}
          >
            Pay Bill by Warmpawz
          </Button>
        )}

        {/* Staff Details */}
        {staff && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="text-gray-900 mb-3 flex items-center gap-2">
              <User className="w-5 h-5 text-[#FF8C42]" />
              Staff Details
            </h3>
            <div className="flex items-center gap-3">
              {staff.photo ? (
                <img src={staff.photo} alt={staff.fullName} className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="w-6 h-6 text-gray-500" />
                </div>
              )}
              <div className="flex-1">
                <p className="text-gray-900">{staff.fullName}</p>
                <p className="text-sm text-gray-600">{staff.roleType}</p>
              </div>
            </div>
          </div>
        )}

        {/* Location Details (for at_center appointments) */}
        {location && appointment.serviceStyle === 'at_center' && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="text-gray-900 mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#FF8C42]" />
              Location
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-gray-900">{location.name}</p>
                <p className="text-sm text-gray-600 mt-1">{location.address}</p>
              </div>
              <Button
                onClick={handleGetDirections}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white"
              >
                <Navigation className="w-4 h-4 mr-2" />
                Get Directions
              </Button>
            </div>
          </div>
        )}

        {/* Vendor/Clinic Details */}
        {vendor && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="text-gray-900 mb-3">Clinic/Vendor</h3>
            <div className="space-y-2">
              <p className="text-gray-900">{vendor.clinicName || vendor.fullName}</p>
              {vendor.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4" />
                  <a href={`tel:${vendor.phone}`} className="text-[#FF8C42]">{vendor.phone}</a>
                </div>
              )}
              {vendor.email && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4" />
                  <a href={`mailto:${vendor.email}`} className="text-[#FF8C42]">{vendor.email}</a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Package Details */}
        {appointment.isPackage && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="text-blue-900 mb-2">Package Booking</h3>
            <div className="space-y-1 text-sm">
              <p className="text-blue-800">
                Total Sessions: {appointment.totalSessions || 0}
              </p>
              <p className="text-blue-800">
                Completed: {appointment.completedSessions || 0} / {appointment.totalSessions || 0}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {appointment.status !== 'completed' && appointment.status !== 'cancelled' && (
          <div className="space-y-3">
            {/* ✅ FIX #3: Add video call button for tele consultations */}
            {isTeleActive && (
              <Button
                onClick={() => {
                  // ✅ FIX: Use router.push with path format for CloudFront compatibility
                  if (customerDbId && isCustomerDatabaseUuid(customerDbId)) {
                    persistCustomerDatabaseId(customerDbId);
                  }
                  router.push(`/video/${appointmentId}`);
                }}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Video className="w-4 h-4 mr-2" />
                Join Video Call
              </Button>
            )}
            
            {canReschedule() && onReschedule && (
              <Button
                onClick={() => onReschedule(appointmentId)}
                className="w-full bg-blue-500 hover:bg-blue-600"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Reschedule Appointment
              </Button>
            )}
            {canCancel() && (
              <Button
                onClick={openCancelAppointmentModal}
                variant="outline"
                className="w-full border-red-500 text-red-500 hover:bg-red-50"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel Appointment
              </Button>
            )}
          </div>
        )}
        
        {/* ✅ FIX #2: Add chat button for tele consultations during confirmed/in_progress */}
        {isTeleActive && (
          <Button
            onClick={() => {
              window.location.href = `/booking/${appointmentId}?chat=true`;
            }}
            variant="outline"
            className="w-full mt-3 border-gray-300 text-gray-700"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Chat with Provider
          </Button>
        )}

        <Button
          onClick={() => {
            const bookingId = String(appointment?.bookingId || appointment?.id || appointmentId);
            navigateToBookingSupport(router, {
              bookingId,
              serviceName: appointment?.serviceName,
              bookingDate: appointment?.date,
              amount: appointment?.amount,
              status: appointment?.status,
              vendorName: appointment?.vendorName || vendor?.clinicName,
            });
          }}
          variant="outline"
          className="w-full mt-3 border-[#FF8C42]/40 text-[#FF8C42] hover:bg-[#FFF3E8]"
        >
          <HelpCircle className="w-4 h-4 mr-2" />
          Need help with this booking
        </Button>

        {/* Cancellation Info (if cancelled) */}
        {appointment.status === 'cancelled' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <h3 className="text-red-900 mb-2">Cancellation Details</h3>
            <div className="space-y-1 text-sm">
              <p className="text-red-800">
                Cancelled by: {appointment.cancelledBy}
              </p>
              <p className="text-red-800">
                Reason: {appointment.cancellationReason}
              </p>
              {appointment.refundAmount > 0 && (
                <>
                  <p className="text-green-800 mt-2">
                    Refund: ₹{appointment.refundAmount}
                  </p>
                  {appointment.cancellationFee > 0 && (
                    <p className="text-red-800">
                      Cancellation fee: ₹{appointment.cancellationFee}
                    </p>
                  )}
                  <p className="text-gray-700">
                    Refund method: {appointment.refundMethod === 'wallet' ? 'Wallet' : 'Original Payment'}
                  </p>
                  <p className="text-gray-700">
                    Status: {appointment.refundStatus}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (() => {
        const canRefundToOriginal = bookingSourcesHasGatewayPayment(
          derivePaymentSourcesFromBooking(appointment ?? {})
        );
        return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl text-gray-900">Cancel Appointment</h2>
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setEstimatedRefund(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Refund Method Selection */}
              {estimatedRefund && estimatedRefund.amount > 0 && (
              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  Select Refund Method
                </label>
                <div className="space-y-2">
                  <button
                    onClick={() => setRefundMethod('wallet')}
                    className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                      refundMethod === 'wallet'
                        ? 'border-[#FF8C42] bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <WalletIcon className={`w-5 h-5 ${refundMethod === 'wallet' ? 'text-[#FF8C42]' : 'text-gray-500'}`} />
                      <div className="flex-1">
                        <p className={`text-sm ${refundMethod === 'wallet' ? 'text-[#FF8C42]' : 'text-gray-900'}`}>
                          Refund to Wallet
                        </p>
                        <p className="text-xs text-gray-600">
                          100% refund to wallet — cancellation policy does not apply
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => canRefundToOriginal && setRefundMethod('original')}
                    disabled={!canRefundToOriginal}
                    className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                      refundMethod === 'original'
                        ? 'border-[#FF8C42] bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    } ${!canRefundToOriginal ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <Navigation className={`w-5 h-5 ${refundMethod === 'original' ? 'text-[#FF8C42]' : 'text-gray-500'}`} />
                      <div className="flex-1">
                        <p className={`text-sm ${refundMethod === 'original' ? 'text-[#FF8C42]' : 'text-gray-900'}`}>
                          Refund to Original Payment
                        </p>
                        <p className="text-xs text-gray-600">
                          {canRefundToOriginal
                            ? 'Refund per cancellation policy to card/UPI (5–7 business days). Wallet portion returns to wallet if split-paid.'
                            : 'Unavailable for wallet-only payments.'}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
              )}

              {(refundPreviewLoading || estimatedRefund) && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <h4 className="font-medium text-blue-800 mb-2">Refund Information</h4>
                  {refundPreviewLoading && !estimatedRefund ? (
                    <p className="text-sm text-gray-600">Loading refund estimate…</p>
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
                            Refund as per cancellation policy{' '}
                            <span className="font-semibold">{estimatedRefund.percentage}%</span>
                            {estimatedRefund.source && estimatedRefund.source !== 'wallet_full_refund' ? (
                              <span className="block text-xs text-blue-600 mt-1">
                                Source:{' '}
                                {estimatedRefund.source === 'vendor_refund_tiers'
                                  ? 'vendor refund tiers'
                                  : estimatedRefund.source.replace(/_/g, ' ')}
                              </span>
                            ) : null}
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

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-900">
                  {refundMethod === 'wallet'
                    ? 'Wallet refunds are 100% with no cancellation policy deductions.'
                    : 'Original payment refunds follow the cancellation policy shown above.'}
                </p>
              </div>

              {/* Cancellation Reason */}
              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  Reason for Cancellation *
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Please let us know why you're cancelling..."
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setShowCancelModal(false);
                    setEstimatedRefund(null);
                  }}
                  variant="outline"
                  className="flex-1"
                  disabled={cancelling}
                >
                  Keep Appointment
                </Button>
                <Button
                  onClick={handleCancelAppointment}
                  className="flex-1 bg-red-500 hover:bg-red-600"
                  disabled={cancelling || !cancelReason.trim()}
                >
                  {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                </Button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </>
  );
}
