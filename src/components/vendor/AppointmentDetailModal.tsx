import { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  MapPin, 
  Phone, 
  User, 
  MessageSquare,
  Video,
  Pill,
  FileText,
  History,
  RefreshCw,
  Stethoscope,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { VendorChatModal } from './VendorChatModal';
import { VendorPrescriptionModal } from './VendorPrescriptionModal';
import { MedicalHistoryModal } from './MedicalHistoryModal';
import { AddVetSummaryModal } from './AddVetSummaryModal';
import { CommunicationHub } from '../communication/CommunicationHub'; // ✅ ADD

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
      const bookingResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/bookings/${bookingId}/details`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );
      
      if (bookingResponse.ok) {
        const data = await bookingResponse.json();
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
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/bookings/${bookingId}/otp/verify`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ otp, action: otpAction })
        }
      );

      if (response.ok) {
        const data = await response.json();
        setShowOtpModal(false);
        setOtp('');
        setOtpAction(null);
        loadAppointmentDetails(); // Refresh state
        onRefresh?.();
        alert(data.message || 'Success!');
      } else {
        const error = await response.json();
        setOtpError(error.error || 'Invalid OTP');
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      setOtpError('Verification failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleStartTravel = async () => {
    if (!booking) return;
    
    // Create/Update tracking session
    try {
      setProcessing(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/tracking/session/create`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            bookingId: booking.id,
            vendorId: vendorData.id,
            type: 'traveling'
          })
        }
      );
      
      if (response.ok) {
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
    try {
      setProcessing(true);
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/bookings/${bookingId}/status`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
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
      case 'status_change': return CheckCircle;
      case 'prescription': return Pill;
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
                    {vendorData?.roleId === 'veterinarian' && (
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
                  {(booking.status === 'traveling' || (booking.status === 'in_progress' && !booking.arrived)) && (
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
                      <CheckCircle className="w-4 h-4" />
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
          petName={booking.petName}
          bookingId={bookingId}
          vendorId={vendorData?.id || ''}
          onClose={() => setShowMedicalHistory(false)}
        />
      )}

      {/* Add Vet Summary Modal */}
      {showVetSummaryModal && (
        <AddVetSummaryModal
          appointmentId={bookingId}
          petName={booking.petName}
          vendorId={vendorData?.id || ''}
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