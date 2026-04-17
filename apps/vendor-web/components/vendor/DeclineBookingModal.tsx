'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  VENDOR_CANCELLATION_REASON_OPTIONS,
  type VendorCancellationReasonSlug,
} from '@/lib/vendor-cancellation-reasons';

interface DeclineBookingModalProps {
  booking: any;
  vendorId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const DECLINE_REASONS = [
  'Fully booked for this time slot',
  'Staff unavailable',
  'Service area out of range',
  'Requires specialized equipment not available',
  'Emergency closure',
  'Other (please specify)'
];

export function DeclineBookingModal({ booking, vendorId, onClose, onSuccess }: DeclineBookingModalProps) {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [suggestAlternative, setSuggestAlternative] = useState('');
  const [vendorPolicyReason, setVendorPolicyReason] =
    useState<VendorCancellationReasonSlug>('operational');
  const [loading, setLoading] = useState(false);

  const handleDecline = async () => {
    const finalReason = selectedReason === 'Other (please specify)' 
      ? customReason 
      : selectedReason;

    if (!finalReason.trim()) {
      toast.error('Please select or specify a reason');
      return;
    }

    try {
      setLoading(true);

      const { apiClient } = await import('@/lib/api-client');
      const data = await apiClient.post(`/vendor/bookings/${booking.id}/decline`, {
        vendorId,
        reason: finalReason,
        suggestAlternative: suggestAlternative || null,
        vendorCancellationReason: vendorPolicyReason,
      }) as any;

      if (data && data.success) {
        toast.success('Booking declined. Customer will be notified.');
        onSuccess();
      } else {
        toast.error(data?.error || 'Failed to decline booking');
      }
    } catch (error: any) {
      console.error('Error declining booking:', error);
      toast.error(error?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="w-5 h-5" />
            Decline Booking
          </DialogTitle>
          <DialogDescription>
            Please provide a reason to help the customer understand
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="text-sm font-medium text-gray-700">Vendor cancellation reason</Label>
            <p className="text-xs text-gray-500 mt-1 mb-2">
              Used for refund and fee calculation (Admin Finance — Service Provider / Platform tiers).
            </p>
            <Select
              value={vendorPolicyReason}
              onValueChange={(v) => setVendorPolicyReason(v as VendorCancellationReasonSlug)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {VENDOR_CANCELLATION_REASON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Booking Info */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Declining booking for:</p>
            <p className="font-semibold text-gray-900">{booking.customerName}</p>
            <p className="text-sm text-gray-600 mt-1">
              {new Date(booking.scheduledDate).toLocaleDateString()} at {booking.scheduledTime}
            </p>
          </div>

          {/* Decline Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Reason for Declining <span className="text-red-500">*</span>
            </label>
            <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
              {DECLINE_REASONS.map((reason) => (
                <div key={reason} className="flex items-start space-x-2 mb-2">
                  <RadioGroupItem value={reason} id={reason} className="mt-0.5" />
                  <Label htmlFor={reason} className="text-sm cursor-pointer font-normal">
                    {reason}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Custom Reason Input */}
          {selectedReason === 'Other (please specify)' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Please specify the reason
              </label>
              <Textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Explain why you can't accept this booking..."
                rows={3}
                className="resize-none"
              />
            </div>
          )}

          {/* Suggest Alternative */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Suggest Alternative (Optional)
            </label>
            <Textarea
              value={suggestAlternative}
              onChange={(e) => setSuggestAlternative(e.target.value)}
              placeholder="E.g., Try booking for tomorrow at 3 PM, or contact XYZ Grooming nearby"
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Help the customer find an alternative solution
            </p>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium">Refund policy</p>
              <p className="text-xs mt-1">
                Refund percentage and cancellation fee follow the tier for the reason you selected above. Frequent
                declines may affect your vendor rating.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleDecline}
            disabled={
              loading || 
              !selectedReason || 
              (selectedReason === 'Other (please specify)' && !customReason.trim())
            }
            variant="destructive"
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? 'Declining...' : 'Decline Booking'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
