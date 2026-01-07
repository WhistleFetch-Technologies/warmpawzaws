'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Clock, MapPin, User, Phone, Mail, CreditCard, FileText, Navigation, AlertCircle, XCircle, RefreshCw, Download, Star, Package } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';
// TODO: Import these when they are created
// import { PrescriptionModal } from './PrescriptionModal';
// import { CommunicationHub } from './communication/CommunicationHub';
// import { LiveTrackingMap } from './LiveTrackingMap';
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
  
  const [communicationMode, setCommunicationMode] = useState<'video' | 'chat' | null>(null);
  const [showPrescription, setShowPrescription] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);

  useEffect(() => {
    loadBookingDetails();
  }, [bookingId]);

  const loadBookingDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get<any>(`/customer/bookings/${bookingId}`);
      if (response.booking) {
        setBooking(response.booking);
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
    
    const bookingDate = new Date(`${booking.scheduledDate} ${booking.scheduledTime}`);
    const now = new Date();
    
    return bookingDate > now;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
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
          <button onClick={onBack} className="px-4 py-2 bg-primary text-white rounded-lg">
            <ArrowLeft className="w-4 h-4 inline mr-2" />
            Go Back
          </button>
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
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(booking.status)}`}>
            {booking.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>
      </div>

      <div className="px-6 py-6 space-y-4">
        {/* Live Tracking Banner */}
        {booking.status === 'in_progress' && (
          <div className="p-5 bg-green-50 border-2 border-green-500 rounded-xl shadow-lg animate-pulse">
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
              <button 
                onClick={() => setShowLiveTracking(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-md"
              >
                Track Live
              </button>
            </div>
          </div>
        )}

        {/* Service Information */}
        <div className="bg-white p-5 rounded-xl border border-gray-200">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">{booking.serviceName}</h3>
              <div className="flex gap-2 flex-wrap">
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                  {booking.serviceType === 'tele' ? '📱 Tele Consult' : 
                   booking.serviceType === 'clinic' || booking.serviceType === 'center' ? '🏥 At Center' : 
                   '🏠 Home Visit'}
                </span>
                {booking.isPackage && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    Package
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Date</p>
                <p className="font-semibold text-gray-900">
                  {new Date(booking.scheduledDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Time</p>
                <p className="font-semibold text-gray-900">{booking.scheduledTime}</p>
              </div>
            </div>
          </div>

          {/* Vendor Info */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-3 mb-2">
              <User className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <p className="text-xs text-gray-500">Vendor</p>
                <p className="font-semibold text-gray-900">{booking.vendorName}</p>
              </div>
            </div>
            {booking.vendorAddress && (
              <div className="flex items-start gap-3 mt-2">
                <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Address</p>
                  <p className="text-sm text-gray-700">{booking.vendorAddress}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {canCancelOrReschedule() && (
          <div className="flex gap-3">
            <button
              onClick={handleRescheduleClick}
              className="flex-1 px-4 py-3 bg-white border-2 border-primary text-primary rounded-xl font-semibold hover:bg-orange-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4 inline mr-2" />
              Reschedule
            </button>
            <button
              onClick={handleCancelClick}
              className="flex-1 px-4 py-3 bg-white border-2 border-red-500 text-red-600 rounded-xl font-semibold hover:bg-red-50 transition-colors"
            >
              <XCircle className="w-4 h-4 inline mr-2" />
              Cancel
            </button>
          </div>
        )}

        {/* Prescription */}
        {booking.status === 'completed' && (
          <button
            onClick={() => setShowPrescription(true)}
            className="w-full p-4 bg-white border border-gray-200 rounded-xl text-left hover:border-primary transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-semibold text-gray-900">View Prescription</p>
                  <p className="text-xs text-gray-500">Download or view prescription details</p>
                </div>
              </div>
              <Download className="w-5 h-5 text-gray-400" />
            </div>
          </button>
        )}

        {/* Rate Service */}
        {booking.status === 'completed' && !booking.isRated && (
          <button
            onClick={() => setShowRateModal(true)}
            className="w-full p-4 bg-white border border-gray-200 rounded-xl text-left hover:border-primary transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Star className="w-5 h-5 text-yellow-500" />
                <div>
                  <p className="font-semibold text-gray-900">Rate Service</p>
                  <p className="text-xs text-gray-500">Share your experience</p>
                </div>
              </div>
            </div>
          </button>
        )}

        {/* Follow-Up Booking */}
        {booking.status === 'completed' && (
          <button
            onClick={() => setShowFollowUpModal(true)}
            className="w-full p-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors"
          >
            Book Follow-Up Appointment
          </button>
        )}
      </div>

      {/* Modals */}
      {showPrescription && booking && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="font-bold text-lg mb-4">Prescription</h3>
            <p className="text-gray-600 mb-4">Prescription view coming soon...</p>
            <button
              onClick={() => setShowPrescription(false)}
              className="w-full px-4 py-2 bg-primary text-white rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showRateModal && booking && (
        <RateServiceModal
          bookingId={bookingId}
          vendorId={booking.vendorId}
          vendorName={booking.vendorName}
          customerId={customerPhone}
          onClose={() => setShowRateModal(false)}
          onSuccess={() => {
            setShowRateModal(false);
            loadBookingDetails();
          }}
        />
      )}

      {showFollowUpModal && booking && (
        <FollowUpBookingModal
          originalBookingId={bookingId}
          vendorId={booking.vendorId}
          vendorName={booking.vendorName}
          petId={booking.petId}
          petName={booking.petName}
          customerPhone={customerPhone}
          serviceType={booking.serviceType}
          serviceName={booking.serviceName}
          onClose={() => setShowFollowUpModal(false)}
          onSuccess={() => {
            setShowFollowUpModal(false);
            onBack();
          }}
        />
      )}

      {showLiveTracking && booking && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="font-bold text-lg mb-4">Live Tracking</h3>
            <p className="text-gray-600 mb-4">Live tracking view coming soon...</p>
            <button
              onClick={() => setShowLiveTracking(false)}
              className="w-full px-4 py-2 bg-primary text-white rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {communicationMode && booking && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="font-bold text-lg mb-4">Communication Hub</h3>
            <p className="text-gray-600 mb-4">Communication hub coming soon...</p>
            <button
              onClick={() => setCommunicationMode(null)}
              className="w-full px-4 py-2 bg-primary text-white rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

