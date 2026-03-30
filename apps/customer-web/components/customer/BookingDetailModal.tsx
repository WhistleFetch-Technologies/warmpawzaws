'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Copy, Check, User, Phone, Package, Info, FileText, MessageCircle, Video, PhoneCall, CalendarPlus, Download, Share2, Star, Navigation, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { copyTextToClipboard } from '@/lib/shareUtils';
import { PrescriptionModal } from './PrescriptionModal';
import { PrescriptionHistoryModal } from './PrescriptionHistoryModal';
import { CommunicationHub } from '../communication/CommunicationHub';
import { LiveTrackingMap } from '../tracking/LiveTrackingMap';
import { FollowUpBookingModal } from './FollowUpBookingModal';
import { RateServiceModal } from './RateServiceModal';

interface BookingDetailModalProps {
  bookingId: string;
  petId: string;
  phone: string;
  onClose: () => void;
  onReorderMedicine?: (medications: any[], prescriptionId?: string, bookingId?: string) => void;
  onNavigate?: (screen: string, data?: any) => void; // ✅ FIX: Add navigation handler for video calls
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
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [showPrescription, setShowPrescription] = useState(false);
  const [communicationMode, setCommunicationMode] = useState<'video' | 'chat' | null>(null);
  const [showLiveTracking, setShowLiveTracking] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [loadingPrescription, setLoadingPrescription] = useState(false);
  const [medicalRecords, setMedicalRecords] = useState<any[]>([]);
  const [loadingMedicalRecords, setLoadingMedicalRecords] = useState(false);
  const [hasTracking, setHasTracking] = useState(false);
  const [showPrescriptionHistory, setShowPrescriptionHistory] = useState(false);

  useEffect(() => {
    loadBookingDetails();
  }, [bookingId]);

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
      
      const normalizedStatus =
        rawBooking.status ?? rawBooking.booking_status ?? rawBooking.bookingStatus ?? 'pending';
      const normalizedId = rawBooking.id ?? rawBooking.bookingId ?? bookingId;

