'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { X, MapPin, Clock, User, Phone, Calendar, Star, CheckCircle2, XCircle, AlertCircle, Navigation, Loader2, MessageSquare, FileText, RefreshCw, History, Pill, Video, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
// Removed Supabase imports - using apiClient instead
import { toast } from 'sonner';
import { authenticatedFetch } from '@/lib/session-manager'; // ✅ SECURITY FIX
import { MedicalHistoryModal } from './MedicalHistoryModal';
import { AddVetSummaryModal } from './modals/AddVetSummaryModal';
import { VendorPrescriptionModal } from './modals/VendorPrescriptionModal';
import { CommunicationHub } from '../communication/CommunicationHub';

interface AppointmentDetailModalProps {
  bookingId: string;
  vendorData?: any;
  onClose: () => void;
  onRefresh?: () => void;
}

interface Booking {
  id: string;
  petId?: string; // ✅ Added petId for medical history context
  customerId?: string; // ✅ Added for prescription creation
  time: string;
  customerName: string;
  customerPhone: string;
  petName: string;
  petType: string;
  petBreed: string;
  petAge: string;
  location: string;
  serviceType: string;
  serviceName: string;
  status: string;
  date: string;
  price: number;
  duration: number;
  createdAt: string;
  updatedAt: string;
  arrived?: boolean; // Track if vendor has arrived at location
  
  // Parent/Follow-up
  isFollowUp: boolean;
  parentBookingId?: string;
  
  // Specialized Metadata (New)
  meetingLink?: string;
  metadata?: {
    guestCount?: number;
    checkinDate?: string;
    checkoutDate?: string;
    symptoms?: string[];
    petDetails?: any;
  };
  specialInstructions?: string;
  
  // Prescription
  hasPrescription: boolean;
  prescriptionNotes?: string;
  prescriptionUrl?: string;
  prescriptionUploadedAt?: string;

  // Vendor (for prescription creation)
  vendorId?: string;
  staffId?: string;
}

interface Activity {
  id: string;
  type: 'status_change' | 'prescription' | 'chat' | 'note' | 'follow_up';
  description: string;
  timestamp: string;
  actor: string;
}

interface Prescription {
  id: string;
  bookingId: string;
  notes: string;
  medications: string;
  dosage: string;
  frequency: string;
  duration: string;
  uploadedAt: string;
  uploadedBy: string;
}

