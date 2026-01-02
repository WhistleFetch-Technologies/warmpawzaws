import React, { useState, useEffect } from 'react';
import { X, MapPin, Clock, User, Phone, Calendar, Star, CheckCircle2, XCircle, AlertCircle, Navigation, Loader2, MessageSquare, Video, FileText, Pill, Stethoscope, RefreshCw, History, Activity, Users, DollarSign, TrendingUp, Briefcase, Heart } from 'lucide-react';
import { Button } from '../ui/button';
// ✅ FIX: Removed Supabase imports - using API Gateway now
import { toast } from 'sonner'; // ✅ FIX: Use consistent toast import
import { useVendorCapabilities } from './hooks/useVendorCapabilities'; // ✅ NEW: Capability-based actions
import { MedicalHistoryModal } from './MedicalHistoryModal';
import { CommunicationHub } from '../communication/CommunicationHub';
import { VendorPrescriptionModal } from './VendorPrescriptionModal';

interface AppointmentDetailModalProps {
  bookingId: string;
  vendorData: any;
  onClose: () => void;
  onRefresh?: () => void;
}

interface Booking {
  id: string;
  petId?: string; // ✅ Added petId for medical history context
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
  
  // ✅ NEW: Load vendor capabilities
  const { capabilities, loading: capsLoading } = useVendorCapabilities(vendorData?.roleId);
  
  // Modal states
  const [communicationMode, setCommunicationMode] = useState<'video' | 'chat' | null>(null);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [showMedicalHistory, setShowMedicalHistory] = useState(false);
  const [showVetSummaryModal, setShowVetSummaryModal] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  const [showEmergencyProtocol, setShowEmergencyProtocol] = useState(false); // ✅ NEW: Emergency protocol
  
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
      
      // ✅ FIX: Use API Gateway URL instead of Supabase
      const { apiCallJson } = await import('@warmpawz/api-client/http');
      const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
      if (!API_GATEWAY_URL) {
        throw new Error('API Gateway URL not configured');
      }
      
      // Load booking details
      const data = await apiCallJson<any>(
        `${API_GATEWAY_URL}/make-server-3dd53475/vendor/bookings/${bookingId}/details`
      );
      
