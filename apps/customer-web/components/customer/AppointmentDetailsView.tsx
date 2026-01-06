'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Calendar, Clock, User, Phone, Mail, Navigation, X, AlertTriangle, Wallet as WalletIcon, CreditCard } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

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

  useEffect(() => {
    loadAppointmentDetails();
  }, [appointmentId]);

  const loadAppointmentDetails = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/appointment/${appointmentId}`);
      if (response.appointment) {
        setAppointment(response.appointment);
        setVendor(response.vendor);
        setStaff(response.staff);
        setLocation(response.location);
      }
    } catch (error) {
      console.error('Error loading appointment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGetDirections = () => {
    if (location?.latitude && location?.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`;
      window.open(url, '_blank');
    } else if (location?.address) {
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
      const response = await apiClient.post<any>(`/appointment/${appointmentId}/cancel`, {
        cancelledBy: 'customer',
        reason: cancelReason,
        refundMethod
      });

      if (response.refund) {
        alert(`Appointment cancelled successfully! Refund of ₹${response.refund.amount} will be processed to your ${refundMethod === 'wallet' ? 'wallet' : 'original payment method'}.`);
        setShowCancelModal(false);
        loadAppointmentDetails();
        if (onCancel) onCancel(appointmentId);
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading appointment...</p>
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex items-center justify-center px-6">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Appointment Not Found</h2>
          <button onClick={onBack} className="mt-4 px-4 py-2 bg-primary text-white rounded-lg">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-lg">Appointment Details</h1>
            <p className="text-sm text-gray-600">#{appointmentId.slice(-8)}</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-4">
        {/* Status Badge */}
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Status</span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              appointment.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
              appointment.status === 'completed' ? 'bg-green-100 text-green-700' :
              appointment.status === 'cancelled' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {appointment.status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Service Info */}
        <div className="bg-white p-5 rounded-xl border border-gray-200">
          <h3 className="font-semibold text-lg mb-4">{appointment.serviceName}</h3>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Date</p>
                <p className="font-semibold text-gray-900">{formatDate(appointment.scheduledDate)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Time</p>
                <p className="font-semibold text-gray-900">{formatTime(appointment.scheduledTime)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Vendor Info */}
        {vendor && (
          <div className="bg-white p-5 rounded-xl border border-gray-200">
            <h3 className="font-semibold text-lg mb-4">Vendor Information</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Name</p>
                  <p className="font-semibold text-gray-900">{vendor.name}</p>
                </div>
              </div>
              {vendor.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="font-semibold text-gray-900">{vendor.phone}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Location */}
        {location && (
          <div className="bg-white p-5 rounded-xl border border-gray-200">
            <h3 className="font-semibold text-lg mb-4">Location</h3>
            <div className="space-y-3">
              {location.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">Address</p>
                    <p className="font-semibold text-gray-900">{location.address}</p>
                  </div>
                </div>
              )}
              <button
                onClick={handleGetDirections}
                className="w-full px-4 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
              >
                <Navigation className="w-5 h-5" />
                Get Directions
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {canReschedule() && (
            <button
              onClick={() => onReschedule?.(appointmentId)}
              className="flex-1 px-4 py-3 bg-white border-2 border-primary text-primary rounded-xl font-semibold hover:bg-orange-50 transition-colors"
            >
              Reschedule
            </button>
          )}
          {canCancel() && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="flex-1 px-4 py-3 bg-white border-2 border-red-500 text-red-600 rounded-xl font-semibold hover:bg-red-50 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="font-bold text-lg mb-4">Cancel Appointment</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Reason for cancellation</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="Please provide a reason..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Refund Method</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setRefundMethod('wallet')}
                    className={`flex-1 px-4 py-2 rounded-lg border-2 ${
                      refundMethod === 'wallet' ? 'border-primary bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <WalletIcon className="w-5 h-5 mx-auto mb-1" />
                    <span className="text-xs">Wallet</span>
                  </button>
                  <button
                    onClick={() => setRefundMethod('original')}
                    className={`flex-1 px-4 py-2 rounded-lg border-2 ${
                      refundMethod === 'original' ? 'border-primary bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 mx-auto mb-1" />
                    <span className="text-xs">Original</span>
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCancelAppointment}
                  disabled={cancelling}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

