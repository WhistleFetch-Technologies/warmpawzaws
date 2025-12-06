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
import { CommunicationHub } from '../communication/CommunicationHub'; // ✅ ADD

interface AppointmentDetailModalProps {
  bookingId: string;
  vendorData: any;
  onClose: () => void;
  onRefresh?: () => void;
}

interface Booking {
  id: string;
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
              <button
                onClick={() => setCommunicationMode('chat')}
                className="flex-1 py-3 bg-[#FF8C42] hover:bg-[#FF7829] text-white rounded-xl font-medium flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Open Chat
              </button>
              
              {booking.serviceType === 'tele' && booking.status !== 'completed' && (
                <a
                  href={booking.meetingLink || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (!booking.meetingLink) {
                      e.preventDefault();
                      alert('Meeting link not generated yet.');
                    }
                  }}
                  className="flex-1 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                >
                  <Video className="w-4 h-4" />
                  Join Call
                </a>
              )}
            </div>
            
            {vendorData?.roleId === 'veterinarian' && booking.status !== 'cancelled' && (
              <button
                onClick={() => setShowPrescriptionModal(true)}
                className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
              >
                <Pill className="w-4 h-4" />
                {prescriptions.length > 0 ? 'Update Prescription' : 'Add Prescription'}
              </button>
            )}
          </div>
        </div>
      </div>

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
    </>
  );
}
