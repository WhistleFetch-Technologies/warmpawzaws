import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { LoadingState } from '../ui/states';
import { AlertTriangle, DollarSign, Info, XCircle } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

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

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadRefundEligibility();
  }, []);

  const loadRefundEligibility = async () => {
    try {
      setLoadingRefundInfo(true);
      const response = await fetch(
        `${API_BASE}/bookings/${bookingId}/refund-eligibility`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setRefundInfo(data);
      } else {
        toast.error('Failed to load refund information');
      }
    } catch (error) {
      console.error('Error loading refund info:', error);
      toast.error('Network error');
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

      // ✅ FIX: Use SQL-migrated appointment cancel endpoint
      const response = await fetch(
        `${API_BASE}/appointment/${bookingId}/cancel`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            reason
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || 'Booking cancelled successfully');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to cancel booking');
      }
    } catch (error) {
      console.error('Error cancelling:', error);
      toast.error('Network error');
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
