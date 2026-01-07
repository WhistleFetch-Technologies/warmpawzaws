'use client';

import { useState, useEffect } from 'react';
import { X, AlertTriangle, DollarSign, Info, XCircle } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

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
      const response = await apiClient.get<any>(`/bookings/${bookingId}/refund-eligibility`);
      if (response) {
        setRefundInfo(response);
      }
    } catch (error) {
      console.error('Error loading refund info:', error);
    } finally {
      setLoadingRefundInfo(false);
    }
  };

  const handleCancel = async () => {
    if (!reason.trim()) {
      alert('Please provide a cancellation reason');
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.post<any>(`/bookings/${bookingId}/cancel`, {
        userId: customerId,
        userType: 'customer',
        reason
      });

      if (response.success || response.message) {
        alert(response.message || 'Booking cancelled successfully');
        onSuccess();
      } else {
        alert(response.error || 'Failed to cancel booking');
      }
    } catch (error) {
      console.error('Error cancelling:', error);
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-0 max-w-md w-full">
        <div className="flex items-center justify-between mb-0">
          <div className="flex items-center gap-0 text-red-600">
            <XCircle className="w-5 h-5" />
            <h2 className="font-bold text-lg">Cancel Booking</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {loadingRefundInfo ? (
            <div className="py-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : refundInfo ? (
            <>
              {/* Refund Information */}
              <div className={`p-4 rounded-lg border-2 ${
                refundInfo.eligible 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-start justify-between mb-0">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Refund Amount</p>
                    <p className={`text-2xl font-bold ${
                      refundInfo.eligible ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ₹{refundInfo.refundAmount?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                  <span className={`px-0 py-0 rounded-full text-xs font-medium ${
                    refundInfo.eligible ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {refundInfo.refundPercentage || 0}% Refund
                  </span>
                </div>

                {refundInfo.cancellationFee > 0 && (
                  <div className="flex justify-between text-sm pt-0 border-t border-gray-200">
                    <span className="text-gray-600">Cancellation Fee:</span>
                    <span className="font-semibold text-red-600">
                      -₹{refundInfo.cancellationFee.toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex items-start gap-0 mt-0 text-xs text-gray-600">
                  <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    {refundInfo.hoursUntil || 0} hours until booking. 
                    {refundInfo.eligible ? ' Full refund eligible.' : ' Partial refund only.'}
                  </span>
                </div>
              </div>
            </>
          ) : null}

          {/* Cancellation Reason */}
          <div>
            <label className="block text-sm font-medium mb-0">Reason for cancellation *</label>
            <textarea
              value={reason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
              className="w-full p-0 border border-gray-300 rounded-lg"
              rows={3}
              placeholder="Please provide a reason..."
              required
            />
          </div>

          {/* Actions */}
          <div className="flex gap-0">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-0 border border-gray-300 rounded-lg"
            >
              Keep Booking
            </button>
            <button
              onClick={handleCancel}
              disabled={loading || !reason.trim()}
              className="flex-1 px-4 py-0 bg-red-600 text-white rounded-lg font-semibold disabled:opacity-50"
            >
              {loading ? 'Cancelling...' : 'Confirm Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

