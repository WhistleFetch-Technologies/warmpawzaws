'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { XCircle, AlertTriangle } from 'lucide-react';
import { projectId, publicAnonKey } from '@/lib/supabase/info';
import { toast } from 'sonner';

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
  const [loading, setLoading] = useState(false);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

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

      const response = await fetch(
        `${API_BASE}/bookings/${booking.id}/decline`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            vendorId,
            reason: finalReason,
            suggestAlternative: suggestAlternative || null
          })
        }
      );

      if (response.ok) {
        toast.success('Booking declined. Customer will be notified.');
        onSuccess();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to decline booking');
      }
    } catch (error) {
      console.error('Error declining booking:', error);
      toast.error('Network error');
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
              <p className="font-medium">Refund Policy</p>
              <p className="text-xs mt-1">
                When you decline a booking, the customer receives a full refund immediately. 
                Frequent declines may affect your vendor rating.
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
