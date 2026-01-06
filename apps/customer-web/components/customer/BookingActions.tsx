'use client';

import { useState } from 'react';
import { Calendar, X, AlertCircle, Clock, RefreshCw, XCircle, IndianRupee } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface BookingActionsProps {
  booking: any;
  phone: string;
  onSuccess: () => void;
}

export function BookingActions({ booking, phone, onSuccess }: BookingActionsProps) {
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refundPreview, setRefundPreview] = useState<any>(null);
  
  const [rescheduleData, setRescheduleData] = useState({
    newDate: '',
    newTimeSlot: '',
    reason: ''
  });
  
  const [cancellationReason, setCancellationReason] = useState('');

  const canModify = booking.status === 'active' || booking.status === 'scheduled' || booking.status === 'pending';
  
  const fetchRefundPreview = async () => {
    try {
      const response = await apiClient.post<{ refund: any }>('/bookings/calculate-refund', {
        bookingId: booking.id
      });
      if (response.refund) {
        setRefundPreview(response.refund);
      }
    } catch (error) {
      console.error('Error fetching refund preview:', error);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleData.newDate) {
      alert('Please select a new date');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post(`/bookings/${booking.id}/reschedule`, {
        newDate: rescheduleData.newDate,
        newTimeSlot: rescheduleData.newTimeSlot,
        reason: rescheduleData.reason,
        phone
      });

      if (response) {
        alert('Booking rescheduled successfully');
        setShowRescheduleModal(false);
        onSuccess();
      }
    } catch (error) {
      console.error('Error rescheduling booking:', error);
      alert('Failed to reschedule booking');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancellationReason.trim()) {
      alert('Please provide a reason for cancellation');
      return;
    }

    setLoading(true);
    try {
      await fetchRefundPreview();
      setShowCancelModal(true);
    } catch (error) {
      console.error('Error fetching refund preview:', error);
    } finally {
      setLoading(false);
    }
  };

  const confirmCancel = async () => {
    setLoading(true);
    try {
      const response = await apiClient.post(`/bookings/${booking.id}/cancel`, {
        reason: cancellationReason,
        phone
      });

      if (response) {
        alert('Booking cancelled successfully');
        setShowCancelModal(false);
        onSuccess();
      }
    } catch (error) {
      console.error('Error cancelling booking:', error);
      alert('Failed to cancel booking');
    } finally {
      setLoading(false);
    }
  };

  if (!canModify) {
    return null;
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => setShowRescheduleModal(true)}
          className="flex-1 px-4 py-2 border-2 border-primary text-primary rounded-xl font-medium hover:bg-primary hover:text-white transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Reschedule
        </button>
        <button
          onClick={handleCancel}
          className="flex-1 px-4 py-2 border-2 border-red-500 text-red-500 rounded-xl font-medium hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center gap-2"
        >
          <XCircle className="w-4 h-4" />
          Cancel
        </button>
      </div>

      {/* Reschedule Modal */}
      {showRescheduleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-[430px] max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-primary to-primary-dark px-6 py-6 flex items-center justify-between z-10">
              <h2 className="text-white font-bold text-lg">Reschedule Booking</h2>
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="px-6 py-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">New Date *</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={rescheduleData.newDate}
                    onChange={(e) => setRescheduleData({...rescheduleData, newDate: e.target.value})}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">New Time Slot</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="time"
                    value={rescheduleData.newTimeSlot}
                    onChange={(e) => setRescheduleData({...rescheduleData, newTimeSlot: e.target.value})}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Reason (Optional)</label>
                <textarea
                  value={rescheduleData.reason}
                  onChange={(e) => setRescheduleData({...rescheduleData, reason: e.target.value})}
                  placeholder="Why are you rescheduling?"
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none resize-none"
                />
              </div>

              <button
                onClick={handleReschedule}
                disabled={loading || !rescheduleData.newDate}
                className="w-full py-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Rescheduling...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-[430px] max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-red-500 to-red-600 px-6 py-6 flex items-center justify-between z-10">
              <h2 className="text-white font-bold text-lg">Cancel Booking</h2>
              <button
                onClick={() => setShowCancelModal(false)}
                className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="px-6 py-6 space-y-4">
              {refundPreview && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <IndianRupee className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-900">Refund Amount</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">
                    ₹{refundPreview.amount || 0}
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    {refundPreview.message || 'Refund will be processed within 5-7 business days'}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Reason for Cancellation *</label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="Please tell us why you're cancelling..."
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none resize-none"
                  required
                />
              </div>

              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-900 mb-1">Are you sure?</p>
                    <p className="text-sm text-red-700">
                      This action cannot be undone. Your booking will be cancelled immediately.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Keep Booking
                </button>
                <button
                  onClick={confirmCancel}
                  disabled={loading || !cancellationReason.trim()}
                  className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Cancelling...' : 'Confirm Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

