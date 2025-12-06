import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Calendar, Clock, User, Phone, Mail, Navigation, X, AlertTriangle, Wallet as WalletIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface AppointmentDetailsViewProps {
  appointmentId: string;
  customerId: string;
  onBack: () => void;
  onReschedule?: (appointmentId: string) => void;
  onCancel?: (appointmentId: string) => void;
}

export function AppointmentDetailsView({
  appointmentId,
  customerId,
  onBack,
  onReschedule,
  onCancel
}: AppointmentDetailsViewProps) {
  const [appointment, setAppointment] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [staff, setStaff] = useState<any>(null);
  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<'wallet' | 'original'>('wallet');
  const [cancelling, setCancelling] = useState(false);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadAppointmentDetails();
  }, [appointmentId]);

  const loadAppointmentDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/appointment/${appointmentId}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAppointment(data.appointment);
        setVendor(data.vendor);
        setStaff(data.staff);
        setLocation(data.location);
      } else {
        console.error('Failed to load appointment details');
      }
    } catch (error) {
      console.error('Error loading appointment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGetDirections = () => {
    if (location?.latitude && location?.longitude) {
      // Open Google Maps with directions
      const url = `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`;
      window.open(url, '_blank');
    } else if (location?.address) {
      // Fallback to address search
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}`;
      window.open(url, '_blank');
    }
  };

  const handleCancelAppointment = async () => {
    if (!cancelReason.trim()) {
      alert('Please provide a reason for cancellation');
      return;
    }

    try {
      setCancelling(true);
      const response = await fetch(
        `${API_BASE}/appointment/${appointmentId}/cancel`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            cancelledBy: 'customer',
            reason: cancelReason,
            refundMethod
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        alert(`Appointment cancelled successfully! Refund of ₹${data.refund.amount} will be processed to your ${refundMethod === 'wallet' ? 'wallet' : 'original payment method'}.`);
        setShowCancelModal(false);
        loadAppointmentDetails(); // Refresh
        if (onCancel) onCancel(appointmentId);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to cancel appointment');
      }
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      alert('Failed to cancel appointment');
    } finally {
      setCancelling(false);
    }
  };

  const canReschedule = () => {
    if (!appointment) return false;
    if (appointment.status === 'completed' || appointment.status === 'cancelled') return false;
    if (appointment.status === 'in_progress') return false;
    if (appointment.isPackage && appointment.completedSessions > 0) return false;
    return true;
  };

  const canCancel = () => {
    if (!appointment) return false;
    if (appointment.status === 'completed' || appointment.status === 'cancelled') return false;
    if (appointment.status === 'in_progress') return false;
    if (appointment.isPackage && appointment.completedSessions > 0) return false;
    return true;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading appointment...</p>
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-900">Appointment not found</p>
          <Button onClick={onBack} className="mt-4">Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#FF8C42] to-[#FF7029] text-white px-6 pt-8 pb-6 sticky top-0 z-10">
        <button onClick={onBack} className="mb-4 flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <div>
          <h1 className="text-2xl text-white mb-1">Appointment Details</h1>
          <p className="text-sm text-white/80">
            {appointment.serviceName || 'Service'}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`px-3 py-1 rounded-full text-xs ${
              appointment.status === 'completed' ? 'bg-green-500' :
              appointment.status === 'cancelled' ? 'bg-red-500' :
              appointment.status === 'in_progress' ? 'bg-blue-500' :
              'bg-orange-500'
            }`}>
              {appointment.status === 'in_progress' ? 'In Progress' :
               appointment.status === 'confirmed' ? 'Confirmed' :
               appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Date & Time */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-gray-900 mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#FF8C42]" />
            Date & Time
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Date</span>
              <span className="text-gray-900">{formatDate(appointment.date)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Time</span>
              <span className="text-gray-900">{formatTime(appointment.startTime)}</span>
            </div>
            {appointment.duration && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Duration</span>
                <span className="text-gray-900">{appointment.duration} minutes</span>
              </div>
            )}
          </div>
        </div>

        {/* Service Details */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-gray-900 mb-3">Service Information</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Service</span>
              <span className="text-gray-900">{appointment.serviceName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Type</span>
              <span className="text-gray-900">
                {appointment.serviceStyle === 'at_home' ? '🏠 Home Visit' :
                 appointment.serviceStyle === 'tele' ? '📹 Video Consultation' :
                 '🏥 At Center'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Amount</span>
              <span className="text-green-600">₹{appointment.amount}</span>
            </div>
          </div>
        </div>

        {/* Staff Details */}
        {staff && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="text-gray-900 mb-3 flex items-center gap-2">
              <User className="w-5 h-5 text-[#FF8C42]" />
              Staff Details
            </h3>
            <div className="flex items-center gap-3">
              {staff.photo ? (
                <img src={staff.photo} alt={staff.fullName} className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="w-6 h-6 text-gray-500" />
                </div>
              )}
              <div className="flex-1">
                <p className="text-gray-900">{staff.fullName}</p>
                <p className="text-sm text-gray-600">{staff.roleType}</p>
              </div>
            </div>
          </div>
        )}

        {/* Location Details (for at_center appointments) */}
        {location && appointment.serviceStyle === 'at_center' && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="text-gray-900 mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#FF8C42]" />
              Location
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-gray-900">{location.name}</p>
                <p className="text-sm text-gray-600 mt-1">{location.address}</p>
              </div>
              <Button
                onClick={handleGetDirections}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white"
              >
                <Navigation className="w-4 h-4 mr-2" />
                Get Directions
              </Button>
            </div>
          </div>
        )}

        {/* Vendor/Clinic Details */}
        {vendor && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="text-gray-900 mb-3">Clinic/Vendor</h3>
            <div className="space-y-2">
              <p className="text-gray-900">{vendor.clinicName || vendor.fullName}</p>
              {vendor.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4" />
                  <a href={`tel:${vendor.phone}`} className="text-[#FF8C42]">{vendor.phone}</a>
                </div>
              )}
              {vendor.email && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4" />
                  <a href={`mailto:${vendor.email}`} className="text-[#FF8C42]">{vendor.email}</a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Package Details */}
        {appointment.isPackage && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="text-blue-900 mb-2">Package Booking</h3>
            <div className="space-y-1 text-sm">
              <p className="text-blue-800">
                Total Sessions: {appointment.totalSessions || 0}
              </p>
              <p className="text-blue-800">
                Completed: {appointment.completedSessions || 0} / {appointment.totalSessions || 0}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {appointment.status !== 'completed' && appointment.status !== 'cancelled' && (
          <div className="space-y-3">
            {canReschedule() && onReschedule && (
              <Button
                onClick={() => onReschedule(appointmentId)}
                className="w-full bg-blue-500 hover:bg-blue-600"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Reschedule Appointment
              </Button>
            )}
            {canCancel() && (
              <Button
                onClick={() => setShowCancelModal(true)}
                variant="outline"
                className="w-full border-red-500 text-red-500 hover:bg-red-50"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel Appointment
              </Button>
            )}
          </div>
        )}

        {/* Cancellation Info (if cancelled) */}
        {appointment.status === 'cancelled' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <h3 className="text-red-900 mb-2">Cancellation Details</h3>
            <div className="space-y-1 text-sm">
              <p className="text-red-800">
                Cancelled by: {appointment.cancelledBy}
              </p>
              <p className="text-red-800">
                Reason: {appointment.cancellationReason}
              </p>
              {appointment.refundAmount > 0 && (
                <>
                  <p className="text-green-800 mt-2">
                    Refund: ₹{appointment.refundAmount}
                  </p>
                  {appointment.cancellationFee > 0 && (
                    <p className="text-red-800">
                      Cancellation fee: ₹{appointment.cancellationFee}
                    </p>
                  )}
                  <p className="text-gray-700">
                    Refund method: {appointment.refundMethod === 'wallet' ? 'Wallet' : 'Original Payment'}
                  </p>
                  <p className="text-gray-700">
                    Status: {appointment.refundStatus}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl text-gray-900">Cancel Appointment</h2>
              <button onClick={() => setShowCancelModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Warning */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-900">
                  ⚠️ Cancellation policies will apply based on your appointment timing
                </p>
              </div>

              {/* Refund Method Selection */}
              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  Select Refund Method
                </label>
                <div className="space-y-2">
                  <button
                    onClick={() => setRefundMethod('wallet')}
                    className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                      refundMethod === 'wallet'
                        ? 'border-[#FF8C42] bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <WalletIcon className={`w-5 h-5 ${refundMethod === 'wallet' ? 'text-[#FF8C42]' : 'text-gray-500'}`} />
                      <div className="flex-1">
                        <p className={`text-sm ${refundMethod === 'wallet' ? 'text-[#FF8C42]' : 'text-gray-900'}`}>
                          Refund to Wallet
                        </p>
                        <p className="text-xs text-gray-600">
                          ✅ Get 100% refund instantly (No cancellation fee)
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setRefundMethod('original')}
                    className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                      refundMethod === 'original'
                        ? 'border-[#FF8C42] bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Navigation className={`w-5 h-5 ${refundMethod === 'original' ? 'text-[#FF8C42]' : 'text-gray-500'}`} />
                      <div className="flex-1">
                        <p className={`text-sm ${refundMethod === 'original' ? 'text-[#FF8C42]' : 'text-gray-900'}`}>
                          Refund to Original Payment
                        </p>
                        <p className="text-xs text-gray-600">
                          ⚠️ Cancellation fees may apply (5-7 business days)
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Cancellation Reason */}
              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  Reason for Cancellation *
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Please let us know why you're cancelling..."
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowCancelModal(false)}
                  variant="outline"
                  className="flex-1"
                  disabled={cancelling}
                >
                  Keep Appointment
                </Button>
                <Button
                  onClick={handleCancelAppointment}
                  className="flex-1 bg-red-500 hover:bg-red-600"
                  disabled={cancelling || !cancelReason.trim()}
                >
                  {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
