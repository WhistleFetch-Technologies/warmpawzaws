'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, Calendar, Clock, MapPin, Copy, Check, User, Phone, Package, Info, FileText, MessageCircle, Video, PhoneCall, Download, Share2, Star, Navigation, Key, Eye, EyeOff, HelpCircle } from 'lucide-react';
import { navigateToBookingSupport } from '@/lib/support-contact';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { customerBookingStatusShowsCheckInOtp } from '@/lib/booking-display-utils';
import { copyTextToClipboard } from '@/lib/shareUtils';
import { PrescriptionModal } from './PrescriptionModal';
import { PrescriptionHistoryModal } from './PrescriptionHistoryModal';
import { CommunicationHub } from '../communication/CommunicationHub';
import { LiveTrackingMap } from '../tracking/LiveTrackingMap';
import { FollowUpBookingModal } from './FollowUpBookingModal';
import { RateServiceModal } from './RateServiceModal';
import { PaymentSourcesDisplay } from './payment/PaymentSourcesDisplay';
import { normalizePaymentSources } from '@/lib/payment-display-utils';
import { downloadBookingInvoice, getBookingInvoiceDownloadMessage } from '@/lib/booking-invoice-download';
import {
  isBookingAwaitingPayment,
  isPaymentHoldActive,
  isPaymentHoldExpired,
  PaymentHoldBanner,
  resolvePaymentHoldExpiresAt,
} from '@/lib/payment-hold-ui';

interface BookingDetailModalProps {
  bookingId: string;
  petId: string;
  phone: string;
  onClose: () => void;
  onReorderMedicine?: (medications: any[], prescriptionId?: string, bookingId?: string) => void;
  onNavigate?: (screen: string, data?: any) => void; // ✅ FIX: Add navigation handler for video calls
}

