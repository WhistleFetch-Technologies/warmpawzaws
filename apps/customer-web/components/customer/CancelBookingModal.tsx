'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/states';
import { AlertTriangle, IndianRupee, Info, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { getBookingResponsePayload, pickBookingApiMessage } from '@/lib/booking-response-message';
import { toast } from 'sonner';

interface CancelBookingModalProps {
  bookingId: string;
  customerId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function CancelBookingModal({
  bookingId,
  customerId,
  onClose,
  onSuccess
}: CancelBookingModalProps) {
  const [refundInfo, setRefundInfo] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingRefundInfo, setLoadingRefundInfo] = useState(true);

  useEffect(() => {
    loadRefundEligibility();
  }, []);

  const loadRefundEligibility = async () => {
    try {
      setLoadingRefundInfo(true);
      // Get booking details to show refund info if payment was made
      const bookingResponse = await apiClient.post('/customer/bookings/refund-preview', {
        bookingId,
        refundMethod: 'wallet',
      }) as any;
      const booking = bookingResponse.booking || bookingResponse;
      // Use refund preview response
      if (bookingResponse.refund) {
        const refund = bookingResponse.refund;
        setRefundInfo({
          eligible: refund.eligible || false,
          refundAmount: refund.refundAmount || 0,
          refundPercentage: refund.refundPercentage || 0,
          hoursUntil: refund.hoursUntil || 0,
          cancellationFee: refund.cancellationFee || 0,
          message: refund.message || 'No refund available for this booking',
          policy: refund.policy || {},
          platformFeeApplies:
            refund.platformFeeApplies === true ||
            (typeof refund.platformFeeNonRefundable === 'number' && refund.platformFeeNonRefundable > 0),
        });
      } else {
        setRefundInfo({
          eligible: false,
          refundAmount: 0,
          refundPercentage: 0,
          hoursUntil: 0,
          cancellationFee: 0,
          message: 'No refund available for this booking'
        });
      }
    } catch (error) {
      console.error('Error loading refund info:', error);
      setRefundInfo({
        eligible: false,
        refundAmount: 0,
        refundPercentage: 0,
        hoursUntil: 0,
        cancellationFee: 0,
        message: 'Unable to load refund information'
      });
    } finally {
      setLoadingRefundInfo(false);
    }
  };

  const handleCancel = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a cancellation reason');
      return;
    }

    try {
      setLoading(true);

      const result = await apiClient.post(`/bookings/${bookingId}/cancel`, {
        reason,
        customerId,
        actorId: customerId,
        actorType: 'customer'
      }) as any;

      toast.success(pickBookingApiMessage(result, 'Booking cancelled successfully'));
      const refund = getBookingResponsePayload(result).refund as Record<string, unknown> | undefined;
      if (refund && typeof refund.message === 'string' && refund.message.trim()) {
        toast.info(refund.message.trim());
      } else if (refund && typeof refund.amount === 'number' && refund.amount > 0) {
        toast.info(`Refund of ₹${refund.amount} will be processed`);
      }
      onSuccess();
    } catch (error: any) {
      console.error('Error cancelling:', error);
      toast.error(error.message || 'Failed to cancel booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="w-5 h-5" />
            Cancel Booking
          </DialogTitle>
          <DialogDescription>
            Please review the cancellation policy before proceeding
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loadingRefundInfo ? (
            <div className="py-8">
              <LoadingState message="Calculating refund..." />
            </div>
          ) : refundInfo ? (
            <>
              {/* Refund Information */}
              <div className={`p-4 rounded-lg border-2 ${
                refundInfo.eligible 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Refund Amount</p>
                    <p className={`text-2xl font-bold ${
                      refundInfo.eligible ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ₹{refundInfo.refundAmount.toFixed(2)}
                    </p>
                  </div>
                  <Badge variant={refundInfo.eligible ? 'default' : 'destructive'}>
                    {refundInfo.refundPercentage}% Refund
                  </Badge>
                </div>

                {refundInfo.cancellationFee > 0 && (
                  <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                    <span className="text-gray-600">Cancellation Fee:</span>
                    <span className="font-semibold text-red-600">
                      -₹{refundInfo.cancellationFee.toFixed(2)}
                    </span>
                  </div>
                )}

                {refundInfo.platformFeeApplies && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5 mt-2">
                    Platform fee is not refundable.
                  </p>
                )}

                <div className="flex items-start gap-2 mt-3 text-xs text-gray-600">
                  <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    {refundInfo.hoursUntil} hours until booking. 
                    {refundInfo.eligible 
                      ? ` You'll receive ${refundInfo.refundPercentage}% refund.`
                      : ' No refund available due to cancellation policy.'
                    }
                  </span>
                </div>
              </div>

              {/* Cancellation Policy */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-900 mb-2">Cancellation Policy</p>
                <ul className="space-y-1 text-xs text-gray-600">
                  {Object.entries(refundInfo.policy || {}).map(([key, value]) => (
                    <li key={key} className="flex justify-between">
                      <span>{key}:</span>
                      <span className="font-medium">{value as string}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Cancellation <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please tell us why you're cancelling..."
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This helps us improve our service
                </p>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">Important</p>
                  <p className="text-xs mt-1">
                    This action cannot be undone. The vendor will be notified immediately.
                    {refundInfo.eligible && ' Your refund will be processed within 5-7 business days.'}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-red-600 text-center py-4">
              Unable to load refund information. Please try again.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose} 
            disabled={loading}
          >
            Keep Booking
          </Button>
          <Button
            onClick={handleCancel}
            disabled={loading || !reason.trim() || loadingRefundInfo}
            variant="destructive"
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? 'Cancelling...' : 'Confirm Cancellation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