      // ✅ FIX: Transform enriched booking data to flat fields the UI expects
      const bookingData = {
        ...rawBooking,
        id: normalizedId,
        status: normalizedStatus,
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
        // Vendor fields
        vendorName: rawBooking.vendorName || rawBooking.vendor?.businessName || rawBooking.vendor_name || 'Vendor',
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
        // Video call - map snake_case for tele consultations
        meetingId: rawBooking.meetingId || rawBooking.video_call_meeting_id,
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
        setPrescription(result.prescription || result.prescriptions?.[0] || null);
      } catch {
        setPrescription(null);
        console.log('ℹ️  [PRESCRIPTION] No prescription found');
      }
    } catch (error) {
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

  const canFollowUp = () => {
    if (!booking || booking.status !== 'completed' || !booking.otpVerifiedAt) return false;
    const completedAt = new Date(booking.otpVerifiedAt);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - completedAt.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff <= 7;
  };

  const handleCopyOtp = () => {
    if (booking?.completionOTP) {
      copyTextToClipboard(booking.completionOTP);
      setCopiedOtp(true);
      setTimeout(() => setCopiedOtp(false), 2000);
    }
  };

  const getStatusColor = (status: string) => {
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
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
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

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div 
        className="bg-white w-full max-w-customer rounded-t-[32px] sm:rounded-[32px] max-h-[90vh] overflow-y-auto"
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] text-white px-6 py-4 flex items-center justify-between rounded-t-[32px] z-10 shadow-md">
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
          <div className="p-6 space-y-6 pb-24">
            {/* Status Badge */}
            <div className="flex items-center justify-between">
              <span className={`px-4 py-2 rounded-full font-semibold border ${getStatusColor(booking.status)}`}>
                {booking.status === 'in_progress' ? 'In Progress' : 
                 (String(booking.status || 'pending').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))}
              </span>
              <span className="text-sm text-gray-600">
                Booking #{(String(booking.id || bookingId)).slice(0, 8)}
              </span>
            </div>

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
             (booking.status === 'confirmed' || booking.status === 'in_progress' || booking.status === 'arrived') && 
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

            {/* Schedule Information */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#FF8C42]" />
                Schedule
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-600 mb-1">Start Date</p>
                  <p className="font-semibold text-gray-800">
                    {formatDate(booking.scheduledDate || booking.startDate)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-600 mb-1">Time Slot</p>
                  <p className="font-semibold text-gray-800">
                    {booking.scheduledTime || booking.schedule || 'Not set'}
                  </p>
                </div>
                {(booking.totalSessions || booking.completedSessions !== undefined) && (
                  <div className="bg-gray-50 rounded-xl p-3 col-span-2">
                    <p className="text-xs text-gray-600 mb-1">Sessions</p>
                    <p className="font-semibold text-gray-800">
                      {booking.completedSessions || 0} / {booking.totalSessions || 1}
                    </p>
                  </div>
                )}
              </div>

              {/* Progress Bar for active bookings */}
              {(booking.status === 'active' || booking.status === 'in_progress') && 
               booking.totalSessions > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                    <span>Progress</span>
                    <span>{Math.round(((booking.completedSessions || 0) / booking.totalSessions) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B35]"
                      style={{ width: `${((booking.completedSessions || 0) / booking.totalSessions) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

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
                      const apiBaseUrl = apiClient['baseUrl'] || process.env.NEXT_PUBLIC_API_BASE_URL || '';
                      const token = localStorage.getItem('authToken') || localStorage.getItem('cognitoIdToken');
                      const url = `${apiBaseUrl}/bookings/${booking.id || bookingId}/invoice`;
                      
                      const response = await fetch(url, {
                        headers: {
                          ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        },
                      });
                      
                      if (!response.ok) {
                        throw new Error('Failed to download invoice');
                      }
                      
                      const blob = await response.blob();
                      const downloadUrl = window.URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = downloadUrl;
                      link.download = `invoice-${String(booking.id || bookingId).slice(0, 8)}.pdf`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(downloadUrl);
                      
                      toast.success('Invoice downloaded successfully');
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

              {/* Prescription History - Only for vet, diagnostics, nutritionist (not grooming/training/walker/behaviourist/sitter) */}
              {showPrescriptionAndMedicalRecords(booking.serviceType, booking.serviceCategory, booking) && (
                <Button
                  onClick={() => setShowPrescriptionHistory(true)}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                  disabled={loadingPrescription}
                >
                  <FileText className="w-5 h-5" />
                  Prescription History
                  {prescription && <span className="ml-auto bg-blue-700 px-2 py-0.5 rounded-full text-xs">Available</span>}
                </Button>
              )}

              {/* Upload Documents - Always visible */}
              <Button
                onClick={() => setShowPrescriptionHistory(true)}
                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Upload className="w-5 h-5" />
                Upload Documents
                {(prescription || medicalRecords.length > 0) && (
                  <span className="ml-auto bg-indigo-700 px-2 py-0.5 rounded-full text-xs">
                    {medicalRecords.length + (prescription ? 1 : 0)} uploaded
                  </span>
                )}
              </Button>

              {/* Medical Records & Lab Reports - Only for vet/diagnostics/nutritionist */}
              {showPrescriptionAndMedicalRecords(booking.serviceType, booking.serviceCategory, booking) && medicalRecords.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700 px-1">Medical records & reports</p>
                  {medicalRecords.map((rec: any) => (
                    <div
                      key={rec.id}
                      className="flex items-center justify-between gap-2 p-3 rounded-xl bg-purple-50 border border-purple-100"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText className="w-5 h-5 text-purple-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{rec.title || rec.record_type || 'Report'}</p>
                          {rec.record_type && (
                            <p className="text-xs text-gray-500 capitalize">{rec.record_type.replace('_', ' ')}</p>
                          )}
                        </div>
                      </div>
                      {(rec.document_url || rec.record_type === 'diagnostic_report') && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-shrink-0 border-purple-200 text-purple-700 hover:bg-purple-100"
                          onClick={() => {
                            const url = rec.document_url;
                            if (url) {
                              window.open(url, '_blank');
                              toast.success('Opening report...');
                            } else {
                              toast.info('View in Medical Records');
                              onNavigate?.('medical-records', {});
                            }
                          }}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Diagnostics: View Reports Button - For diagnostics bookings with ready reports */}
              {(() => {
                // ✅ Use the same detection logic as prescription history for consistency
                const isDiagnosticBooking = showPrescriptionAndMedicalRecords(
                  booking.serviceType, 
                  booking.serviceCategory, 
                  booking
                );
                
                // ✅ FIX: Case-insensitive status check - handle multiple formats
                const statusStr = (booking.status || '').toString();
                const statusLower = statusStr.toLowerCase().replace(/\s/g, '_').replace(/-/g, '_');
                const hasReportsReady = 
                  statusLower === 'reports_ready' || 
                  statusLower === 'reportsready' ||
                  statusLower === 'completed' ||
                  statusStr === 'Reports_ready' ||
                  statusStr === 'Reports Ready' ||
                  (statusLower.includes('report') && statusLower.includes('ready')) ||
                  statusLower === 'ready';
                
                const shouldShow = isDiagnosticBooking && hasReportsReady;
                console.log('🔍 [BOOKING-DETAIL] View Reports Button Check:', {
                  isDiagnosticBooking,
                  status: booking.status,
                  statusLower,
                  hasReportsReady,
                  shouldShow,
                  serviceId: booking.serviceId,
                  serviceType: booking.serviceType,
                  serviceCategory: booking.serviceCategory,
                  isDiagnostic: booking.isDiagnostic,
                  hasDiagnosticTests: booking.hasDiagnosticTests,
                });
                
                return shouldShow;
              })() && (
                <Button
                  onClick={() => {
                    onNavigate?.('diagnostics-reports', { bookingId: booking.id || bookingId });
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
                    onNavigate?.('sample-collection-tracking', { bookingId: booking.id || bookingId });
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


              {/* Follow-up Button - Only for completed bookings within 7 days */}
              {canFollowUp() && (
                <Button
                  onClick={() => setCommunicationMode('chat')} // Opens same chat window
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <CalendarPlus className="w-5 h-5" />
                  Follow-Up Chat
                  {(booking.otpVerifiedAt || booking.updatedAt || booking.completedAt) && (
                    <span className="ml-auto bg-orange-700 px-2 py-0.5 rounded-full text-xs">
                      {Math.max(0, 7 - Math.floor((new Date().getTime() - new Date(booking.otpVerifiedAt || booking.updatedAt || booking.completedAt).getTime()) / (1000 * 60 * 60 * 24)))} days left
                    </span>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Home Indicator */}
        <div className="sticky bottom-0 bg-white px-6 py-4 flex justify-center">
          <div className="w-32 h-1 bg-gray-300 rounded-full"></div>
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

      {/* Prescription History Modal */}
      {showPrescriptionHistory && (
        <PrescriptionHistoryModal
          bookingId={bookingId}
          petId={petId}
          customerPhone={phone}
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