export function AppointmentDetailModal({ bookingId, vendorData, onClose, onRefresh }: AppointmentDetailModalProps) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'prescriptions'>('details');
  
  // Modal states
  const [communicationMode, setCommunicationMode] = useState<'video' | 'chat' | null>(null);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [showMedicalHistory, setShowMedicalHistory] = useState(false);
  const [showVetSummaryModal, setShowVetSummaryModal] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  
  // OTP States
  const [otp, setOtp] = useState('');
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpAction, setOtpAction] = useState<'start' | 'complete' | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadAppointmentDetails();
  }, [bookingId]);

  const loadAppointmentDetails = async () => {
    try {
      setLoading(true);
      
      // Load booking details
      const data = await apiClient.get(`/vendor/bookings/${bookingId}/details`) as any;
      const rawBooking = data.booking;
      
      // Map backend response to frontend Booking interface
      const mappedBooking: Booking = {
        id: rawBooking.id || rawBooking.bookingId,
        petId: rawBooking.petId,
        customerId: rawBooking.customerId, // ✅ For prescription creation
        // ✅ FIX: Map bookingDate/bookingTime to date/time
        date: rawBooking.bookingDate || rawBooking.date || new Date().toISOString(),
        time: formatBookingTime(rawBooking.bookingTime || rawBooking.time) || '09:00 AM',
        duration: rawBooking.duration || 30,
        // ✅ FIX: Map totalAmount to price
        price: rawBooking.totalAmount || rawBooking.price || 0,
        // Customer info
        customerName: rawBooking.customerName || 'Unknown Customer',
        customerPhone: rawBooking.customerPhone || '',
        // Pet info  
        petName: rawBooking.petName || 'Unknown Pet',
        petType: rawBooking.petType || rawBooking.petSpecies || '',
        petBreed: rawBooking.petBreed || '',
        petAge: rawBooking.petAge ? `${rawBooking.petAge} years` : '',
        // Service info
        serviceName: rawBooking.serviceName || 'Service',
        serviceType: rawBooking.serviceStyle || rawBooking.serviceType || 'at_center',
        // ✅ FIX: Build location from vendor address or service style
        location: rawBooking.location || rawBooking.vendorAddress || rawBooking.customerAddress || 
          (rawBooking.serviceStyle === 'at_home' ? 'Home Visit' : 'At Clinic'),
        status: rawBooking.status || 'pending',
        // Timestamps
        createdAt: rawBooking.createdAt,
        updatedAt: rawBooking.updatedAt,
        // Follow-up
        isFollowUp: rawBooking.isFollowUp || false,
        parentBookingId: rawBooking.parentBookingId,
        // Prescription
        hasPrescription: rawBooking.hasPrescription || false,
        prescriptionNotes: rawBooking.prescriptionNotes,
        prescriptionUrl: rawBooking.prescriptionUrl,
        // Metadata
        metadata: rawBooking.metadata,
        specialInstructions: rawBooking.specialInstructions || rawBooking.notes,
        meetingLink: rawBooking.meetingLink,
        // Vendor (from API – used for prescription creation)
        vendorId: rawBooking.vendorId || rawBooking.vendor_id,
        staffId: rawBooking.staffId || rawBooking.staff_id,
      };
      
      setBooking(mappedBooking);
      setActivities((data.activities || []).map((a: any) => ({
        id: a.id,
        type: a.type || a.activityType,
        description: a.description,
        timestamp: a.createdAt || a.timestamp,
        actor: a.performedBy || a.actor,
      })));
      setPrescriptions(data.prescriptions || []);
    } catch (error) {
      console.error('Error loading appointment details:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Helper to format booking time
  const formatBookingTime = (time: string | null | undefined): string => {
    if (!time) return '09:00 AM';
    // If already formatted like "09:00 AM", return as is
    if (time.includes('AM') || time.includes('PM')) return time;
    // Convert 24h to 12h format
    try {
      const [hours, minutes] = time.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
    } catch {
      return time;
    }
  };

  const handleOtpSubmit = async () => {
    if (otp.length !== 4) {
      setOtpError('Please enter a valid 4-digit OTP');
      return;
    }

    setProcessing(true);
    setOtpError(null);

    try {
      // Complete the booking with OTP verification
      const data = await apiClient.post(`/vendor/bookings/${bookingId}/complete`, {
        vendorId: vendorData?.id,
        otp: otp
      }) as any;
      
      if (data.success) {
        setShowOtpModal(false);
        setOtp('');
        setOtpAction(null);
        loadAppointmentDetails(); // Refresh state
        onRefresh?.();
        toast.success('Appointment completed successfully! Earnings have been recorded.');
      } else {
        setOtpError(data.error || 'Invalid OTP. Please try again.');
      }
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      setOtpError(error.message || 'Invalid OTP. Please check and try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleStartTravel = async () => {
    if (!booking) return;
    
    // ✅ SECURITY FIX: Use authenticated fetch for tracking session
    try {
      setProcessing(true);
      await apiClient.post(`/vendor/tracking/${booking.id}/start`, {
        vendorId: vendorData.id,
        type: 'traveling'
      });
      // Update local state to show we are traveling
      loadAppointmentDetails();
      onRefresh?.();
    } catch (error) {
      console.error('Error starting travel:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleArrived = async () => {
    // ✅ SECURITY FIX: Use authenticated fetch for status update
    try {
      setProcessing(true);
      await apiClient.post(`/vendor/bookings/${bookingId}/status`, {
        status: 'arrived',
        note: 'Vendor has arrived at location'
      });
      loadAppointmentDetails();
      onRefresh?.();
    } catch (error) {
      console.error('Error marking arrived:', error);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'in_progress': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'status_change': return CheckCircle2;
      case 'prescription': return Star;
      case 'chat': return MessageSquare;
      case 'note': return FileText;
      case 'follow_up': return RefreshCw;
      default: return AlertCircle;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl w-full max-w-[430px] h-[90vh] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl w-full max-w-[430px] p-6">
          <p className="text-center text-gray-600">Appointment not found</p>
          <button
            onClick={onClose}
            className="w-full mt-4 px-4 py-2 bg-[#FF8C42] text-white rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
        <div className="bg-white w-full max-w-[430px] rounded-t-[32px] sm:rounded-[32px] h-[90vh] flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4 flex items-center justify-between rounded-t-[32px]">
            <div className="flex-1">
              <h2 className="font-bold text-white">Appointment Details</h2>
              <p className="text-xs text-white/80">{booking.petName} - {booking.customerName}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 bg-white px-4">
            <button
              onClick={() => setActiveTab('details')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'details'
                  ? 'border-[#FF8C42] text-[#FF8C42]'
                  : 'border-transparent text-gray-500'
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'history'
                  ? 'border-[#FF8C42] text-[#FF8C42]'
                  : 'border-transparent text-gray-500'
              }`}
            >
              History
            </button>
            <button
              onClick={() => setActiveTab('prescriptions')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'prescriptions'
                  ? 'border-[#FF8C42] text-[#FF8C42]'
                  : 'border-transparent text-gray-500'
              }`}
            >
              Prescriptions
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto bg-gray-50">
            {activeTab === 'details' && (
              <div className="p-4 space-y-4">
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <div className={`px-4 py-2 rounded-lg border inline-block ${getStatusColor(booking.status)}`}>
                    <span className="text-sm font-medium capitalize">{booking.status.replace('_', ' ')}</span>
                  </div>
                  
                  {/* ✅ ACTION BUTTONS based on status */}
                  {booking.status === 'confirmed' && (
                    // ✅ FIXED: Tele consultations don't require OTP - complete via prescription or video call end
                    booking.serviceType === 'tele' || booking.serviceType === 'video_consultation' ? (
                      <button
                        onClick={async () => {
                          try {
                            setProcessing(true);
                            await apiClient.post(`/vendor/bookings/${bookingId}/complete`, { vendorId: vendorData?.id });
                            toast.success('Tele consultation marked as complete');
                            loadAppointmentDetails();
                            onRefresh?.();
                          } catch (e: any) { 
                            console.error(e);
                            toast.error(e.message || 'Failed to complete');
                          } finally { setProcessing(false); }
                        }}
                        disabled={processing}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {processing ? 'Completing...' : 'Mark Complete'}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setOtpAction('complete');
                          setShowOtpModal(true);
                        }}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Complete with OTP
                      </button>
                    )
                  )}
                  {booking.status === 'pending' && (
                    <button
                      onClick={async () => {
                        try {
                          setProcessing(true);
                          await apiClient.post(`/vendor/bookings/${bookingId}/confirm`, { vendorId: vendorData?.id });
                          loadAppointmentDetails();
                          onRefresh?.();
                        } catch (e) { console.error(e); } finally { setProcessing(false); }
                      }}
                      disabled={processing}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      Accept Booking
                    </button>
                  )}
                  {booking.status === 'in_progress' && (
                    // ✅ FIXED: For tele/video consultations, complete directly (no OTP needed)
                    booking.serviceType === 'tele' || booking.serviceType === 'video_consultation' ? (
                      <button
                        onClick={async () => {
                          try {
                            setProcessing(true);
                            await apiClient.post(`/vendor/bookings/${bookingId}/complete`, { vendorId: vendorData?.id });
                            toast.success('Consultation completed successfully');
                            loadAppointmentDetails();
                            onRefresh?.();
                          } catch (e: any) { 
                            console.error(e);
                            toast.error(e.message || 'Failed to complete');
                          } finally { setProcessing(false); }
                        }}
                        disabled={processing}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {processing ? 'Completing...' : 'Complete Consultation'}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setOtpAction('complete');
                          setShowOtpModal(true);
                        }}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Complete
                      </button>
                    )
                  )}
                </div>

                {/* Follow-up Badge */}
                {booking.isFollowUp && (
                  <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">Follow-up Appointment</span>
                  </div>
                )}

                {/* Date & Time */}
                <div className="bg-white rounded-xl p-4 space-y-3">
                  <h3 className="font-semibold text-gray-900">Appointment Info</h3>
                  
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Date</p>
                      <p className="font-medium text-gray-900">{new Date(booking.date).toLocaleDateString('en-IN', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Time</p>
                      <p className="font-medium text-gray-900">{booking.time} ({booking.duration} min)</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Location</p>
                      <p className="font-medium text-gray-900">{booking.location}</p>
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="bg-white rounded-xl p-4 space-y-3">
                  <h3 className="font-semibold text-gray-900">Customer Info</h3>
                  
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Owner</p>
                      <p className="font-medium text-gray-900">{booking.customerName}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <a href={`tel:${booking.customerPhone}`} className="font-medium text-[#FF8C42]">
                        {booking.customerPhone}
                      </a>
                    </div>
                  </div>
                </div>

                {/* Pet Info */}
                <div className="bg-white rounded-xl p-4 space-y-3">
                  <h3 className="font-semibold text-gray-900">Pet Info</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm text-gray-500">Name</p>
                      <p className="font-medium text-gray-900">{booking.petName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Type</p>
                      <p className="font-medium text-gray-900">{booking.petType}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Breed</p>
                      <p className="font-medium text-gray-900">{booking.petBreed || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Age</p>
                      <p className="font-medium text-gray-900">{booking.petAge || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Service Info */}
                <div className="bg-white rounded-xl p-4 space-y-3">
                  <h3 className="font-semibold text-gray-900">Service Info</h3>
                  
                  <div>
                    <p className="text-sm text-gray-500">Service</p>
                    <p className="font-medium text-gray-900">{booking.serviceName}</p>
                  </div>
                  
                  {/* Display Special Instructions if any */}
                  {booking.specialInstructions && (
                    <div>
                      <p className="text-sm text-gray-500">Customer Notes</p>
                      <p className="text-sm text-gray-900 italic">"{booking.specialInstructions}"</p>
                    </div>
                  )}

                  {/* Display Resort/Hotel Metadata */}
                  {booking.metadata && (
                    <>
                      {booking.metadata.guestCount && (
                        <div>
                          <p className="text-sm text-gray-500">Guests</p>
                          <p className="font-medium text-gray-900">{booking.metadata.guestCount} Pax</p>
                        </div>
                      )}
                      {booking.metadata.checkinDate && booking.metadata.checkoutDate && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                             <p className="text-sm text-gray-500">Check-in</p>
                             <p className="font-medium text-gray-900">{new Date(booking.metadata.checkinDate).toLocaleDateString()}</p>
                          </div>
                          <div>
                             <p className="text-sm text-gray-500">Check-out</p>
                             <p className="font-medium text-gray-900">{new Date(booking.metadata.checkoutDate).toLocaleDateString()}</p>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div>
                    <p className="text-sm text-gray-500">Price</p>
                    <p className="text-xl font-bold text-green-600">₹{booking.price}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="p-4 space-y-3">
                {activities.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <History className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No activity yet</p>
                  </div>
                ) : (
                  activities.map((activity) => {
                    const IconComponent = getActivityIcon(activity.type);
                    return (
                      <div key={activity.id} className="bg-white rounded-xl p-4 flex gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <IconComponent className="w-4 h-4 text-gray-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-900">{activity.description}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(activity.timestamp).toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'prescriptions' && (
              <div className="p-4 space-y-3">
                {/* Add Prescription Button - Always visible at top for vets */}
                {/* ✅ Check multiple role fields and values */}
                {(
                  vendorData?.roleId?.toLowerCase()?.includes('vet') ||
                  vendorData?.roleId?.toLowerCase()?.includes('clinic') ||
                  vendorData?.role?.toLowerCase()?.includes('vet') ||
                  vendorData?.roleName?.toLowerCase()?.includes('vet') ||
                  vendorData?.roleName?.toLowerCase()?.includes('clinic') ||
                  vendorData?.capabilities?.includes('prescriptions') ||
                  vendorData?.capabilities?.includes('prescription_create') ||
                  // Always show for testing - can be removed later
                  true
                ) && booking.status !== 'cancelled' && (
                  <button
                    onClick={() => setShowPrescriptionModal(true)}
                    className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg"
                  >
                    <Pill className="w-5 h-5" />
                    Create Prescription
                  </button>
                )}

                {prescriptions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Pill className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No prescriptions yet</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Add a prescription using the button above
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-gray-500 mb-2">
                      {prescriptions.length} prescription{prescriptions.length > 1 ? 's' : ''} for this visit
                    </div>
                    {prescriptions.map((prescription: any) => (
                      <div key={prescription.id} className="bg-white rounded-xl p-4 space-y-3 border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                              <Pill className="w-4 h-4 text-purple-600" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900">
                                {prescription.medication_name || prescription.medications || 'Prescription'}
                              </h4>
                              <span className="text-xs text-gray-500">
                                {new Date(prescription.uploadedAt || prescription.created_at).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {(prescription.notes || prescription.instructions) && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Instructions</p>
                            <p className="text-sm text-gray-900">{prescription.notes || prescription.instructions}</p>
                          </div>
                        )}
                        
                        {(prescription.dosage || prescription.frequency || prescription.duration) && (
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-blue-50 rounded-lg p-2">
                              <p className="text-xs text-blue-600 font-medium">Dosage</p>
                              <p className="text-sm text-gray-900">{prescription.dosage || '-'}</p>
                            </div>
                            <div className="bg-green-50 rounded-lg p-2">
                              <p className="text-xs text-green-600 font-medium">Frequency</p>
                              <p className="text-sm text-gray-900">{prescription.frequency || '-'}</p>
                            </div>
                            <div className="bg-orange-50 rounded-lg p-2">
                              <p className="text-xs text-orange-600 font-medium">Duration</p>
                              <p className="text-sm text-gray-900">{prescription.duration || '-'}</p>
                            </div>
                          </div>
                        )}
                        
                        <div className="pt-2 border-t border-gray-100 text-xs text-gray-500">
                          Prescribed by: {prescription.uploadedBy}
                        </div>
                      </div>
                    ))}
                    
                    {vendorData?.roleId === 'veterinarian' && (
                      <button
                        onClick={() => setShowPrescriptionModal(true)}
                        className="w-full px-4 py-2 bg-green-50 text-green-700 rounded-lg font-medium hover:bg-green-100 transition-colors"
                      >
                        + Add New Prescription
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="bg-white border-t border-gray-200 p-4 space-y-2">
            <div className="flex gap-2">
              {/* CHAT - Always available */}
              <button
                onClick={() => setCommunicationMode('chat')}
                className="flex-1 py-3 bg-white border border-[#FF8C42] text-[#FF8C42] rounded-xl font-medium flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Chat
              </button>
              
              {/* TELE-CONSULTATION Actions */}
              {booking.serviceType === 'tele' && booking.status !== 'completed' && booking.status !== 'cancelled' && (
                <button
                  onClick={async () => {
                    try {
                      // Create or join video call
                      const customerId = booking.customerId || '';
                      const vendorId = vendorData?.id || '';
                      
                      // First create meeting if needed
                      const createResponse = await apiClient.post('/video-call/create-meeting', {
                        bookingId: booking.id,
                        customerId,
                        vendorId,
                      }) as any;
                      
                      if (createResponse?.success || createResponse?.meetingId) {
                        // Join the meeting
                        const joinResponse = await apiClient.post<any>('/video-call/join', {
                          bookingId: booking.id,
                          userId: vendorId,
                          userType: 'vendor',
                        });
                        
                        if (joinResponse?.success) {
                          // Open video call page
                          window.open(`/video/${booking.id}`, '_blank');
                        } else {
                          toast.error('Failed to join video call');
                        }
                      } else {
                        toast.error('Failed to create video call');
                      }
                    } catch (err: any) {
                      console.error('Error starting video call:', err);
                      toast.error(err.message || 'Failed to start video call');
                    }
                  }}
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                >
                  <Video className="w-4 h-4" />
                  Start Video Call
                </button>
              )}

              {/* HOME SERVICE Actions (Walker/Trainer/Groomer) */}
              {(booking.serviceType === 'at_home' || booking.serviceType === 'home') && booking.status !== 'completed' && booking.status !== 'cancelled' && (
                <>
                  {/* Phase 1: Start Travel (If confirmed) */}
                  {booking.status === 'confirmed' && (
                    <button
                      onClick={handleStartTravel}
                      disabled={processing}
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                    >
                      <MapPin className="w-4 h-4" />
                      Start Travel
                    </button>
                  )}

                  {/* Phase 2: Arrived (If traveling/in_progress) */}
                  {(booking.status === 'traveling' || (booking.status === 'in_progress' && !(booking as any).arrived)) && (
                    <button
                      onClick={handleArrived}
                      disabled={processing}
                      className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                    >
                      <MapPin className="w-4 h-4" />
                      Mark Arrived
                    </button>
                  )}

                  {/* Phase 3: Start Session (If Arrived & Walker/Trainer) */}
                  {booking.status === 'arrived' && (vendorData?.roleId === 'pet_walker' || vendorData?.roleId === 'pet_trainer') && (
                    <button
                      onClick={() => {
                        setOtpAction('start');
                        setShowOtpModal(true);
                      }}
                      className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                    >
                      <Clock className="w-4 h-4" />
                      Start Session (OTP)
                    </button>
                  )}

                  {/* Phase 4: Complete (If In Progress or Arrived for non-session roles) */}
                  {((booking.status === 'in_progress' && booking.arrived) || (booking.status === 'arrived' && vendorData?.roleId !== 'pet_walker' && vendorData?.roleId !== 'pet_trainer')) && (
                    <button
                      onClick={() => {
                        setOtpAction('complete');
                        setShowOtpModal(true);
                      }}
                      className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Complete Job (OTP)
                    </button>
                  )}
                </>
              )}
            </div>
            
            {/* Prescription Action (Vet Only) */}
            {(vendorData?.roleId === 'veterinarian' || vendorData?.roleId === 'pet_clinic') && booking.status !== 'cancelled' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowMedicalHistory(true)}
                    className="flex-1 py-3 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Medical History
                  </button>
                  <button
                    onClick={() => setShowPrescriptionModal(true)}
                    className="flex-1 py-3 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <Pill className="w-4 h-4" />
                    {prescriptions.length > 0 ? 'Update Rx' : 'Write Rx'}
                  </button>
                </div>
                <button
                  onClick={() => setShowVetSummaryModal(true)}
                  className="w-full py-3 bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 rounded-xl font-medium flex items-center justify-center gap-2"
                >
                  <Stethoscope className="w-4 h-4" />
                  Add Consultation Summary
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Medical History Modal */}
      {showMedicalHistory && booking.petId && (
        <MedicalHistoryModal
          petId={booking.petId}
          petName={(booking as any).petName || 'Pet'}
          bookingId={bookingId}
          vendorId={vendorData?.id || ''}
          onClose={() => setShowMedicalHistory(false)}
        />
      )}

      {/* Add Vet Summary Modal */}
      {showVetSummaryModal && booking && (
        <AddVetSummaryModal
          appointmentId={bookingId}
          petName={booking.petName || 'Pet'}
          vendorId={booking.vendorId || vendorData?.id || (typeof window !== 'undefined' ? localStorage.getItem('vendorId') || '' : '')}
          staffId={booking.staffId || (typeof window !== 'undefined' ? localStorage.getItem('staffId') || localStorage.getItem('staff_id') || '' : '')}
          onClose={() => setShowVetSummaryModal(false)}
          onSuccess={() => {
            setShowVetSummaryModal(false);
            loadAppointmentDetails(); // Refresh
            onRefresh?.();
          }}
        />
      )}

      {/* Communication Hub (Unified Chat/Video) */}
      {communicationMode && (
        <CommunicationHub
          mode={communicationMode}
          bookingId={booking.id}
          userId={vendorData?.phone || vendorData?.mobile || '+91'}
          userName={vendorData?.fullName || vendorData?.businessName || 'Vendor'}
          otherUserName={booking.customerName}
          userType="vendor"
          onClose={() => {
            setCommunicationMode(null);
            loadAppointmentDetails(); // Refresh to show new activity
          }}
        />
      )}

      {/* Prescription Modal */}
      {showPrescriptionModal && booking && (
        <VendorPrescriptionModal
          bookingId={booking.id}
          petId={booking.petId}
          petName={booking.petName || 'Pet'}
          petBreed={booking.petBreed}
          petSpecies={booking.petType}
          customerId={booking.customerId || ''}
          customerName={booking.customerName || 'Customer'}
          customerPhone={booking.customerPhone}
          vendorId={booking.vendorId || vendorData?.id || (typeof window !== 'undefined' ? localStorage.getItem('vendorId') || '' : '')}
          vendorName={vendorData?.fullName || vendorData?.businessName || ''}
          staffId={booking.staffId || (typeof window !== 'undefined' ? localStorage.getItem('staffId') || localStorage.getItem('staff_id') || '' : '')}
          serviceName={booking.serviceName}
          bookingDate={booking.date}
          onClose={() => setShowPrescriptionModal(false)}
          onSuccess={() => {
            setShowPrescriptionModal(false);
            loadAppointmentDetails(); // Refresh prescriptions
            onRefresh?.();
          }}
        />
      )}

      {/* OTP Verification Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {otpAction === 'start' ? 'Start Session' : 'Complete Appointment'}
              </h3>
              <button
                onClick={() => {
                  setShowOtpModal(false);
                  setOtp('');
                  setOtpError(null);
                }}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Patient Info */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4">
              <p className="text-sm text-gray-700">
                <strong>{booking?.petName || 'Pet'}</strong> • {booking?.customerName || 'Customer'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Ask the customer for their 4-digit OTP to complete this appointment
              </p>
            </div>
            
            {/* OTP Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                4-Digit OTP
              </label>
              <input
                type="text"
                maxLength={4}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="0000"
                className="w-full text-center text-3xl tracking-[1em] font-mono border-2 border-gray-200 rounded-xl py-4 focus:border-green-500 focus:outline-none"
                autoFocus
              />
            </div>
            
            {otpError && (
              <div className="flex items-center gap-2 text-red-600 text-sm mb-4 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                {otpError}
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowOtpModal(false);
                  setOtp('');
                  setOtpError(null);
                }}
                className="flex-1 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleOtpSubmit}
                disabled={otp.length !== 4 || processing}
                className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Complete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}