      if (data.success) {
        setBooking(data.booking);
        setActivities(data.activities || []);
        setPrescriptions(data.prescriptions || []);
      }
    } catch (error) {
      console.error('Error loading appointment details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    if (otp.length !== 6) {
      setOtpError('Please enter a valid 6-digit OTP');
      return;
    }

    setProcessing(true);
    setOtpError(null);

    try {
      // ✅ FIX: Use API Gateway URL instead of Supabase
      const { apiCallJson } = await import('@warmpawz/api-client/http');
      const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
      if (!API_GATEWAY_URL) {
        throw new Error('API Gateway URL not configured');
      }
      
      // ✅ MIGRATION: Use new complete lifecycle endpoint for completion OTP
      let endpoint: string;
      let body: any;
      
      if (otpAction === 'start') {
        // Start OTP - use existing endpoint
        endpoint = `${API_GATEWAY_URL}/make-server-3dd53475/bookings/${bookingId}/verify-start`;
        body = { otp, vendorId: vendorData?.id || vendorData?.vendorId };
      } else {
        // ✅ NEW: Completion OTP - use complete lifecycle endpoint
        endpoint = `${API_GATEWAY_URL}/make-server-3dd53475/booking/${bookingId}/verify-otp-complete`;
        body = {
          otp,
          action: 'end', // 'end' or 'complete'
          vendorId: vendorData?.id || vendorData?.vendorId
        };
      }
      
      const data = await apiCallJson<any>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
      });

      if (data.success) {
        
        // Show enhanced success message for completion with lifecycle info
        if ((otpAction === 'complete' || otpAction === 'end' as any) && data.success && data.earnings) {
          const earningsInfo = ` Earnings: ₹${data.earnings.vendorEarnings}`;
          const settlementInfo = data.settlement ? ` Settlement: ${data.settlement.status}` : '';
          const payoutInfo = data.payout?.scheduled ? ` Payout: ${new Date(data.payout.scheduledAt).toLocaleDateString()}` : '';
          toast.success(`✅ Service completed!${earningsInfo}${settlementInfo}${payoutInfo}`);
        } else {
          toast.success(data.message || 'Success!');
        }
        
        setShowOtpModal(false);
        setOtp('');
        setOtpAction(null);
        loadAppointmentDetails(); // Refresh state
        onRefresh?.();
      } else {
        setOtpError(data.error || data.message || 'Invalid OTP');
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      setOtpError('Verification failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleStartTravel = async () => {
    if (!booking) return;
    
    // ✅ FIX: Use API Gateway URL instead of Supabase
    try {
      setProcessing(true);
      const { apiCallJson } = await import('@warmpawz/api-client/http');
      const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
      if (!API_GATEWAY_URL) {
        throw new Error('API Gateway URL not configured');
      }
      
      const data = await apiCallJson<any>(
        `${API_GATEWAY_URL}/make-server-3dd53475/tracking/session/create`,
        {
          method: 'POST',
          body: JSON.stringify({
            bookingId: booking.id,
            vendorId: vendorData.id,
            type: 'traveling'
          })
        }
      );
      
      if (data.success) {
        // Update local state to show we are traveling
        loadAppointmentDetails();
        onRefresh?.();
      }
    } catch (error) {
      console.error('Error starting travel:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleArrived = async () => {
    // ✅ FIX: Use API Gateway URL instead of Supabase
    try {
      setProcessing(true);
      const { apiCallJson } = await import('@warmpawz/api-client/http');
      const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
      if (!API_GATEWAY_URL) {
        throw new Error('API Gateway URL not configured');
      }
      
      await apiCallJson<any>(
        `${API_GATEWAY_URL}/make-server-3dd53475/vendor/bookings/${bookingId}/status`,
        {
          method: 'POST',
          body: JSON.stringify({ status: 'arrived', note: 'Vendor has arrived at location' })
        }
      );
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
                <div className={`px-4 py-2 rounded-lg border inline-block ${getStatusColor(booking.status)}`}>
                  <span className="text-sm font-medium capitalize">{booking.status.replace('_', ' ')}</span>
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
                    const Icon = getActivityIcon(activity.type);
                    return (
                      <div key={activity.id} className="bg-white rounded-xl p-4 flex gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4 h-4 text-gray-600" />
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
                {prescriptions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Pill className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p className="mb-4">No prescriptions yet</p>
                    {/* ✅ NEW: Show based on capability, not hardcoded role */}
                    {capabilities.prescription && (
                      <button
                        onClick={() => setShowPrescriptionModal(true)}
                        className="px-4 py-2 bg-[#FF8C42] text-white rounded-lg font-medium"
                      >
                        Add Prescription
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {prescriptions.map((prescription) => (
                      <div key={prescription.id} className="bg-white rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-gray-900">Prescription</h4>
                          <span className="text-xs text-gray-500">
                            {new Date(prescription.uploadedAt).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                        
                        {prescription.notes && (
                          <div>
                            <p className="text-sm text-gray-500 mb-1">Notes</p>
                            <p className="text-sm text-gray-900">{prescription.notes}</p>
                          </div>
                        )}
                        
                        {prescription.medications && (
                          <div>
                            <p className="text-sm text-gray-500 mb-1">Medications</p>
                            <p className="text-sm text-gray-900">{prescription.medications}</p>
                          </div>
                        )}
                        
                        {prescription.dosage && (
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <p className="text-xs text-gray-500">Dosage</p>
                              <p className="text-sm text-gray-900">{prescription.dosage}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Frequency</p>
                              <p className="text-sm text-gray-900">{prescription.frequency}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Duration</p>
                              <p className="text-sm text-gray-900">{prescription.duration}</p>
                            </div>
                          </div>
                        )}
                        
                        <div className="pt-2 border-t border-gray-100 text-xs text-gray-500">
                          Prescribed by: {prescription.uploadedBy}
                        </div>
                      </div>
                    ))}
                    
                    {/* ✅ NEW: Show based on capability */}
                    {capabilities.prescription && (
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
                  onClick={() => setCommunicationMode('video')}
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
                  {((booking.status === 'in_progress' && (booking as any).arrived) || (booking.status === 'arrived' && vendorData?.roleId !== 'pet_walker' && vendorData?.roleId !== 'pet_trainer')) && (
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
            
            {/* ✅ NEW: Capability-based Actions */}
            {booking.status !== 'cancelled' && (
              <div className="space-y-2">
                {/* Medical Records Capability */}
                {capabilities.medical_records && booking.petId && (
                  <button
                    onClick={() => setShowMedicalHistory(true)}
                    className="w-full py-3 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Medical Records
                  </button>
                )}
                
                {/* Prescription Capability */}
                {capabilities.prescription && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowPrescriptionModal(true)}
                      className="flex-1 py-3 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 rounded-xl font-medium flex items-center justify-center gap-2"
                    >
                      <Pill className="w-4 h-4" />
                      {prescriptions.length > 0 ? 'Update Rx' : 'Write Rx'}
                    </button>
                    
                    {/* Prescription Verification Capability */}
                    {capabilities.prescription_verification && (
                      <button
                        onClick={() => {
                          toast.info('Prescription verification feature coming soon');
                        }}
                        className="flex-1 py-3 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-xl font-medium flex items-center justify-center gap-2"
                      >
                        <Pill className="w-4 h-4" />
                        Verify Rx
                      </button>
                    )}
                  </div>
                )}
                
                {/* Emergency Protocol Capability */}
                {capabilities.emergency && booking.status !== 'completed' && (
                  <button
                    onClick={() => setShowEmergencyProtocol(true)}
                    className="w-full py-3 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4" />
                    Emergency Protocol
                  </button>
                )}
                
                {/* Vet Summary Capability */}
                {capabilities.vet_summary && (
                  <button
                    onClick={() => setShowVetSummaryModal(true)}
                    className="w-full py-3 bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <Stethoscope className="w-4 h-4" />
                    Add Consultation Summary
                  </button>
                )}
                
                {/* Patient Monitoring Capability */}
                {capabilities.patient_monitoring && booking.status === 'in_progress' && (
                  <button
                    onClick={() => {
                      toast.info('Patient monitoring feature coming soon');
                    }}
                    className="w-full py-3 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <Activity className="w-4 h-4" />
                    Monitor Patient
                  </button>
                )}

                {/* ✅ NEW: Multi Doctor Management */}
                {capabilities.multi_doctor_management && (
                  <button
                    onClick={() => {
                      toast.info('Multi-doctor management feature coming soon');
                    }}
                    className="w-full py-3 bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <User className="w-4 h-4" />
                    Assign Doctor
                  </button>
                )}

                {/* ✅ NEW: Table Management (Cafe) */}
                {capabilities.table_management && booking.serviceType === 'cafe' && (
                  <button
                    onClick={() => {
                      toast.info('Table management feature coming soon');
                    }}
                    className="w-full py-3 bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Manage Table
                  </button>
                )}

                {/* ✅ NEW: Pax Management (Cafe) */}
                {capabilities.pax_management && booking.serviceType === 'cafe' && (
                  <button
                    onClick={() => {
                      toast.info('Pax management feature coming soon');
                    }}
                    className="w-full py-3 bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <User className="w-4 h-4" />
                    Manage Guests
                  </button>
                )}

                {/* ✅ NEW: Occupancy Tracking (Boarding/Resort) */}
                {capabilities.occupancy_tracking && (booking.serviceType === 'boarding' || booking.serviceType === 'resort') && (
                  <button
                    onClick={() => {
                      toast.info('Occupancy tracking feature coming soon');
                    }}
                    className="w-full py-3 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Check Occupancy
                  </button>
                )}

                {/* ✅ NEW: Nightly Pricing (Boarding/Resort) */}
                {capabilities.nightly_pricing && (booking.serviceType === 'boarding' || booking.serviceType === 'resort') && (
                  <button
                    onClick={() => {
                      toast.info('Nightly pricing feature coming soon');
                    }}
                    className="w-full py-3 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <DollarSign className="w-4 h-4" />
                    View Pricing
                  </button>
                )}

                {/* ✅ NEW: Room Management (Boarding/Resort) */}
                {capabilities.room_management && (booking.serviceType === 'boarding' || booking.serviceType === 'resort') && (
                  <button
                    onClick={() => {
                      toast.info('Room management feature coming soon');
                    }}
                    className="w-full py-3 bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Manage Room
                  </button>
                )}

                {/* ✅ NEW: Inventory Management */}
                {capabilities.inventory && (
                  <button
                    onClick={() => {
                      toast.info('Inventory management feature coming soon');
                    }}
                    className="w-full py-3 bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    Check Inventory
                  </button>
                )}

                {/* ✅ NEW: Order Management */}
                {(capabilities as any).order_management && (
                  <button
                    onClick={() => {
                      toast.info('Order management feature coming soon');
                    }}
                    className="w-full py-3 bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    Manage Orders
                  </button>
                )}

                {/* ✅ NEW: Photo Upload */}
                {(capabilities as any).photo_upload && (
                  <button
                    onClick={() => {
                      toast.info('Photo upload feature coming soon');
                    }}
                    className="w-full py-3 bg-pink-50 text-pink-700 border border-pink-200 hover:bg-pink-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Upload Photos
                  </button>
                )}

                {/* ✅ NEW: Expiry Management */}
                {capabilities.expiry_management && (
                  <button
                    onClick={() => {
                      toast.info('Expiry management feature coming soon');
                    }}
                    className="w-full py-3 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <Calendar className="w-4 h-4" />
                    Check Expiry
                  </button>
                )}

                {/* ✅ NEW: Donation Management */}
                {(capabilities as any).donation && (
                  <button
                    onClick={() => {
                      toast.info('Donation management feature coming soon');
                    }}
                    className="w-full py-3 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    Donation
                  </button>
                )}

                {/* ✅ NEW: Event Management */}
                {(capabilities as any).event_management && (
                  <button
                    onClick={() => {
                      toast.info('Event management feature coming soon');
                    }}
                    className="w-full py-3 bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <Calendar className="w-4 h-4" />
                    Manage Event
                  </button>
                )}

                {/* ✅ NEW: Claims Management (Insurance) */}
                {capabilities.claims_management && booking.serviceType === 'insurance' && (
                  <button
                    onClick={() => {
                      toast.info('Claims management feature coming soon');
                    }}
                    className="w-full py-3 bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Process Claim
                  </button>
                )}

                {/* ✅ NEW: Diagnostic Lab */}
                {capabilities.diagnostic_lab && (
                  <button
                    onClick={() => {
                      toast.info('Diagnostic lab feature coming soon');
                    }}
                    className="w-full py-3 bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <Activity className="w-4 h-4" />
                    Lab Reports
                  </button>
                )}

                {/* ✅ NEW: Ambulance Services */}
                {capabilities.ambulance_services && (
                  <button
                    onClick={() => {
                      toast.info('Ambulance services feature coming soon');
                    }}
                    className="w-full py-3 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Ambulance
                  </button>
                )}

                {/* ✅ NEW: Counseling */}
                {capabilities.counseling && (
                  <button
                    onClick={() => {
                      toast.info('Counseling feature coming soon');
                    }}
                    className="w-full py-3 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Start Counseling
                  </button>
                )}

                {/* ✅ NEW: Diet Charts */}
                {capabilities.diet_charts && (
                  <button
                    onClick={() => {
                      toast.info('Diet charts feature coming soon');
                    }}
                    className="w-full py-3 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Diet Chart
                  </button>
                )}

                {/* ✅ NEW: Delivery Management */}
                {capabilities.delivery && (
                  <button
                    onClick={() => {
                      toast.info('Delivery management feature coming soon');
                    }}
                    className="w-full py-3 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <Navigation className="w-4 h-4" />
                    Track Delivery
                  </button>
                )}

                {/* ✅ NEW: Progress Tracking */}
                {capabilities.progress_tracking && (
                  <button
                    onClick={() => {
                      toast.info('Progress tracking feature coming soon');
                    }}
                    className="w-full py-3 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <TrendingUp className="w-4 h-4" />
                    View Progress
                  </button>
                )}

                {/* ✅ NEW: Gallery */}
                {capabilities.gallery && (
                  <button
                    onClick={() => {
                      toast.info('Gallery feature coming soon');
                    }}
                    className="w-full py-3 bg-pink-50 text-pink-700 border border-pink-200 hover:bg-pink-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    View Gallery
                  </button>
                )}

                {/* ✅ NEW: Portfolio */}
                {capabilities.portfolio && (
                  <button
                    onClick={() => {
                      toast.info('Portfolio feature coming soon');
                    }}
                    className="w-full py-3 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <Briefcase className="w-4 h-4" />
                    Portfolio
                  </button>
                )}

                {/* ✅ NEW: CCTV Access */}
                {capabilities.cctv_access && (
                  <button
                    onClick={() => {
                      toast.info('CCTV access feature coming soon');
                    }}
                    className="w-full py-3 bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    CCTV View
                  </button>
                )}

                {/* ✅ NEW: Controlled Substances */}
                {capabilities.controlled_substances && (
                  <button
                    onClick={() => {
                      toast.info('Controlled substances feature coming soon');
                    }}
                    className="w-full py-3 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <Pill className="w-4 h-4" />
                    Controlled Substances
                  </button>
                )}

                {/* ✅ NEW: Adoption */}
                {(capabilities as any).adoption && (
                  <button
                    onClick={() => {
                      toast.info('Adoption feature coming soon');
                    }}
                    className="w-full py-3 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <Heart className="w-4 h-4" />
                    Adoption
                  </button>
                )}

                {/* ✅ NEW: Memorial */}
                {(capabilities as any).memorial && (
                  <button
                    onClick={() => {
                      toast.info('Memorial services feature coming soon');
                    }}
                    className="w-full py-3 bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Memorial
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Medical History Modal */}
      {showMedicalHistory && booking.petId && (
        <MedicalHistoryModal
          petId={booking.petId}
          petName={booking.petName}
          bookingId={bookingId}
          vendorId={vendorData?.id || ''}
          onClose={() => setShowMedicalHistory(false)}
        />
      )}

      {/* Add Vet Summary Modal */}
      {showVetSummaryModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full">
            <h2 className="text-xl font-bold mb-4">Vet Summary</h2>
            <p className="text-gray-600 mb-4">Vet summary feature coming soon</p>
            <button
              onClick={() => {
                setShowVetSummaryModal(false);
                loadAppointmentDetails(); // Refresh
                onRefresh?.();
              }}
              className="px-4 py-2 bg-gray-200 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
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
      {showPrescriptionModal && (
        <VendorPrescriptionModal
          bookingId={booking.id}
          petName={booking.petName}
          customerName={booking.customerName}
          vendorId={vendorData?.id || ''}
          vendorName={vendorData?.fullName || vendorData?.businessName || ''}
          onClose={() => setShowPrescriptionModal(false)}
          onSuccess={() => {
            setShowPrescriptionModal(false);
            loadAppointmentDetails(); // Refresh
            onRefresh?.();
          }}
        />
      )}

      {/* OTP Verification Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {otpAction === 'start' ? 'Start Session' : 'Complete Service'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Ask the customer for the 6-digit OTP sent to their phone to {otpAction} the service.
            </p>
            
            <input
              type="text"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter 6-digit OTP"
              className="w-full text-center text-2xl tracking-[0.5em] font-mono border-2 border-gray-200 rounded-xl py-3 mb-4 focus:border-[#FF8C42] focus:outline-none"
              autoFocus
            />
            
            {otpError && (
              <p className="text-red-500 text-sm text-center mb-4 bg-red-50 p-2 rounded-lg">
                {otpError}
              </p>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowOtpModal(false);
                  setOtp('');
                  setOtpError(null);
                }}
                className="flex-1 py-3 border border-gray-300 rounded-xl font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleOtpSubmit}
                disabled={otp.length !== 6 || processing}
                className="flex-1 py-3 bg-[#FF8C42] text-white rounded-xl font-medium disabled:opacity-50"
              >
                {processing ? 'Verifying...' : 'Verify OTP'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}