import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Clock, MapPin, User, Phone, Mail, CreditCard, FileText, Navigation, AlertCircle, XCircle, RefreshCw, Download, Star, Package } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

import { PrescriptionModal } from './PrescriptionModal';
import { CommunicationHub } from '../communication/CommunicationHub';
import { LiveTrackingMap } from './LiveTrackingMap';
import { FollowUpBookingModal } from './FollowUpBookingModal';
import { RateServiceModal } from './RateServiceModal';

interface AppointmentDetailsProps {
  bookingId: string;
  customerPhone: string;
  onBack: () => void;
  onCancel?: (bookingId: string) => void;
  onReschedule?: (bookingId: string) => void;
}

export function AppointmentDetails({ bookingId, customerPhone, onBack, onCancel, onReschedule }: AppointmentDetailsProps) {
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [showLiveTracking, setShowLiveTracking] = useState(false);
  
  // Interaction States
  const [communicationMode, setCommunicationMode] = useState<'video' | 'chat' | null>(null);
  const [showPrescription, setShowPrescription] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadBookingDetails();
  }, [bookingId]);

  const loadBookingDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_BASE}/customer/bookings/${bookingId}`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setBooking(data.booking);
      } else {
        setError('Failed to load booking details');
      }
    } catch (err) {
      console.error('Error loading booking:', err);
      setError('An error occurred while loading booking details');
    } finally {
      setLoading(false);
    }
  };

  const getDirections = () => {
    if (!booking) return;
    
    // For clinic/center visits, use vendor location
    if (booking.serviceType === 'clinic' || booking.serviceType === 'center') {
      if (booking.vendorAddress) {
        const address = encodeURIComponent(booking.vendorAddress);
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${address}`, '_blank');
      } else if (booking.vendorLat && booking.vendorLon) {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${booking.vendorLat},${booking.vendorLon}`, '_blank');
      }
    }
  };

  const handleCancelClick = () => {
    if (onCancel) {
      onCancel(bookingId);
    }
  };

  const handleRescheduleClick = () => {
    if (onReschedule) {
      onReschedule(bookingId);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'in_progress': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      case 'rescheduled': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const canCancelOrReschedule = () => {
    if (!booking) return false;
    if (booking.status === 'completed' || booking.status === 'cancelled') return false;
    
    // Check if booking date hasn't passed
    const bookingDate = new Date(`${booking.scheduledDate} ${booking.scheduledTime}`);
    const now = new Date();
    
    return bookingDate > now;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading appointment details...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto flex items-center justify-center px-6">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Appointment</h2>
          <p className="text-gray-600 mb-6">{error || 'Appointment not found'}</p>
          <Button onClick={onBack} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-lg">Appointment Details</h1>
            <p className="text-sm text-gray-600">{booking.bookingId}</p>
          </div>
          <Badge className={`${getStatusColor(booking.status)} border`}>
            {booking.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
      </div>

      <div className="px-6 py-6 space-y-4">
        {/* Live Tracking Banner */}
        {booking.status === 'in_progress' && (
          <Card className="p-5 bg-green-50 border-2 border-green-500 shadow-lg animate-pulse-slow">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center animate-pulse">
                  <MapPin className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-bold text-green-900">Service is In Progress</h3>
                  <p className="text-sm text-green-700">Track live location & ETA</p>
                </div>
              </div>
              <Button 
                onClick={() => setShowLiveTracking(true)}
                className="bg-green-600 hover:bg-green-700 text-white shadow-md"
              >
                Track Live
              </Button>
            </div>
          </Card>
        )}

        {/* Service Information */}
        <Card className="p-5 border border-gray-200">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-[#FF8C42] bg-opacity-10 rounded-xl flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-[#FF8C42]" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">{booking.serviceName}</h3>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  {booking.serviceType === 'tele' ? '📱 Tele Consult' : 
                   booking.serviceType === 'clinic' || booking.serviceType === 'center' ? '🏥 At Center' : 
                   '🏠 Home Visit'}
                </Badge>
                {booking.isPackage && (
                  <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                    <Package className="w-3 h-3 mr-1" />
                    Package
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Package Progress */}
          {booking.isPackage && booking.packageDetails && (
            <div className="bg-purple-50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-purple-900">
                  {booking.packageName || 'Package'}
                </span>
                <span className="text-sm text-purple-700">
                  {booking.packageDetails.completedSessions}/{booking.packageDetails.totalSessions} Sessions
                </span>
              </div>
              <div className="w-full bg-purple-200 rounded-full h-2">
                <div 
                  className="bg-purple-600 h-2 rounded-full transition-all"
                  style={{ width: `${(booking.packageDetails.completedSessions / booking.packageDetails.totalSessions) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Date & Time */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Date</p>
                <p className="font-semibold">
                  {new Date(booking.scheduledDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Time</p>
                <p className="font-semibold">{booking.scheduledTime}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Vendor/Doctor Information */}
        <Card className="p-5 border border-gray-200">
          <h3 className="font-semibold mb-4">Service Provider</h3>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-600">
                  {booking.roleId?.includes('vet') ? 'Doctor' : 'Provider'}
                </p>
                <p className="font-semibold">{booking.staffName || booking.vendorName}</p>
                {booking.qualification && (
                  <p className="text-sm text-gray-500">{booking.qualification}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-600">Location</p>
                <p className="font-semibold">{booking.vendorName}</p>
                {booking.vendorAddress && (
                  <p className="text-sm text-gray-500">{booking.vendorAddress}</p>
                )}
              </div>
            </div>

            {booking.vendorPhone && (
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-600">Contact</p>
                  <a href={`tel:${booking.vendorPhone}`} className="font-semibold text-[#FF8C42]">
                    {booking.vendorPhone}
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Get Directions Button - Only for clinic/center visits */}
          {(booking.serviceType === 'clinic' || booking.serviceType === 'center') && booking.vendorAddress && (
            <Button
              className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white"
              onClick={getDirections}
            >
              <Navigation className="w-4 h-4 mr-2" />
              Get Directions
            </Button>
          )}
        </Card>

        {/* Pet Information */}
        <Card className="p-5 border border-gray-200">
          <h3 className="font-semibold mb-4">Pet Details</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Name</span>
              <span className="font-semibold">{booking.petName}</span>
            </div>
            {booking.petType && (
              <div className="flex justify-between">
                <span className="text-gray-600">Type</span>
                <span className="font-semibold capitalize">{booking.petType}</span>
              </div>
            )}
            {booking.petBreed && (
              <div className="flex justify-between">
                <span className="text-gray-600">Breed</span>
                <span className="font-semibold">{booking.petBreed}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Payment Information */}
        <Card className="p-5 border border-gray-200">
          <h3 className="font-semibold mb-4">Payment Details</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Amount Paid</span>
              <span className="font-bold text-green-600">₹{booking.amount?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Payment Method</span>
              <span className="capitalize">{booking.paymentMethod}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Transaction ID</span>
              <span className="text-sm font-mono">{booking.transactionId || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Payment Status</span>
              <Badge className="bg-green-100 text-green-700 border-none text-xs">
                {booking.paymentStatus || 'Paid'}
              </Badge>
            </div>
          </div>
        </Card>

        {/* OTP Information - Contextually Smart */}
        {/* Start OTP - Show when confirmed/arrived */}
        {booking.status === 'confirmed' && booking.startOTP && (
          <Card className="p-5 bg-gradient-to-br from-orange-50 to-white border-2 border-orange-300">
            <h3 className="font-semibold mb-3 text-orange-900">Start Session OTP</h3>
            <div className="bg-white rounded-lg border-2 border-orange-200 p-4 mb-3">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">Share to START the service</p>
                <div className="text-4xl font-bold text-orange-600 tracking-wider font-mono">
                  {booking.startOTP}
                </div>
              </div>
            </div>
            <p className="text-xs text-orange-800 text-center">
              Give this to the provider when they arrive/start
            </p>
          </Card>
        )}

        {/* Completion OTP - Show when in progress */}
        {booking.status === 'in_progress' && booking.completionOTP && (
          <Card className="p-5 bg-gradient-to-br from-purple-50 to-white border-2 border-purple-300">
            <h3 className="font-semibold mb-3 text-purple-900">Completion OTP</h3>
            <div className="bg-white rounded-lg border-2 border-purple-200 p-4 mb-3">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">Share to END the service</p>
                <div className="text-4xl font-bold text-purple-600 tracking-wider font-mono">
                  {booking.completionOTP}
                </div>
              </div>
            </div>
            <p className="text-xs text-purple-800 text-center">
              Only share after service is fully completed
            </p>
          </Card>
        )}

        {/* OTP Information - Fallback/Legacy */}
        {booking.otp && booking.status !== 'completed' && !booking.startOTP && !booking.completionOTP && (
          <Card className="p-5 bg-gradient-to-br from-purple-50 to-white border-2 border-purple-300">
            <h3 className="font-semibold mb-3 text-purple-900">Service Completion OTP</h3>
            <div className="bg-white rounded-lg border-2 border-purple-200 p-4 mb-3">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">Share this OTP after service completion</p>
                <div className="text-4xl font-bold text-purple-600 tracking-wider">
                  {booking.otp}
                </div>
              </div>
            </div>
            <div className="bg-purple-100 rounded-lg p-3 text-sm text-purple-800">
              <p className="font-semibold mb-1">⚠️ Important:</p>
              <p>Only share this OTP with the service provider after service completion to confirm and trigger payment.</p>
            </div>
          </Card>
        )}

        {/* Prescription/Notes - If completed */}
        {booking.status === 'completed' && (booking.prescriptionId || booking.notes) && (
          <Card className="p-5 border border-gray-200">
            <h3 className="font-semibold mb-4">Service Notes</h3>
            {booking.diagnosis && (
              <div className="mb-3">
                <p className="text-sm text-gray-600 mb-1">Diagnosis</p>
                <p className="font-semibold">{booking.diagnosis}</p>
              </div>
            )}
            {booking.notes && (
              <div className="mb-3">
                <p className="text-sm text-gray-600 mb-1">Notes</p>
                <p>{booking.notes}</p>
              </div>
            )}
            {booking.prescriptionId && (
              <>
                <Button 
                  onClick={() => setShowPrescription(true)}
                  variant="outline" 
                  className="w-full mt-2 border-purple-200 text-purple-700 hover:bg-purple-50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  View Prescription
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full mt-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                  onClick={() => {
                    // Order Medicine Flow
                    alert('Navigating to pharmacy with prescription...');
                  }}
                >
                  <Pill className="w-4 h-4 mr-2" />
                  Order Medicine
                </Button>
              </>
            )}
          </Card>
        )}

        {/* Action Buttons */}
        {canCancelOrReschedule() && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            {/* Tele-health Join Button */}
            {booking.serviceType === 'tele' && booking.status === 'confirmed' && (
              <Button
                className="col-span-2 bg-purple-600 hover:bg-purple-700 text-white mb-2"
                onClick={() => setCommunicationMode('video')}
              >
                <Video className="w-4 h-4 mr-2" />
                Join Video Call
              </Button>
            )}

            <Button
              variant="outline"
              className="border-orange-300 text-orange-600 hover:bg-orange-50"
              onClick={handleRescheduleClick}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reschedule
            </Button>
            <Button
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
              onClick={handleCancelClick}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        )}

        {/* Chat Button - Always Available */}
        {booking.status !== 'cancelled' && (
          <Button
            variant="outline"
            className="w-full mt-2 border-gray-300 text-gray-700"
            onClick={() => setCommunicationMode('chat')}
          >
            <Mail className="w-4 h-4 mr-2" />
            Chat with Provider
          </Button>
        )}

        {/* Cancelled Information */}
        {booking.status === 'cancelled' && (
          <Card className="p-5 bg-red-50 border-2 border-red-200">
            <div className="flex items-start gap-3">
              <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-900 mb-1">Booking Cancelled</h3>
                {booking.cancellationReason && (
                  <p className="text-sm text-red-800 mb-2">
                    Reason: {booking.cancellationReason}
                  </p>
                )}
                {booking.cancelledBy && (
                  <p className="text-sm text-red-700">
                    Cancelled by: {booking.cancelledBy}
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Completed Information */}
        {booking.status === 'completed' && (
          <Card className="p-5 bg-green-50 border-2 border-green-200">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Star className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-green-900">Service Completed</h3>
                <p className="text-sm text-green-700">
                  {booking.completedAt && `on ${new Date(booking.completedAt).toLocaleDateString()}`}
                </p>
              </div>
            </div>
            <Button className="w-full bg-[#FF8C42] hover:bg-[#FF7029] text-white">
              <Star className="w-4 h-4 mr-2" />
              Rate this Service
            </Button>
          </Card>
        )}
      </div>
      {/* Communication Hub */}
      {communicationMode && (
        <CommunicationHub
          mode={communicationMode}
          bookingId={booking.id}
          userId={customerPhone}
          userName="You"
          otherUserName={booking.vendorName}
          userType="customer"
          onClose={() => setCommunicationMode(null)}
        />
      )}

      {/* Prescription Modal (View Only) */}
      {showPrescription && booking.prescriptionId && (
        <PrescriptionModal
          prescriptionId={booking.prescriptionId}
          onClose={() => setShowPrescription(false)}
          readOnly={true}
        />
      )}
    </div>
  );
}
