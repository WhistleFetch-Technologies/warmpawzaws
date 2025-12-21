import { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, Phone, FileText, MessageCircle, History, AlertCircle, Copy, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { copyTextToClipboard } from '../../utils/shareUtils';
import { VendorPrescriptionForm } from './VendorPrescriptionForm';
import { VendorChatModal } from './VendorChatModal';
import { PetMedicalHistoryModal } from './PetMedicalHistoryModal';

interface VendorBookingDetailModalProps {
  bookingId: string;
  vendorPhone: string;
  onClose: () => void;
  onRefresh: () => void;
}

export function VendorBookingDetailModal({
  bookingId,
  vendorPhone,
  onClose,
  onRefresh
}: VendorBookingDetailModalProps) {
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPrescriptionForm, setShowPrescriptionForm] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showMedicalHistory, setShowMedicalHistory] = useState(false);
  const [hasPrescription, setHasPrescription] = useState(false);
  const [prescriptionId, setPrescriptionId] = useState<string | undefined>(undefined); // ✅ ENHANCEMENT: Store prescription ID for editing
  const [copiedOtp, setCopiedOtp] = useState(false);

  useEffect(() => {
    loadBookingDetails();
  }, [bookingId]);

  const loadBookingDetails = async () => {
    try {
      setLoading(true);
      console.log('🔍 [VENDOR-BOOKING-DETAIL] Loading booking:', bookingId);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/bookings/${bookingId}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log('✅ [VENDOR-BOOKING-DETAIL] Loaded:', result.booking);
        setBooking(result.booking);
        
        // Check if prescription exists
        checkPrescription(bookingId);
      }
    } catch (error) {
      console.error('❌ [VENDOR-BOOKING-DETAIL] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkPrescription = async (bookingId: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/prescription/booking/${bookingId}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        // ✅ ENHANCEMENT: Store prescription ID for editing
        if (result.success && result.prescription) {
          setHasPrescription(true);
          setPrescriptionId(result.prescription.id);
        } else {
          setHasPrescription(false);
          setPrescriptionId(undefined);
        }
      } else {
        setHasPrescription(false);
        setPrescriptionId(undefined);
      }
    } catch (error) {
      setHasPrescription(false);
      setPrescriptionId(undefined);
    }
  };

  const canChat = () => {
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

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
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

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
        <div 
          className="bg-white w-full max-w-[430px] rounded-t-[32px] sm:rounded-[32px] max-h-[90vh] overflow-y-auto"
          style={{ animation: 'slideUp 0.3s ease-out' }}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-[32px] z-10">
            <h2 className="font-bold text-gray-800">Booking Details</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600">Loading...</p>
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
                   booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                </span>
                <span className="text-sm text-gray-600">
                  Booking #{booking.id.slice(0, 8)}
                </span>
              </div>

              {/* OTP Section - For confirmed/in_progress bookings */}
              {booking.requiresOTP && booking.completionOTP && 
               booking.status !== 'completed' && booking.status !== 'cancelled' && (
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300 rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                      <span className="text-xl">🔐</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-orange-900">Customer OTP</h3>
                      <p className="text-xs text-orange-700">Get this from customer to complete service</p>
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
                </div>
              )}

              {/* Completed Badge */}
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

              {/* Pet Information */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-5">
                <h3 className="font-bold text-purple-900 mb-3 flex items-center gap-2">
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

                {/* View Medical History Button */}
                <button
                  onClick={() => setShowMedicalHistory(true)}
                  className="w-full mt-4 bg-purple-500 hover:bg-purple-600 text-white py-2 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <History className="w-4 h-4" />
                  View Complete Medical History
                </button>
              </div>

              {/* Customer Information */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <User className="w-5 h-5 text-[#FF8C42]" />
                  Customer Information
                </h3>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800">{booking.customerName || 'Customer'}</h4>
                    {booking.customerPhone && (
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {booking.customerPhone}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Service Details */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-gray-800">Service Details</h3>
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-pink-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                    {booking.serviceType === 'walker' ? '🐕' : 
                     booking.serviceType === 'grooming' ? '✂️' : 
                     booking.serviceType === 'vet' ? '🏥' : 
                     booking.serviceType === 'boarding' ? '🏠' : '🐾'}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800">{booking.serviceName || 'Service'}</h4>
                    <p className="text-sm text-gray-600">
                      {booking.duration ? `${booking.duration} min` : ''} 
                      {booking.serviceStyle && ` • ${booking.serviceStyle.replace('_', ' ')}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#FF8C42]">₹{booking.price || 0}</p>
                  </div>
                </div>
              </div>

              {/* Schedule Information */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#FF8C42]" />
                  Schedule
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-600 mb-1">Date</p>
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
                </div>
              </div>

              {/* Timestamps */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Booked on:</span>
                  <span className="font-medium text-gray-800">
                    {formatDate(booking.createdAt)} at {formatTime(booking.createdAt)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* Add/View Prescription Button - Only for completed bookings */}
                {booking.status === 'completed' && (
                  <Button
                    onClick={() => setShowPrescriptionForm(true)}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    <FileText className="w-5 h-5" />
                    {hasPrescription ? 'View/Edit Service Notes' : 'Add Service Notes'}
                    {hasPrescription && <span className="ml-auto bg-blue-700 px-2 py-0.5 rounded-full text-xs">Added</span>}
                  </Button>
                )}

                {/* Prescription Reminder - For completed bookings without prescription */}
                {booking.status === 'completed' && !hasPrescription && (
                  <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-900">Action Required</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Please add service notes/prescription for this completed booking
                      </p>
                    </div>
                  </div>
                )}

                {/* Chat Button - Only for completed bookings within 7 days */}
                {canChat() && (
                  <Button
                    onClick={() => setShowChat(true)}
                    className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Chat with Customer
                    <span className="ml-auto bg-green-700 px-2 py-0.5 rounded-full text-xs">
                      {Math.max(0, 7 - Math.floor((new Date().getTime() - new Date(booking.otpVerifiedAt).getTime()) / (1000 * 60 * 60 * 24)))} days left
                    </span>
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
      </div>

      {/* Prescription Form Modal */}
      {showPrescriptionForm && booking && (
        <VendorPrescriptionForm
          bookingId={bookingId}
          booking={booking}
          vendorPhone={vendorPhone}
          existingPrescriptionId={prescriptionId} // ✅ ENHANCEMENT: Pass prescription ID for editing
          onClose={() => {
            setShowPrescriptionForm(false);
            checkPrescription(bookingId); // Refresh prescription status
          }}
          onSuccess={() => {
            setShowPrescriptionForm(false);
            setHasPrescription(true);
            checkPrescription(bookingId); // Refresh to get updated prescription ID
            onRefresh();
          }}
        />
      )}

      {/* Chat Modal */}
      {showChat && booking && (
        <VendorChatModal
          bookingId={bookingId}
          vendorPhone={vendorPhone}
          vendorName={booking.vendorName || 'Vendor'}
          customerPhone={booking.customerPhone}
          customerName={booking.customerName || 'Customer'}
          onClose={() => setShowChat(false)}
        />
      )}

      {/* Pet Medical History Modal */}
      {showMedicalHistory && booking && (
        <PetMedicalHistoryModal
          petId={booking.petId}
          petName={booking.petName}
          onClose={() => setShowMedicalHistory(false)}
        />
      )}
    </>
  );
}
