'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';
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

export function DeclineBookingModal({ booking, vendorId, onClose, onSuccess }: DeclineBookingModalProps) {
  const [vendorPolicyReason, setVendorPolicyReason] = useState<VendorCancellationReasonSlug | ''>('');
  const [suggestAlternative, setSuggestAlternative] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDecline = async () => {
    if (!vendorPolicyReason) {
      toast.error('Please select a vendor cancellation reason');
      return;
    }

    try {
      setLoading(true);

      const data = (await apiClient.post(`/vendor/bookings/${booking.id}/decline`, {
        vendorId,
        reason: '',
        suggestAlternative: suggestAlternative.trim() || null,
        vendorCancellationReason: vendorPolicyReason,
      })) as any;

      if (data && data.success) {
        const n = Array.isArray(data.cancelledPackageSessionIds) ? data.cancelledPackageSessionIds.length : 0;
        if (n > 0) {
          toast.success(
            `Package declined. ${n} session booking(s) cancelled and customer refund processed per policy.`
          );
        } else {
          toast.success('Booking declined. Customer will be notified.');
        }
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

  const scheduledLabel =
    booking.scheduledDate && booking.scheduledTime
      ? `${new Date(booking.scheduledDate).toLocaleDateString()} at ${booking.scheduledTime}`
      : booking.scheduledDate
        ? new Date(booking.scheduledDate).toLocaleString()
        : '';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        className="flex h-[min(92dvh,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1rem))] w-[min(100vw-1rem,28rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-xl border-0 p-0 shadow-2xl sm:max-w-md"
        aria-describedby="decline-booking-desc"
      >
        {/* Sticky-style header: works on iOS/Android safe areas */}
        <DialogHeader className="shrink-0 space-y-1 border-b border-gray-100 bg-white px-4 pb-3 pt-5 text-left sm:px-6 sm:pt-6">
          <div className="flex items-start gap-2 pr-10">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-semibold leading-snug text-gray-900 sm:text-xl">
                Decline booking
              </DialogTitle>
              <DialogDescription id="decline-booking-desc" className="mt-1 text-left text-sm text-gray-600">
                Refund amount follows the tier for the reason you select below.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-6">
          <div className="space-y-5">
            <div>
              <Label htmlFor="vendor-cancel-reason" className="text-sm font-medium text-gray-800">
                Vendor cancellation reason <span className="text-red-600">*</span>
              </Label>
              <p className="mt-1 text-xs text-gray-500">Used for refund and fee calculation.</p>
              <Select
                value={vendorPolicyReason || undefined}
                onValueChange={(v) => setVendorPolicyReason(v as VendorCancellationReasonSlug)}
              >
                <SelectTrigger id="vendor-cancel-reason" className="mt-2 w-full min-h-11 touch-manipulation">
                  <SelectValue placeholder="Select a reason (required)" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[min(50dvh,20rem)]">
                  {VENDOR_CANCELLATION_REASON_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="min-h-11 touch-manipulation">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-600">Declining booking for</p>
              <p className="font-semibold text-gray-900">{booking.customerName}</p>
              {scheduledLabel ? <p className="mt-1 text-sm text-gray-600">{scheduledLabel}</p> : null}
            </div>

            <div>
              <Label htmlFor="suggest-alt" className="text-sm font-medium text-gray-800">
                Suggest alternative <span className="font-normal text-gray-500">(optional)</span>
              </Label>
              <Textarea
                id="suggest-alt"
                value={suggestAlternative}
                onChange={(e) => setSuggestAlternative(e.target.value)}
                placeholder="E.g., Try booking for tomorrow at 3 PM, or contact a nearby provider."
                rows={3}
                className="mt-2 resize-none text-base sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">Helps the customer find another option.</p>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-700" aria-hidden />
              <div className="text-sm text-yellow-900">
                <p className="font-medium">Refund policy</p>
                <p className="mt-1 text-xs leading-relaxed">
                  Refund percentage and cancellation fee follow the tier for the reason you selected. Frequent declines
                  may affect your vendor rating.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t border-gray-100 bg-white px-4 py-3 sm:flex-row sm:justify-end sm:px-6 sm:py-4">
          <Button type="button" variant="outline" className="min-h-11 w-full touch-manipulation sm:w-auto" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleDecline()}
            disabled={loading || !vendorPolicyReason}
            variant="destructive"
            className="min-h-11 w-full touch-manipulation bg-red-600 hover:bg-red-700 sm:w-auto"
          >
            {loading ? 'Declining…' : 'Decline booking'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
