'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Copy, Check, User, Phone, Package, Info, FileText, MessageCircle, Video, PhoneCall, CalendarPlus, Download, Share2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { copyTextToClipboard } from '@/lib/shareUtils';
import { PrescriptionModal } from './PrescriptionModal';
import { CommunicationHub } from '../communication/CommunicationHub';
import { LiveTrackingMap } from '../tracking/LiveTrackingMap';
import { FollowUpBookingModal } from './FollowUpBookingModal';
import { RateServiceModal } from './RateServiceModal';

interface BookingDetailModalProps {
  bookingId: string;
  petId: string;
  phone: string;
  onClose: () => void;
  onReorderMedicine?: (medications: any[]) => void;
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

export function BookingDetailModal({ bookingId, petId, phone, onClose, onReorderMedicine }: BookingDetailModalProps) {
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

  useEffect(() => {
    loadBookingDetails();
  }, [bookingId]);

  const loadBookingDetails = async () => {
    try {
      setLoading(true);
      console.log('🔍 [BOOKING-DETAIL] Loading booking:', bookingId);
      // AWS Serverless compatible - use apiClient
      const result = await apiClient.get(`/customer/bookings/${bookingId}`) as any;
      console.log('✅ [BOOKING-DETAIL] Booking loaded:', result.booking);
      setBooking(result.booking);
      
      // Always try to load prescription (will show "No prescription" if not found)
      loadPrescription(bookingId);
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
        const result = await apiClient.get(`/prescription/booking/${bookingId}`) as any;
        setPrescription(result.prescription || null);
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

  const canChat = () => {
    if (!booking || booking.status !== 'completed' || !booking.otpVerifiedAt) return false;
    const completedAt = new Date(booking.otpVerifiedAt);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - completedAt.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff <= 7;
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
                 booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
              </span>
              <span className="text-sm text-gray-600">
                Booking #{booking.id.slice(0, 8)}
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

            {/* Completion OTP Section - Show for bookings ready to complete */}
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
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-pink-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                    {booking.serviceType === 'walker' ? '🐕' : 
                     booking.serviceType === 'grooming' ? '✂️' : 
                     booking.serviceType === 'vet' ? '🏥' : 
                     booking.serviceType === 'boarding' ? '🏠' : '🐾'}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800">
                      {booking.serviceName || 'Service'}
                    </h4>
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
                  onClick={() => {
                    // TODO: Implement actual invoice download
                    alert(`Invoice for booking ${booking.id.slice(0, 8)} will be generated. Coming soon!`);
                  }}
                  className="w-full bg-[#FF8C42] hover:bg-[#ff7a28] text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <Download className="w-5 h-5" />
                  Download Invoice
                </Button>
              )}

              {/* Prescription Button - Always visible */}
              <Button
                onClick={() => setShowPrescription(true)}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                disabled={loadingPrescription}
              >
                <FileText className="w-5 h-5" />
                {prescription ? 'View Prescription' : 'Prescription'}
                {prescription && <span className="ml-auto bg-blue-700 px-2 py-0.5 rounded-full text-xs">Available</span>}
              </Button>

              {/* Chat Button - Only for completed bookings within 7 days */}
              {canChat() && (
                <Button
                  onClick={() => setCommunicationMode('chat')}
                  className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <MessageCircle className="w-5 h-5" />
                  Chat with Vendor
                  <span className="ml-auto bg-green-700 px-2 py-0.5 rounded-full text-xs">
                    {Math.max(0, 7 - Math.floor((new Date().getTime() - new Date(booking.otpVerifiedAt).getTime()) / (1000 * 60 * 60 * 24)))} days left
                  </span>
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

              {/* Live Tracking Button */}
              {booking.status === 'in_progress' && (booking.serviceType === 'walker' || booking.serviceStyle === 'at_home') && (
                <Button
                  onClick={() => setShowLiveTracking(true)}
                  className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E] text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md"
                >
                  <MapPin className="w-5 h-5" />
                  Track Live Location
                  <span className="ml-auto bg-white/20 px-2 py-0.5 rounded-full text-xs animate-pulse">
                    LIVE
                  </span>
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
                  <span className="ml-auto bg-orange-700 px-2 py-0.5 rounded-full text-xs">
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

      {/* Prescription Modal */}
      {showPrescription && (
        <PrescriptionModal
          bookingId={bookingId}
          prescription={prescription}
          onClose={() => {
            setShowPrescription(false);
            loadPrescription(bookingId); // Reload in case it was added
          }}
          onReorderMedicine={onReorderMedicine}
        />
      )}

      {/* Communication Hub (Unified Chat/Video) */}
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