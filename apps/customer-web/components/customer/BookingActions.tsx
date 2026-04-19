'use client';

import { useState } from 'react';
import { Calendar, X, AlertCircle, Clock, RefreshCw, XCircle, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api-client';
import { getBookingResponsePayload, pickBookingApiMessage } from '@/lib/booking-response-message';
import { toast } from 'sonner';

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

  // Check if booking can be modified
  const canModify = booking.status === 'active' || booking.status === 'scheduled' || booking.status === 'pending';
  
  // Calculate refund preview when cancel modal opens
  const fetchRefundPreview = async () => {
    try {
      const result = await apiClient.post('/customer/bookings/refund-preview', { bookingId: booking.id }) as any;
      const payload = result?.data ?? result;
      setRefundPreview(payload?.refund ?? payload);
    } catch (error) {
      console.error('Error fetching refund preview:', error);
      setRefundPreview(null);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleData.newDate) {
      toast.error('Please select a new date');
      return;
    }

    if (!rescheduleData.newTimeSlot) {
      toast.error('Please select a time slot');
      return;
    }

    setLoading(true);
    try {
      const result = await apiClient.post(`/bookings/${booking.id}/reschedule`, {
        newDate: rescheduleData.newDate,
        newTime: rescheduleData.newTimeSlot,
        reason: rescheduleData.reason,
        actorType: 'customer'
      }) as any;

      toast.success(pickBookingApiMessage(result, 'Booking rescheduled successfully'));
      setShowRescheduleModal(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error rescheduling booking:', error);
      toast.error(error.message || 'Failed to reschedule booking');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancellationReason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }

    setLoading(true);
    try {
      const result = await apiClient.post(`/bookings/${booking.id}/cancel`, {
        reason: cancellationReason,
        actorType: 'customer'
      }) as any;

      toast.success(pickBookingApiMessage(result, 'Booking cancelled successfully'));
      const refund = getBookingResponsePayload(result).refund as Record<string, unknown> | undefined;
      if (refund && typeof refund.message === 'string' && refund.message.trim()) {
        toast.info(refund.message.trim());
      } else if (refund && typeof refund.amount === 'number' && refund.amount > 0) {
        toast.info(`Refund of ₹${refund.amount} is being processed`);
      }
      setShowCancelModal(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error cancelling booking:', error);
      toast.error(error.message || 'Failed to cancel booking');
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowRescheduleModal(true)}
          className="flex-1 gap-2 border-[#FF8C42] text-[#FF8C42] hover:bg-[#FF8C42] hover:text-white"
        >
          <RefreshCw className="w-4 h-4" />
          Reschedule
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setShowCancelModal(true);
            fetchRefundPreview();
          }}
          className="flex-1 gap-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
        >
          <XCircle className="w-4 h-4" />
          Cancel
        </Button>
      </div>

      {/* Reschedule Modal */}
      <Dialog open={showRescheduleModal} onOpenChange={setShowRescheduleModal}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-[#FF8C42]" />
              Reschedule Booking
            </DialogTitle>
            <DialogDescription>
              Select a new date and time for your booking.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current booking details */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Current Schedule</p>
              <p className="text-sm">
                {new Date(booking.startDate || booking.date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
              {booking.timeSlot && (
                <p className="text-sm text-gray-600">{booking.timeSlot}</p>
              )}
            </div>

            {/* New date selection */}
            <div>
              <Label htmlFor="newDate">New Date *</Label>
              <Input
                id="newDate"
                type="date"
                value={rescheduleData.newDate}
                onChange={(e) => setRescheduleData({ ...rescheduleData, newDate: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                className="mt-1"
              />
            </div>

            {/* New time slot */}
            {booking.timeSlot && (
              <div>
                <Label htmlFor="newTimeSlot">New Time Slot</Label>
                <select
                  id="newTimeSlot"
                  value={rescheduleData.newTimeSlot}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, newTimeSlot: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1"
                >
                  <option value="">Keep same time slot</option>
                  <option value="07:00 AM - 08:00 AM">07:00 AM - 08:00 AM</option>
                  <option value="10:00 AM - 11:00 AM">10:00 AM - 11:00 AM</option>
                  <option value="02:00 PM - 03:00 PM">02:00 PM - 03:00 PM</option>
                  <option value="06:00 PM - 07:00 PM">06:00 PM - 07:00 PM</option>
                </select>
              </div>
            )}

            {/* Reason */}
            <div>
              <Label htmlFor="rescheduleReason">Reason (Optional)</Label>
              <Input
                id="rescheduleReason"
                placeholder="Why are you rescheduling?"
                value={rescheduleData.reason}
                onChange={(e) => setRescheduleData({ ...rescheduleData, reason: e.target.value })}
                className="mt-1"
              />
            </div>

            {/* Info message */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">
                You can reschedule this booking up to 12 hours before the scheduled time at no extra charge.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRescheduleModal(false)}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReschedule}
              disabled={loading}
              className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A2E]"
            >
              {loading ? 'Rescheduling...' : 'Confirm Reschedule'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Modal */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              Cancel Booking
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this booking?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Booking details */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Booking Details</p>
              <p className="text-sm mb-1">
                {new Date(booking.startDate || booking.date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
              <p className="text-sm">Amount Paid: ₹{booking.price || booking.amount || 0}</p>
            </div>

            {/* Refund preview */}
            {refundPreview && (
              <div className={`border rounded-lg p-3 ${
                refundPreview.refundAmount > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <IndianRupee className={`w-4 h-4 ${
                    refundPreview.refundAmount > 0 ? 'text-green-600' : 'text-red-600'
                  }`} />
                  <p className={`text-sm ${
                    refundPreview.refundAmount > 0 ? 'text-green-900' : 'text-red-900'
                  }`}>
                    Refund Amount: ₹{refundPreview.refundAmount}
                  </p>
                </div>
                <p className={`text-xs ${
                  refundPreview.refundAmount > 0 ? 'text-green-700' : 'text-red-700'
                }`}>
                  {refundPreview.refundPolicy}
                </p>
                {refundPreview.deductionAmount > 0 && (
                  <p className="text-xs text-gray-600 mt-1">
                    Cancellation charges: ₹{refundPreview.deductionAmount}
                  </p>
                )}
                {(refundPreview.platformFeeApplies === true ||
                  (typeof refundPreview.platformFeeNonRefundable === 'number' &&
                    refundPreview.platformFeeNonRefundable > 0)) && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5 mt-2">
                    Platform fee is not refundable.
                  </p>
                )}
              </div>
            )}

            {/* Cancellation reason */}
            <div>
              <Label htmlFor="cancellationReason">Reason for Cancellation *</Label>
              <textarea
                id="cancellationReason"
                placeholder="Please tell us why you're cancelling..."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1 min-h-[80px] resize-none"
              />
            </div>

            {/* Warning message */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                {refundPreview?.refundAmount > 0
                  ? 'Refunds will be processed within 5-7 business days to your original payment method.'
                  : 'This cancellation is not eligible for a refund as per our cancellation policy.'}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCancelModal(false)}
              disabled={loading}
              className="flex-1"
            >
              Keep Booking
            </Button>
            <Button
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 bg-red-500 hover:bg-red-600"
            >
              {loading ? 'Cancelling...' : 'Confirm Cancellation'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}