/** Prefer business/display fields over raw `name` (often a slug or internal label). */
function pickDisplayName(...candidates: (string | undefined | null)[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

function resolveVendorDisplayName(raw: Record<string, any>): string {
  const v = raw.vendor;
  return (
    pickDisplayName(
      v?.business_name,
      v?.businessName,
      v?.display_name,
      v?.displayName,
      v?.trade_name,
      v?.tradeName,
      raw.vendorDisplayName,
      raw.vendor_display_name,
      raw.vendorName,
      raw.vendor_name,
      v?.name
    ) || 'Vendor'
  );
}

function resolveDoctorDisplayName(raw: Record<string, any>): string {
  const d = raw.doctor;
  return pickDisplayName(
    d?.display_name,
    d?.displayName,
    d?.full_name,
    d?.fullName,
    d?.business_name,
    d?.businessName,
    raw.doctorName,
    raw.doctor_name,
    d?.name
  );
}

// ✅ FIX: Helper function to format service style labels
function getServiceStyleLabel(serviceStyle: string | null | undefined): string {
  if (!serviceStyle) return '';
  
  const styleMap: Record<string, string> = {
    'tele': 'Video Consultation',
    'at_home': 'At Home',
    'at_center': 'At Center',
    'at_vendor': 'At Center',
    'online': 'Video Consultation',
  };
  
  return styleMap[serviceStyle] || serviceStyle.replace('_', ' ');
}

// Wireframe: Prescription and medical records only for vet, diagnostics, nutritionist (tele). Not for grooming, training, walker, behaviourist, sitter.
const SERVICE_TYPES_WITH_PRESCRIPTION = ['vet', 'veterinarian', 'diagnostics', 'nutritionist', 'pet_nutritionist'];

/**
 * Check if booking should show prescription/medical records options
 * Checks serviceType, serviceCategory, and notes for diagnostic tests
 */
function showPrescriptionAndMedicalRecords(
  serviceType: string | undefined,
  serviceCategory?: string | undefined,
  booking?: any
): boolean {
  // Check serviceType
  if (serviceType) {
    const normalizedType = (serviceType || '').toLowerCase().replace(/\s/g, '_');
    if (SERVICE_TYPES_WITH_PRESCRIPTION.some(t => normalizedType.includes(t) || t.includes(normalizedType))) {
      return true;
    }
  }

  // Check serviceCategory
  if (serviceCategory) {
    const normalizedCategory = (serviceCategory || '').toLowerCase().replace(/\s/g, '_');
    if (SERVICE_TYPES_WITH_PRESCRIPTION.some(t => normalizedCategory.includes(t) || t.includes(normalizedCategory))) {
      return true;
    }
  }

  // Check if booking has diagnostic tests in notes (for diagnostics bookings where serviceType might be "at_home")
  if (booking?.notes) {
    try {
      const notesData = typeof booking.notes === 'string' ? JSON.parse(booking.notes) : booking.notes;
      if (Array.isArray(notesData?.tests) && notesData.tests.length > 0) {
        return true; // Has diagnostic tests
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  // Check if booking has isDiagnostic flag or hasDiagnosticTests
  if (booking?.isDiagnostic || booking?.hasDiagnosticTests) {
    return true;
  }

  return false;
}

/** Booking includes lab/diagnostic work (diagnostics service or tests on a vet booking). */
function bookingHasLabWork(booking: any): boolean {
  if (!booking) return false;
  if (booking.isDiagnostic || booking.hasDiagnosticTests) return true;

  const serviceType = String(booking.serviceType || booking.service_type || '').toLowerCase();
  const serviceCategory = String(booking.serviceCategory || booking.service_category || '').toLowerCase();
  const serviceId = String(booking.serviceId || booking.service_id || '').toLowerCase();

  if (
    serviceType.includes('diagnostic') ||
    serviceCategory.includes('diagnostic') ||
    serviceId === 'diagnostics'
  ) {
    return true;
  }

  if (booking.notes) {
    try {
      const notesData = typeof booking.notes === 'string' ? JSON.parse(booking.notes) : booking.notes;
      if (Array.isArray(notesData?.tests) && notesData.tests.length > 0) {
        return true;
      }
    } catch {
      // ignore
    }
  }

  return false;
}

function bookingLabReportsActionVisible(booking: any): boolean {
  if (!bookingHasLabWork(booking)) return false;

  const statusStr = String(booking.status || '');
  const statusLower = statusStr.toLowerCase().replace(/\s/g, '_').replace(/-/g, '_');

  return (
    statusLower === 'reports_ready' ||
    statusLower === 'reportsready' ||
    statusLower === 'completed' ||
    statusLower === 'sample_collected' ||
    statusLower === 'ready' ||
    (statusLower.includes('report') && statusLower.includes('ready'))
  );
}

function normalizeBookingStatus(booking: Record<string, any> | null | undefined): string {
  if (!booking) return '';
  if (
    isPaymentHoldExpired({
      status: booking.status,
      paymentHoldExpiresAt: booking.paymentHoldExpiresAt,
      createdAt: booking.createdAt || booking.created_at,
    })
  ) {
    return 'cancelled';
  }
  return String(booking.status || '')
    .trim()
    .toLowerCase()
    .replace(/\s/g, '_')
    .replace(/-/g, '_');
}

/** Clinical bookings: show entry on any status except cancelled-with-no-documents. */
function customerPrescriptionsDocumentsEntryVisible(
  booking: Record<string, any> | undefined,
  documentCount: number,
): boolean {
  if (!booking || !showPrescriptionAndMedicalRecords(booking.serviceType, booking.serviceCategory, booking)) {
    return false;
  }
  const status = normalizeBookingStatus(booking);
  if (status === 'cancelled' || status === 'no_show') {
    return documentCount > 0;
  }
  return true;
}

function customerPrescriptionsAllowUpload(booking: Record<string, any> | undefined): boolean {
  const status = normalizeBookingStatus(booking);
  return status === 'completed';
}

function countPrescriptionDocuments(prescriptionRows: any[], medicalRecords: any[]): number {
  const seen = new Set<string>();
  let count = 0;

  for (const record of medicalRecords) {
    if (record?.record_type === 'diagnostic_report') continue;
    const id = record?.id ? String(record.id) : '';
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    count += 1;
  }

  for (const row of prescriptionRows) {
    if (!row?.id) continue;
    const id = String(row.id);
    if (seen.has(id)) continue;
    seen.add(id);
    count += 1;
  }

  return count;
}

function BookingDetailPaymentHoldBanner({
  expiresAt,
  onPayNow,
  onExpired,
}: {
  expiresAt: string | null | undefined;
  onPayNow: () => void;
  onExpired?: () => void;
}) {
  return (
    <PaymentHoldBanner
      expiresAt={expiresAt}
      onPayNow={() => onPayNow()}
      onExpired={onExpired}
      holdMessage="Your slot is held until the timer ends."
    />
  );
}

interface Prescription {
  id: string;
  bookingId: string;
  diagnosis: string;
  symptoms: string;
  prescription: string;
  notes: string;
  createdAt: string;
  medicines?: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
  }>;
}

export function BookingDetailModal({ bookingId, petId, phone, onClose, onReorderMedicine, onNavigate }: BookingDetailModalProps) {
  const router = useRouter();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [showPrescription, setShowPrescription] = useState(false);
  const [communicationMode, setCommunicationMode] = useState<'video' | 'chat' | null>(null);
  const [showLiveTracking, setShowLiveTracking] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [prescriptionRows, setPrescriptionRows] = useState<any[]>([]);
  const [loadingPrescription, setLoadingPrescription] = useState(false);
  const [medicalRecords, setMedicalRecords] = useState<any[]>([]);
  const [loadingMedicalRecords, setLoadingMedicalRecords] = useState(false);
  const [hasTracking, setHasTracking] = useState(false);
  const [showPrescriptionHistory, setShowPrescriptionHistory] = useState(false);
  const [packageSessions, setPackageSessions] = useState<Record<string, unknown>[]>([]);
  const [packageSessionsLoading, setPackageSessionsLoading] = useState(false);
  const [showOtpSessionKey, setShowOtpSessionKey] = useState<string | null>(null);

  useEffect(() => {
    loadBookingDetails();
  }, [bookingId]);

  useEffect(() => {
    const pid =
      booking?.packagePurchaseId ||
      booking?.package_purchase_id ||
      (booking?.packageDetails as { packagePurchaseId?: string } | undefined)?.packagePurchaseId;
    if (!pid) {
      setPackageSessions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setPackageSessionsLoading(true);
      try {
        const res = (await apiClient.get(
          `/packages/${encodeURIComponent(String(pid))}/sessions`
        )) as { sessions?: Record<string, unknown>[] };
        if (!cancelled) setPackageSessions(Array.isArray(res?.sessions) ? res.sessions : []);
      } catch {
        if (!cancelled) setPackageSessions([]);
      } finally {
        if (!cancelled) setPackageSessionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [booking?.id, booking?.packagePurchaseId, booking?.package_purchase_id]);

  /** Package progress (canonical): `/packages/:packagePurchaseId`. */
  const openPackageTrackingFromBooking = () => {
    if (!booking) return;
    const pid = String(
      booking.packagePurchaseId ||
        booking.package_purchase_id ||
        (booking.packageDetails as { packagePurchaseId?: string } | undefined)?.packagePurchaseId ||
        ''
    ).trim();
    if (!pid) return;
    onClose();
    router.push(`/packages/${encodeURIComponent(pid)}`);
  };

  // ✅ FIX: Listen for prescription view events from chat
  useEffect(() => {
    const handleViewPrescription = (event: CustomEvent) => {
      const { prescriptionId } = event.detail;
      if (prescriptionId) {
        // Load prescription by ID and show modal
        loadPrescriptionById(prescriptionId);
        setShowPrescription(true);
      }
    };
    
    window.addEventListener('viewPrescription', handleViewPrescription as EventListener);
    return () => {
      window.removeEventListener('viewPrescription', handleViewPrescription as EventListener);
    };
  }, []);

  // ✅ FIX: Load prescription by ID (for chat prescription links)
  const loadPrescriptionById = async (prescriptionId: string) => {
    try {
      setLoadingPrescription(true);
      const response = await apiClient.get(`/prescriptions/${prescriptionId}`) as any;
      if (response.prescription) {
        setPrescription(response.prescription);
      }
    } catch (error) {
      console.error('Error loading prescription:', error);
      toast.error('Failed to load prescription');
    } finally {
      setLoadingPrescription(false);
    }
  };

  const loadBookingDetails = async () => {
    try {
      setLoading(true);
      console.log('🔍 [BOOKING-DETAIL] Loading booking:', bookingId);
      // AWS Serverless compatible - use apiClient
      const result = await apiClient.get(`/customer/bookings/${bookingId}`) as any;
      // ✅ FIX: Handle both response formats (result.booking or result.data.booking)
      const rawBooking = result.booking || result.data?.booking || result;
      console.log('✅ [BOOKING-DETAIL] Raw booking loaded:', rawBooking);
      
      // ✅ FIX: Parse notes for diagnostic bookings to extract test names
      let diagnosticTests: any[] = [];
      let diagnosticTestNames: string[] = [];
      // ✅ FIX: Enhanced diagnostic detection - check multiple fields and keywords
      const serviceTypeLower = (rawBooking.serviceType || '').toLowerCase();
      const serviceTypeLower2 = (rawBooking.service_type || '').toLowerCase();
      const serviceCategoryLower = (rawBooking.serviceCategory || rawBooking.service_category || '').toLowerCase();
      const serviceIdLower = (rawBooking.serviceId || '').toLowerCase();
      const serviceNameLower = (rawBooking.serviceName || rawBooking.service_name || '').toLowerCase();
      
      const isDiagnostic = serviceTypeLower === 'diagnostics' || 
                         serviceTypeLower2 === 'diagnostics' || 
                         serviceCategoryLower === 'diagnostics' || 
                         serviceIdLower === 'diagnostics' ||
                         serviceIdLower.includes('diagnostic') ||
                         serviceNameLower.includes('diagnostic') ||
                         serviceNameLower.includes('lab') ||
                         serviceNameLower.includes('test');
      
      // ✅ FIX: Try multiple ways to get diagnostic tests
      if (isDiagnostic) {
        try {
          // Method 1: Parse notes.tests
          if (rawBooking.notes) {
            const notesData = typeof rawBooking.notes === 'string' 
              ? JSON.parse(rawBooking.notes || '{}') 
              : (rawBooking.notes || {});
            if (Array.isArray(notesData.tests) && notesData.tests.length > 0) {
              diagnosticTests = notesData.tests;
              diagnosticTestNames = diagnosticTests.map((t: any) => t.name || t.testName || t.test_name).filter(Boolean);
              console.log('✅ [BOOKING-DETAIL] Found diagnostic tests from notes.tests:', diagnosticTestNames);
            }
          }
          
          // Method 2: Check selected_services for diagnostic tests
          if (diagnosticTests.length === 0 && rawBooking.selected_services) {
            const selectedServices = Array.isArray(rawBooking.selected_services) 
              ? rawBooking.selected_services 
              : (typeof rawBooking.selected_services === 'string' ? JSON.parse(rawBooking.selected_services || '[]') : []);
            if (selectedServices.length > 0) {
              diagnosticTests = selectedServices;
              diagnosticTestNames = diagnosticTests.map((s: any) => s.name || s.testName || s.test_name || s.serviceName).filter(Boolean);
              console.log('✅ [BOOKING-DETAIL] Found diagnostic tests from selected_services:', diagnosticTestNames);
            }
          }
          
          // Method 3: Check selectedServices (camelCase)
          if (diagnosticTests.length === 0 && rawBooking.selectedServices) {
            const selectedServices = Array.isArray(rawBooking.selectedServices) 
              ? rawBooking.selectedServices 
              : [];
            if (selectedServices.length > 0) {
              diagnosticTests = selectedServices;
              diagnosticTestNames = diagnosticTests.map((s: any) => s.name || s.testName || s.test_name || s.serviceName).filter(Boolean);
              console.log('✅ [BOOKING-DETAIL] Found diagnostic tests from selectedServices:', diagnosticTestNames);
            }
          }
        } catch (e) {
          console.warn('⚠️ [BOOKING-DETAIL] Failed to parse diagnostic tests:', e);
        }
      }
      
      // ✅ FIX: Transform enriched booking data to flat fields the UI expects
      const bookingData = {
        ...rawBooking,
        // Service fields - for diagnostics, use test names instead of service name
        serviceName: (isDiagnostic && diagnosticTestNames.length > 0)
          ? diagnosticTestNames.join(', ') // Use test names for diagnostics
          : (rawBooking.serviceName || rawBooking.service?.name || rawBooking.service_name || 'Service'),
        serviceType: rawBooking.serviceType || rawBooking.service?.category || rawBooking.service_type,
        serviceCategory: rawBooking.serviceCategory || rawBooking.service?.category || rawBooking.service_category,
        // ✅ Store diagnostics flags for prescription/medical records detection
        isDiagnostic: isDiagnostic,
        hasDiagnosticTests: diagnosticTests.length > 0,
        // ✅ FIX: Map service_type to serviceStyle, but don't default to 'at_center' for tele consultations
        serviceStyle: rawBooking.serviceStyle || rawBooking.service_style || rawBooking.service_type || null,
        duration: rawBooking.duration || rawBooking.service?.duration || rawBooking.duration_minutes || 60,
        price: parseFloat(rawBooking.amount || rawBooking.total_amount || rawBooking.base_price || 0),
        // Vendor / doctor — map display names (avoid internal slug in `name` / `vendorName`)
        vendorName: resolveVendorDisplayName(rawBooking),
        doctorName: resolveDoctorDisplayName(rawBooking) || undefined,
        vendorPhone: rawBooking.vendorPhone || rawBooking.vendor?.phone || rawBooking.vendor_phone,
        vendorEmail: rawBooking.vendorEmail || rawBooking.vendor?.email || rawBooking.vendor_email,
        vendorAddress: rawBooking.vendorAddress || rawBooking.vendor?.address || rawBooking.vendor_address,
        vendorCity: rawBooking.vendorCity || rawBooking.vendor?.city || rawBooking.vendor_city,
        // Customer fields
        customerName: rawBooking.customerName || rawBooking.customer?.name || rawBooking.customer_name,
        customerPhone: rawBooking.customerPhone || rawBooking.customer?.phone || rawBooking.customer_phone,
        // Pet fields
        petName: rawBooking.petName || rawBooking.pet?.name || 'Pet',
        petBreed: rawBooking.petBreed || rawBooking.pet?.breed,
        petType: rawBooking.petType || rawBooking.pet?.species,
        petAge: rawBooking.petAge || rawBooking.pet?.age,
        petPhoto: rawBooking.petPhoto || rawBooking.pet?.photo_url,
        // OTP fields - map all OTP sources
        otpCode: rawBooking.otp_code || rawBooking.otpCode || rawBooking.completionOTP,
        completionOTP: rawBooking.completionOTP || rawBooking.otp_code || rawBooking.otpCode,
        startOTP: rawBooking.start_otp || rawBooking.startOTP,
        otpVerified: rawBooking.otp_verified || rawBooking.otpVerified,
        requiresOTP: rawBooking.requires_otp || rawBooking.requiresOTP,
        requiresStartOTP: rawBooking.requires_start_otp || rawBooking.requiresStartOTP,
        // Multi-service: pass through for list display and total
        // ✅ FIX: For diagnostics, if no selectedServices but we have tests, create them
        // Also ensure selectedServices is always populated for diagnostics with tests
        selectedServices: (isDiagnostic && diagnosticTests.length > 0)
          ? diagnosticTests.map((test: any) => ({
              id: test.id || test.testId || test.test_id || `test-${Date.now()}-${Math.random()}`,
              serviceId: test.serviceId || test.service_id || rawBooking.serviceId,
              name: test.name || test.testName || test.test_name || test.serviceName || 'Diagnostic Test',
              serviceName: test.name || test.testName || test.test_name || test.serviceName || 'Diagnostic Test',
              price: parseFloat(test.price || test.amount || test.unitPrice || 0),
              duration: parseInt(test.duration || test.duration_minutes || 30),
              quantity: parseInt(test.quantity || 1),
            }))
          : (rawBooking.selectedServices ?? (Array.isArray(rawBooking.selected_services) ? rawBooking.selected_services : [])),
        totalDurationMinutes: rawBooking.totalDurationMinutes ?? rawBooking.total_duration_minutes,
        totalAmount: rawBooking.totalAmount ?? rawBooking.total_amount ?? rawBooking.amount,
        paymentSources: normalizePaymentSources(
          rawBooking.paymentSources ?? rawBooking.payment_sources
        ),
        // Video call - map snake_case for tele consultations
        meetingId: rawBooking.meetingId || rawBooking.video_call_meeting_id,
        packagePurchaseId: rawBooking.packagePurchaseId || rawBooking.package_purchase_id,
        package_purchase_id: rawBooking.package_purchase_id || rawBooking.packagePurchaseId,
        isPackageSession: rawBooking.isPackageSession ?? rawBooking.is_package_session,
        packageSessionNumber: rawBooking.packageSessionNumber ?? rawBooking.package_session_number,
        packageTotalSessions: rawBooking.packageTotalSessions ?? rawBooking.pkg_total_sessions,
        paymentHoldExpiresAt:
          rawBooking.payment_hold_expires_at ||
          rawBooking.paymentHoldExpiresAt ||
          null,
        paymentStatus: rawBooking.payment_status || rawBooking.paymentStatus,
      };
      console.log('✅ [BOOKING-DETAIL] Transformed booking:', bookingData);
      setBooking(bookingData);
      
      // Always try to load prescription (will show "No prescription" if not found)
      loadPrescription(bookingId);
      
      // Load medical records linked to this booking
      loadMedicalRecords(bookingId);
      
      // Check if tracking is available for home services
      if (result.booking && (result.booking.serviceStyle === 'at_home' || result.booking.serviceType === 'at_home') && 
          (result.booking.status === 'in_progress' || result.booking.status === 'active')) {
        checkTrackingStatus(bookingId);
      }
    } catch (error) {
      console.error('❌ [BOOKING-DETAIL] Error loading booking:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPrescription = async (bookingId: string) => {
    try {
      setLoadingPrescription(true);
      // AWS Serverless compatible - use apiClient
      try {
        // ✅ FIX: Use correct endpoint path (plural "prescriptions")
        const result = await apiClient.get(`/prescriptions/booking/${bookingId}`) as any;
        const rows = Array.isArray(result.prescriptions)
          ? result.prescriptions
          : result.prescription
            ? [result.prescription]
            : [];
        setPrescriptionRows(rows);
        setPrescription(rows[0] || null);
      } catch {
        setPrescriptionRows([]);
        setPrescription(null);
        console.log('ℹ️  [PRESCRIPTION] No prescription found');
      }
    } catch (error) {
      setPrescriptionRows([]);
      setPrescription(null);
      console.error('❌ [PRESCRIPTION] Error:', error);
    } finally {
      setLoadingPrescription(false);
    }
  };

  const loadMedicalRecords = async (bookingId: string) => {
    try {
      setLoadingMedicalRecords(true);
      try {
        // ✅ FIX: Use correct endpoint path (remove "customer" prefix)
        const result = await apiClient.get(`/bookings/${bookingId}/medical-records`) as any;
        setMedicalRecords(result.medicalRecords || result.records || []);
      } catch {
        setMedicalRecords([]);
        console.log('ℹ️  [MEDICAL-RECORDS] No medical records found');
      }
    } catch (error) {
      setMedicalRecords([]);
      console.error('❌ [MEDICAL-RECORDS] Error:', error);
    } finally {
      setLoadingMedicalRecords(false);
    }
  };

  const checkTrackingStatus = async (bookingId: string) => {
    try {
      // Backend: GET /tracking/booking/:bookingId (gps-tracking.ts)
      const result = await apiClient.get(`/tracking/booking/${bookingId}`) as any;
      const active = result?.tracking && (result.tracking.status === 'in_transit' || result.tracking.status === 'active' || result.tracking.status === 'en_route');
      setHasTracking(!!active);
    } catch (error) {
      console.debug('Tracking not available:', error);
      setHasTracking(false);
    }
  };

  // Poll for tracking status if booking is in progress
  useEffect(() => {
    if (booking && (booking.serviceStyle === 'at_home' || booking.serviceType === 'at_home') && 
        (booking.status === 'in_progress' || booking.status === 'active')) {
      checkTrackingStatus(bookingId);
      const interval = setInterval(() => {
        checkTrackingStatus(bookingId);
      }, 15000); // Poll every 15 seconds
      return () => clearInterval(interval);
    }
  }, [booking, bookingId]);

  // ✅ FIX #2: Enable chat for ALL active bookings (confirmed, in_progress, active) + completed within 7 days
  const canChat = () => {
    if (!booking) return false;
    
    // Allow chat during any active booking status (confirmed, in_progress, active, scheduled)
    const activeStatuses = ['confirmed', 'in_progress', 'active', 'scheduled', 'pending'];
    if (activeStatuses.includes(booking.status)) {
      return true;
    }
    
    // For completed bookings, allow chat within 7 days
    if (booking.status === 'completed') {
      const completedAt = booking.otpVerifiedAt || booking.updatedAt || booking.completedAt;
      if (!completedAt) return false;
      const completedDate = new Date(completedAt);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff <= 7;
    }
    
    return false;
  };

  const handleCopyOtp = () => {
    if (booking?.completionOTP) {
      copyTextToClipboard(booking.completionOTP);
      setCopiedOtp(true);
      setTimeout(() => setCopiedOtp(false), 2000);
    }
  };

  const getStatusColor = (status: string, bookingLike?: Record<string, any>) => {
    if (
      bookingLike &&
      isPaymentHoldExpired({
        status: bookingLike.status,
        paymentHoldExpiresAt: bookingLike.paymentHoldExpiresAt,
      })
    ) {
      return 'bg-red-100 text-red-700 border-red-200';
    }
    switch (status) {
      case 'confirmed':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'in_progress':
      case 'active':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'completed':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'cancelled':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'pending_payment':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  /** Map raw DB status to a short customer-facing label; handle payment vs status lag. */
  const getBookingStatusDisplayLabel = (raw: Record<string, any>): string => {
    if (
      isPaymentHoldExpired({
        status: raw?.status,
        paymentHoldExpiresAt: raw?.paymentHoldExpiresAt,
        createdAt: raw?.createdAt || raw?.created_at,
      })
    ) {
      return 'Cancelled';
    }
    const st = String(raw?.status || '');
    const ps = String(raw?.payment_status || raw?.paymentStatus || '').toLowerCase();
    if ((ps === 'paid' || ps === 'completed') && (st === 'pending_payment' || st === 'pending')) {
      return 'Confirmed';
    }
    if (st === 'pending_payment') return 'Payment pending';
    if (st === 'cancelled') return 'Cancelled';
    if (st === 'in_progress') return 'In progress';
    if (!st) return 'Unknown';
    return st.charAt(0).toUpperCase() + st.slice(1).replace(/_/g, ' ');
  };

  const handleResumePayment = async () => {
    if (!booking || !onNavigate) {
      toast.error('Unable to open payment from here.');
      return;
    }
    const effectivePhone =
      phone ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('customerPhone') || localStorage.getItem('customer_phone') || ''
        : '');
    try {
      const res = (await apiClient.get(
        `/customer/bookings/${booking.id}/payment-resume?phone=${encodeURIComponent(effectivePhone)}`,
      )) as { success?: boolean; resume?: Record<string, unknown>; error?: string };
      if (!res?.success || !res.resume) {
        toast.error(res?.error || 'Payment window expired');
        void loadBookingDetails();
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
      onClose();
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
        selectedServices: Array.isArray(r.selectedServices) ? r.selectedServices : undefined,
        flowType: 'payment-resume',
        returnScreen: 'my-bookings',
      });
    } catch (err: unknown) {
      console.error('[BookingDetailModal] payment resume failed:', err);
      toast.error('Could not resume payment. Please try again.');
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString || dateString === 'Invalid Date') return 'Not set';
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  const prescriptionDocumentCount = countPrescriptionDocuments(prescriptionRows, medicalRecords);
  const prescriptionsDocsLoading = loadingPrescription || loadingMedicalRecords;
  const bookingStatusNormalized = normalizeBookingStatus(booking);
  const showPrescriptionsDocumentsButton =
    !!booking &&
    customerPrescriptionsDocumentsEntryVisible(booking, prescriptionDocumentCount) &&
    !(
      (bookingStatusNormalized === 'cancelled' || bookingStatusNormalized === 'no_show') &&
      prescriptionsDocsLoading
    );
  const prescriptionsAllowCustomerUpload = customerPrescriptionsAllowUpload(booking);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div
        className="max-h-[min(90dvh,90vh)] w-full max-w-customer overflow-y-auto rounded-t-[32px] bg-white sm:rounded-[32px]"
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-[32px] bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] px-6 py-4 text-white shadow-md">
          <h2 className="font-bold text-white">Booking Details</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600">Loading details...</p>
          </div>
        ) : !booking ? (
          <div className="text-center py-20">
            <p className="text-gray-600">Booking not found</p>
          </div>
        ) : (
          <div
            className="space-y-6 p-6"
            style={{
              /* Tab bar + safe area (see globals.css --customer-footer-offset) + small breathing room */
              paddingBottom: 'max(1.5rem, var(--customer-tabbar-content-pad))',
            }}
          >
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <span className={`px-4 py-2 rounded-full font-semibold border ${getStatusColor(booking.status, booking)}`}>
                {getBookingStatusDisplayLabel(booking)}
              </span>
              <span className="text-sm text-gray-600">
                Booking #{booking.id.slice(0, 8)}
              </span>
            </div>

            {isBookingAwaitingPayment(booking) &&
            booking.paymentStatus !== 'paid' &&
            (isPaymentHoldActive(booking) || isPaymentHoldExpired(booking)) ? (
              <BookingDetailPaymentHoldBanner
                expiresAt={resolvePaymentHoldExpiresAt(booking)}
                onPayNow={() => void handleResumePayment()}
                onExpired={() => void loadBookingDetails()}
              />
            ) : null}

            {/* Start OTP Section - Show for confirmed bookings that require start OTP */}
            {booking.requiresStartOTP && booking.startOTP && booking.status === 'confirmed' && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl p-6 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-xl">▶️</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-green-900">Service Start OTP</h3>
                      <p className="text-xs text-green-700">Share with vendor to START service</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl p-4 mb-3">
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-4xl font-bold text-green-600 tracking-[0.5em] font-mono">
                      {booking.startOTP}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    copyTextToClipboard(booking.startOTP);
                  }}
                  className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <Copy className="w-5 h-5" />
                  Copy Start OTP
                </button>
              </div>
            )}

            {/* Main Booking OTP Section - Show for confirmed bookings with OTP (at_home, at_center) */}
            {booking.otpCode &&
             customerBookingStatusShowsCheckInOtp(booking.status) &&
             !booking.otpVerified &&
             (booking.serviceStyle === 'at_home' || booking.serviceStyle === 'at_center' || booking.serviceType === 'at_home' || booking.serviceType === 'at_center') && (
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300 rounded-2xl p-6 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                      <span className="text-xl">🔐</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-orange-900">
                        {booking.serviceStyle === 'at_home' || booking.serviceType === 'at_home'
                          ? 'Service OTP'
                          : 'Check-in OTP'}
                      </h3>
                      <p className="text-xs text-orange-700">
                        {booking.serviceStyle === 'at_home' || booking.serviceType === 'at_home'
                          ? 'Share with vendor when they arrive'
                          : 'Share with vendor at check-in'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl p-4 mb-3">
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-4xl font-bold text-orange-600 tracking-[0.5em] font-mono">
                      {booking.otpCode}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    copyTextToClipboard(booking.otpCode);
                    setCopiedOtp(true);
                    setTimeout(() => setCopiedOtp(false), 2000);
                    toast.success('OTP copied to clipboard');
                  }}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  {copiedOtp ? (
                    <>
                      <Check className="w-5 h-5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      Copy OTP
                    </>
                  )}
                </button>

                <p className="text-xs text-center text-orange-700 mt-3">
                  ⚠️ Keep this OTP safe. The vendor will enter this to complete your service.
                </p>
              </div>
            )}

            {/* Completion OTP Section - Show for bookings ready to complete (walker services with end OTP) */}
            {booking.requiresOTP && booking.completionOTP && 
             booking.status !== 'completed' && booking.status !== 'cancelled' && 
             (!booking.requiresStartOTP || booking.status === 'in_progress' || booking.status === 'active') && (
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                      <span className="text-xl">🔐</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-orange-900">Service Completion OTP</h3>
                      <p className="text-xs text-orange-700">Share with vendor to END service</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl p-4 mb-3">
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-4xl font-bold text-orange-600 tracking-[0.5em] font-mono">
                      {booking.completionOTP}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleCopyOtp}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  {copiedOtp ? (
                    <>
                      <Check className="w-5 h-5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      Copy OTP
                    </>
                  )}
                </button>

                <p className="text-xs text-center text-orange-700 mt-3">
                  ⚠️ Keep this OTP safe. The vendor will enter this to mark your service as complete.
                </p>
              </div>
            )}

            {/* OTP Verified Badge */}
            {booking.status === 'completed' && booking.otpVerifiedAt && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-green-900">Service Completed</h4>
                  <p className="text-sm text-green-700">
                    Verified on {formatDate(booking.otpVerifiedAt)} at {formatTime(booking.otpVerifiedAt)}
                  </p>
                </div>
              </div>
            )}

            {/* Service Information */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Package className="w-5 h-5 text-[#FF8C42]" />
                Service Information
              </h3>
              
              <div className="space-y-3">
                {(booking.selectedServices && Array.isArray(booking.selectedServices) && booking.selectedServices.length > 0) ? (
                  <>
                    {booking.selectedServices.map((s: any, i: number) => (
                      <div key={s.id || s.serviceId || i} className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-pink-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                          {booking.serviceType === 'walker' ? '🐕' : 
                           booking.serviceType === 'grooming' ? '✂️' : 
                           booking.serviceType === 'vet' ? '🏥' : 
                           booking.serviceType === 'boarding' ? '🏠' : '🐾'}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800">{s.name || s.serviceName || 'Service'}</h4>
                          <p className="text-sm text-gray-600">
                            {s.duration != null ? `${s.duration} min` : ''}
                            {booking.serviceStyle && ` • ${getServiceStyleLabel(booking.serviceStyle)}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-[#FF8C42]">₹{(s.price || 0) * (s.quantity || 1)}</p>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                      <span className="font-semibold text-gray-800">
                        {booking.totalDurationMinutes ? `Total: ${booking.totalDurationMinutes} min` : 'Total'}
                      </span>
                      <span className="font-bold text-[#FF8C42]">₹{booking.totalAmount ?? booking.selectedServices.reduce((sum: number, s: any) => sum + (s.price || 0) * (s.quantity || 1), 0)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-pink-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                      {booking.serviceType === 'walker' ? '🐕' : 
                       booking.serviceType === 'grooming' ? '✂️' : 
                       booking.serviceType === 'vet' ? '🏥' : 
                       booking.serviceType === 'diagnostics' ? '🧪' :
                       booking.serviceType === 'boarding' ? '🏠' : '🐾'}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">
                        {/* ✅ FIX: For diagnostics, show test names from notes if available, otherwise fallback to serviceName */}
                        {(() => {
                          const isDiagnostic = booking.serviceType === 'diagnostics' || 
                                               (booking.serviceType || '').toLowerCase().includes('diagnostic');
                          if (isDiagnostic && booking.notes) {
                            try {
                              const notesData = typeof booking.notes === 'string' 
                                ? JSON.parse(booking.notes || '{}') 
                                : (booking.notes || {});
                              const tests = Array.isArray(notesData.tests) ? notesData.tests : [];
                              if (tests.length > 0) {
                                const testNames = tests.map((t: any) => t.name || t.testName || t.test_name).filter(Boolean);
                                if (testNames.length > 0) {
                                  return testNames.join(', ');
                                }
                              }
                            } catch (e) {
                              console.warn('Failed to parse notes for test names:', e);
                            }
                          }
                          return booking.serviceName || 'Service';
                        })()}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {booking.duration ? `${booking.duration} min` : ''} 
                        {booking.serviceStyle && ` • ${getServiceStyleLabel(booking.serviceStyle)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#FF8C42]">₹{booking.totalAmount ?? booking.price ?? 0}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Payment breakdown */}
            {booking.paymentSources?.length > 0 &&
              (booking.paymentStatus === 'paid' ||
                booking.payment_status === 'paid' ||
                booking.paymentStatus === 'completed' ||
                booking.payment_status === 'completed') && (
              <PaymentSourcesDisplay
                sources={booking.paymentSources}
                totalPaid={booking.totalAmount ?? booking.price}
              />
            )}

            {/* Pet Information */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <span className="text-xl">🐾</span>
                Pet Information
              </h3>
              
              <div className="flex items-center gap-3">
                {booking.petPhoto ? (
                  <img src={booking.petPhoto} alt={booking.petName} className="w-14 h-14 rounded-full object-cover" />
                ) : (
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center text-2xl">
                    🐶
                  </div>
                )}
                <div>
                  <h4 className="font-semibold text-gray-800">{booking.petName || 'Pet'}</h4>
                  <p className="text-sm text-gray-600">
                    {booking.petBreed || booking.petType || ''} 
                    {booking.petAge && ` • ${booking.petAge}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Vendor Information */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <User className="w-5 h-5 text-[#FF8C42]" />
                {booking.doctorName ? 'Doctor Information' : 'Vendor Information'}
              </h3>
              
              {/* Doctor Information (if available) */}
              {booking.doctorName && (
                <>
                  <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                    {booking.doctorPhoto ? (
                      <img src={booking.doctorPhoto} alt={booking.doctorName} className="w-14 h-14 rounded-full object-cover" />
                    ) : (
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-blue-600" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">{booking.doctorName}</h4>
                      <p className="text-xs text-gray-500">Assigned Doctor</p>
                      {booking.doctorPhone && (
                        <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                          <Phone className="w-3 h-3" />
                          {booking.doctorPhone}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Clinic/Vendor Information */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Clinic</p>
                    <div className="flex items-center gap-3">
                      {booking.vendorPhoto ? (
                        <img src={booking.vendorPhoto} alt={booking.vendorName} className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-pink-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-orange-600" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800">{booking.vendorName || 'Clinic'}</h4>
                        {booking.vendorPhone && (
                          <p className="text-sm text-gray-600 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {booking.vendorPhone}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
              
              {/* Vendor Only (no doctor assigned) */}
              {!booking.doctorName && (
                <div className="flex items-center gap-3">
                  {booking.vendorPhoto ? (
                    <img src={booking.vendorPhoto} alt={booking.vendorName} className="w-14 h-14 rounded-full object-cover" />
                  ) : (
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-blue-600" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800">{booking.vendorName || 'Vendor'}</h4>
                    {booking.vendorPhone && (
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {booking.vendorPhone}
                      </p>
                    )}
                  </div>
                  {/* ✅ NEW: Call & Chat buttons */}
                  <div className="flex gap-2">
                    {booking.vendorPhone && (
                      <button
                        onClick={() => window.open(`tel:${booking.vendorPhone}`, '_self')}
                        className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center hover:bg-green-200 transition-colors"
                        title="Call Vendor"
                      >
                        <PhoneCall className="w-5 h-5 text-green-600" />
                      </button>
                    )}
                    <button
                      onClick={() => setCommunicationMode('chat')}
                      className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center hover:bg-blue-200 transition-colors"
                      title="Chat"
                    >
                      <MessageCircle className="w-5 h-5 text-blue-600" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Package: track sessions + OTPs (replaces generic Schedule card) */}
            {(booking.packagePurchaseId ||
              booking.package_purchase_id ||
              (booking.packageDetails as { packagePurchaseId?: string } | undefined)?.packagePurchaseId) && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-gray-800 flex flex-wrap items-center gap-2">
                  <Package className="w-5 h-5 text-purple-600 shrink-0" aria-hidden />
                  <button
                    type="button"
                    onClick={openPackageTrackingFromBooking}
                    className="font-bold text-purple-700 hover:text-purple-900 underline decoration-purple-300 decoration-2 underline-offset-2 hover:decoration-purple-600 text-left bg-transparent border-0 p-0 cursor-pointer"
                  >
                    Track your packages
                  </button>
                </h3>
                <p className="text-xs text-gray-600">
                  Sessions for this purchase. When a visit is scheduled and an OTP is available, it appears below
                  that session (tap the eye to reveal).
                </p>
                {packageSessionsLoading ? (
                  <div className="flex justify-center py-6">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-500" />
                  </div>
                ) : packageSessions.length === 0 ? (
                  <p className="text-sm text-gray-500">No session rows yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {packageSessions.map((s, idx) => {
                      const n =
                        Number(s.session_number ?? s.sessionNumber ?? idx + 1) || idx + 1;
                      const st = String(
                        s.display_status ||
                          s.displayStatus ||
                          s.status ||
                          s.booking_status ||
                          ''
                      ).toLowerCase();
                      const dateRaw = String(
                        s.scheduled_date || s.scheduledDate || s.booking_date || ''
                      );
                      const dateLabel =
                        dateRaw && dateRaw.includes('T')
                          ? new Date(dateRaw).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : dateRaw || '—';
                      const tr = String(s.scheduled_time || s.scheduledTime || s.booking_time || '');
                      const timeLabel = tr.length >= 8 ? tr.slice(0, 5) : tr || '—';
                      const rowKey = String(s.id || s.bookingId || s.booking_id || `${n}-${idx}`);
                      const bookingRowId = String(s.bookingId || s.booking_id || '').trim();
                      const visitStatus = String(
                        s.booking_status ||
                          s.display_status ||
                          s.displayStatus ||
                          s.status ||
                          ''
                      ).toLowerCase();
                      const otpCode = String(s.otpCode || s.otp_code || '').trim();
                      const startOTP = String(s.startOTP || s.start_otp || '').trim();
                      const completionOTP = String(s.completionOTP || s.completion_otp || '').trim();
                      const primaryOtp = (otpCode || startOTP || completionOTP).trim();
                      const otpVerified = Boolean(s.otpVerified ?? s.otp_verified);
                      const showOtp =
                        !!bookingRowId &&
                        !!primaryOtp &&
                        customerBookingStatusShowsCheckInOtp(visitStatus) &&
                        !otpVerified;
                      return (
                        <li
                          key={rowKey}
                          className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 text-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-gray-900">
                                Session {n}
                                {st ? (
                                  <span className="ml-2 text-xs font-normal capitalize text-gray-500">
                                    · {st}
                                  </span>
                                ) : null}
                              </p>
                              <p className="mt-1 text-xs text-gray-600">
                                {dateLabel} · {timeLabel}
                              </p>
                            </div>
                          </div>
                          {showOtp ? (
                            <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50/90 p-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-900">
                                  <Key className="h-3.5 w-3.5" />
                                  Visit OTP
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className="font-mono text-sm font-bold tracking-wider text-orange-700">
                                    {showOtpSessionKey === rowKey ? primaryOtp : '••••'}
                                  </span>
                                  <button
                                    type="button"
                                    className="rounded p-1 hover:bg-orange-100"
                                    aria-label={showOtpSessionKey === rowKey ? 'Hide OTP' : 'Show OTP'}
                                    onClick={() =>
                                      setShowOtpSessionKey(showOtpSessionKey === rowKey ? null : rowKey)
                                    }
                                  >
                                    {showOtpSessionKey === rowKey ? (
                                      <EyeOff className="h-4 w-4 text-orange-700" />
                                    ) : (
                                      <Eye className="h-4 w-4 text-orange-700" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded p-1 hover:bg-orange-100"
                                    onClick={() => {
                                      copyTextToClipboard(primaryOtp);
                                      toast.success('OTP copied');
                                    }}
                                    aria-label="Copy OTP"
                                  >
                                    <Copy className="h-4 w-4 text-orange-700" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {/* Booking Timestamps */}
            <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Booked on:</span>
                <span className="font-medium text-gray-800">
                  {formatDate(booking.createdAt)} at {formatTime(booking.createdAt)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Last updated:</span>
                <span className="font-medium text-gray-800">
                  {formatDate(booking.updatedAt)} at {formatTime(booking.updatedAt)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Review Section - For completed bookings */}
              {booking.status === 'completed' && (
                <>
                  {!booking.reviewId ? (
                    <Button
                      onClick={() => setShowRateModal(true)}
                      className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                      <Star className="w-5 h-5 fill-white" />
                      Rate Service
                    </Button>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                          <Star className="w-5 h-5 text-yellow-600 fill-yellow-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-yellow-900">You rated this service</p>
                          <p className="text-xs text-yellow-700">Thank you for your feedback!</p>
                        </div>
                      </div>
                      <Check className="w-5 h-5 text-yellow-600" />
                    </div>
                  )}
                </>
              )}

              {/* Download Invoice Button - For completed bookings */}
              {booking.status === 'completed' && (
                <Button
                  onClick={async () => {
                    try {
                      const { saveResult } = await downloadBookingInvoice(booking.id);
                      if (saveResult === 'failed') {
                        toast.error(getBookingInvoiceDownloadMessage(saveResult));
                      } else {
                        toast.success(getBookingInvoiceDownloadMessage(saveResult));
                      }
                    } catch (error: any) {
                      console.error('Error downloading invoice:', error);
                      toast.error('Failed to download invoice. Please try again later.');
                    }
                  }}
                  className="w-full bg-[#FF8C42] hover:bg-[#ff7a28] text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <Download className="w-5 h-5" />
                  Download Invoice
                </Button>
              )}

              {/* Live Tracking Button - For home services in progress */}
              {hasTracking && booking.serviceStyle === 'at_home' && (
                <Button
                  onClick={() => setShowLiveTracking(true)}
                  className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors animate-pulse"
                >
                  <Navigation className="w-5 h-5" />
                  Live Tracking Active
                  <span className="ml-auto bg-green-700 px-2 py-0.5 rounded-full text-xs">Live</span>
                </Button>
              )}

              {/* Prescriptions & documents — vet, diagnostics, nutritionist; all statuses (view-only rules in modal) */}
              {showPrescriptionsDocumentsButton && (
                <Button
                  onClick={() => setShowPrescriptionHistory(true)}
                  className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                  disabled={prescriptionsDocsLoading}
                >
                  <FileText className="w-5 h-5" />
                  Prescriptions &amp; documents
                  {prescriptionDocumentCount > 0 && (
                    <span className="ml-auto bg-indigo-700 px-2 py-0.5 rounded-full text-xs">
                      {prescriptionDocumentCount}
                    </span>
                  )}
                </Button>
              )}

              {/* Lab reports — diagnostics bookings and vet bookings with lab tests */}
              {bookingLabReportsActionVisible(booking) && (
                <Button
                  onClick={() => {
                    onNavigate?.('diagnostics-reports', { bookingId: booking.id });
                    onClose();
                  }}
                  className="w-full bg-teal-500 hover:bg-teal-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors mb-3"
                >
                  <FileText className="w-5 h-5" />
                  View Lab Reports
                  <span className="ml-auto bg-teal-700 px-2 py-0.5 rounded-full text-xs">Ready</span>
                </Button>
              )}

              {/* Diagnostics: Track Sample Collection - For home collection bookings */}
              {(booking.serviceId === 'diagnostics' || booking.serviceType === 'diagnostics') && 
               booking.serviceStyle === 'at_home' &&
               ['scheduled', 'sample_collected'].includes(booking.status) && (
                <Button
                  onClick={() => {
                    onNavigate?.('sample-collection-tracking', { bookingId: booking.id });
                    onClose();
                  }}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors animate-pulse"
                >
                  <Navigation className="w-5 h-5" />
                  Track Sample Collection
                  <span className="ml-auto bg-amber-700 px-2 py-0.5 rounded-full text-xs">Live</span>
                </Button>
              )}

              {/* Chat Button - For active bookings and completed within 7 days */}
              {canChat() && (
                <Button
                  onClick={() => setCommunicationMode('chat')}
                  className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <MessageCircle className="w-5 h-5" />
                  Chat with Vendor
                  {booking.status === 'completed' && (booking.otpVerifiedAt || booking.updatedAt || booking.completedAt) && (
                    <span className="ml-auto bg-green-700 px-2 py-0.5 rounded-full text-xs">
                      {Math.max(0, 7 - Math.floor((new Date().getTime() - new Date(booking.otpVerifiedAt || booking.updatedAt || booking.completedAt).getTime()) / (1000 * 60 * 60 * 24)))} days left
                    </span>
                  )}
                  {booking.status !== 'completed' && (
                    <span className="ml-auto bg-green-700 px-2 py-0.5 rounded-full text-xs">Active</span>
                  )}
                </Button>
              )}

              {/* Tele-Consultation Join Button */}
              {booking.serviceStyle === 'tele' && (booking.status === 'confirmed' || booking.status === 'in_progress') && (
                 <Button
                  onClick={() => setCommunicationMode('video')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors animate-pulse"
                >
                  <Video className="w-5 h-5" />
                  Join Tele-Consultation
                </Button>
              )}


              <Button
                onClick={() => {
                  onClose();
                  navigateToBookingSupport(router, {
                    bookingId: String(booking.id || bookingId),
                    serviceName: booking.serviceName || booking.service_name,
                    bookingDate: booking.date || booking.booking_date,
                    amount: booking.amount ?? booking.total_amount,
                    status: booking.status,
                    vendorName: booking.vendorName || booking.vendor_name,
                  });
                }}
                variant="outline"
                className="w-full mt-3 border-[#FF8C42]/40 text-[#FF8C42] hover:bg-[#FFF3E8] py-3 rounded-xl flex items-center justify-center gap-2"
              >
                <HelpCircle className="w-5 h-5" />
                Need help with this booking
              </Button>
            </div>
          </div>
        )}

        {/* Home indicator — pad with safe area so it sits above gesture bar when sheet is short */}
        <div className="sticky bottom-0 z-[1] flex justify-center border-t border-gray-100 bg-white px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
          <div className="h-1 w-32 rounded-full bg-gray-300" aria-hidden />
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Prescription Modal */}
      {showPrescription && (
        <PrescriptionModal
          bookingId={bookingId}
          prescription={prescription}
          customerPhone={phone}
          onClose={() => {
            setShowPrescription(false);
            loadPrescription(bookingId); // Reload in case it was added
          }}
          onReorderMedicine={(medications, prescriptionId, bid) => {
            if (onReorderMedicine) onReorderMedicine(medications || [], prescriptionId, bid || bookingId);
          }}
        />
      )}

      {/* Prescriptions & documents modal */}
      {showPrescriptionHistory && (
        <PrescriptionHistoryModal
          bookingId={bookingId}
          petId={petId}
          customerPhone={phone}
          bookingStatus={booking?.status}
          allowCustomerUpload={prescriptionsAllowCustomerUpload}
          onClose={() => {
            setShowPrescriptionHistory(false);
            loadPrescription(bookingId); // Reload prescriptions
            loadMedicalRecords(bookingId); // Reload medical records
          }}
          onUploadSuccess={() => {
            loadPrescription(bookingId);
            loadMedicalRecords(bookingId);
          }}
          onOrderMedicine={(prescriptionId, bookingId, medications) => {
            // ✅ FIX: Handle pharmacy ordering from prescription
            if (onReorderMedicine) {
              onReorderMedicine(medications || [], prescriptionId, bookingId);
            }
          }}
        />
      )}

      {/* Communication Hub (Unified Chat/Video) - Rule 2: Video from chat; customer start = create + notify vendor then navigate */}
      {communicationMode && booking && (
        <CommunicationHub
          mode={communicationMode}
          bookingId={bookingId}
          userId={phone}
          userName="You"
          otherUserName={booking.doctorName || booking.vendorName || 'Vendor'}
          userType="customer"
          onClose={() => setCommunicationMode(null)}
          onBookFollowUp={() => setShowFollowUp(true)}
          onNavigate={onNavigate}
          meetingId={booking.meetingId}
          onStartVideoCall={async (bid, existingMeetingId): Promise<string | undefined> => {
            try {
              if (existingMeetingId) {
                await apiClient.post('/video-call/notify-ready', {
                  bookingId: bid,
                  participantType: 'customer',
                  participantId: booking.customerId || phone,
                }).catch(() => {});
                return existingMeetingId;
              }
              const createRes = await apiClient.post('/video-call/create-meeting', {
                bookingId: bid,
                customerId: booking.customerId || phone,
                vendorId: booking.vendorId,
              }) as any;
              if (createRes?.success || createRes?.meetingId) {
                await apiClient.post('/video-call/notify-ready', {
                  bookingId: bid,
                  participantType: 'customer',
                  participantId: booking.customerId || phone,
                }).catch(() => {});
                return createRes?.meetingId;
              }
              const msg = createRes?.error || 'Could not start video call.';
              toast.error(msg);
            } catch (err: any) {
              const msg = err?.response?.error || err?.responseData?.error || err?.message || 'Video call is not available for this appointment right now.';
              toast.error(typeof msg === 'string' ? msg : 'Could not start video call.');
            }
          }}
        />
      )}

      {/* Live Tracking Map */}
      {showLiveTracking && booking && (
        <LiveTrackingMap
          bookingId={bookingId}
          walkerName={booking.staffName || booking.vendorName}
          walkerPhone={booking.vendorPhone}
          petName={booking.petName}
          onClose={() => setShowLiveTracking(false)}
        />
      )}

      {/* Follow-Up Booking Modal */}
      {showFollowUp && booking && (
        <FollowUpBookingModal
          originalBookingId={bookingId}
          vendorId={booking.vendorId}
          vendorName={booking.vendorName}
          petId={booking.petId}
          petName={booking.petName}
          customerPhone={phone}
          serviceType={booking.serviceType}
          serviceName={booking.serviceName || booking.serviceType}
          onClose={() => setShowFollowUp(false)}
          onSuccess={() => {
            setShowFollowUp(false);
            loadBookingDetails();
          }}
        />
      )}

      {/* Rate Service Modal */}
      {showRateModal && booking && (
        <RateServiceModal
          bookingId={bookingId}
          vendorId={booking.vendorId}
          vendorName={booking.vendorName || booking.doctorName || 'Vendor'}
          customerId={phone} // phone is used as customerId
          onClose={() => setShowRateModal(false)}
          onSuccess={() => {
            setShowRateModal(false);
            loadBookingDetails();
          }}
        />
      )}
    </div>
  );
}