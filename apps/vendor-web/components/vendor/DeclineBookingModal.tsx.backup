'use client';

import { useState } from 'react';
import { X, XCircle, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

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

  const handleDecline = async () => {
    const finalReason = selectedReason === 'Other (please specify)' 
      ? customReason 
      : selectedReason;

    if (!finalReason.trim()) {
      alert('Please select or specify a reason');
      return;
    }

    try {
      setLoading(true);
      await apiClient.put(`/bookings/${booking.id}/status`, {
        status: 'cancelled',
        vendorId,
        notes: `Declined: ${finalReason}${suggestAlternative ? ` | Alternative: ${suggestAlternative}` : ''}`
      });
      alert('✅ Booking declined. Customer will be notified.');
      onSuccess();
    } catch (error: any) {
      alert(error.message || 'Failed to decline booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              <h2 className="text-xl font-bold">Decline Booking</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Please provide a reason to help the customer understand
          </p>

          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Declining booking for:</p>
              <p className="font-semibold text-gray-900">{booking.customer?.name || booking.customer_name}</p>
              <p className="text-sm text-gray-600 mt-1">
                {new Date(booking.booking_date).toLocaleDateString()} at {booking.booking_time}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Reason for Declining <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {DECLINE_REASONS.map((reason) => (
                  <label key={reason} className="flex items-start space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="declineReason"
                      value={reason}
                      checked={selectedReason === reason}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedReason(e.target.value)}
                      className="mt-0.5"
                    />
                    <span className="text-sm">{reason}</span>
                  </label>
                ))}
              </div>
            </div>

            {selectedReason === 'Other (please specify)' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Please specify the reason
                </label>
                <textarea
                  value={customReason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCustomReason(e.target.value)}
                  placeholder="Explain why you can't accept this booking..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] resize-none"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Suggest Alternative (Optional)
              </label>
              <textarea
                value={suggestAlternative}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSuggestAlternative(e.target.value)}
                placeholder="E.g., Try booking for tomorrow at 3 PM, or contact XYZ Grooming nearby"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Help the customer find an alternative solution
              </p>
            </div>

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

          <div className="flex gap-2 mt-6">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDecline}
              disabled={
                loading || 
                !selectedReason || 
                (selectedReason === 'Other (please specify)' && !customReason.trim())
              }
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {loading ? 'Declining...' : 'Decline Booking'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

