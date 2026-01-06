'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle, User } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface AcceptBookingModalProps {
  booking: any;
  vendorId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AcceptBookingModal({ booking, vendorId, onClose, onSuccess }: AcceptBookingModalProps) {
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState(booking.staff_id || '');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(true);

  useEffect(() => {
    loadStaffMembers();
  }, [vendorId]);

  const loadStaffMembers = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/staff?active=true`);
      setStaffMembers(response.staff || []);
    } catch (error) {
      console.error('Error loading staff:', error);
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleAccept = async () => {
    if (!selectedStaffId && staffMembers.length > 0) {
      alert('Please assign a staff member');
      return;
    }

    try {
      setLoading(true);
      await apiClient.put(`/bookings/${booking.id}/status`, {
        status: 'confirmed',
        vendorId,
        staffId: selectedStaffId || undefined,
        notes
      });
      alert('✅ Booking accepted successfully!');
      onSuccess();
    } catch (error: any) {
      alert(error.message || 'Failed to accept booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <h2 className="text-xl font-bold">Accept Booking</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Confirm this booking request and assign a staff member
          </p>

          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-gray-600">Customer</p>
                  <p className="font-semibold">{booking.customer?.name || booking.customer_name}</p>
                </div>
                <div>
                  <p className="text-gray-600">Amount</p>
                  <p className="font-semibold">₹{booking.total_amount || booking.price || 0}</p>
                </div>
                <div>
                  <p className="text-gray-600">Date</p>
                  <p className="font-semibold">
                    {new Date(booking.booking_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Time</p>
                  <p className="font-semibold">{booking.booking_time || 'Flexible'}</p>
                </div>
              </div>
            </div>

            {staffMembers.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign Staff Member <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                >
                  <option value="">Select staff member</option>
                  {staffMembers.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} {staff.specialization && `- ${staff.specialization}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirmation Message (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g., Looking forward to serving you! Please arrive 5 minutes early."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                This message will be sent to the customer
              </p>
            </div>

            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Next Steps:</strong> After accepting, the customer will be notified. 
                You can start the service using the OTP on the scheduled date.
              </p>
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
              onClick={handleAccept}
              disabled={loading || (staffMembers.length > 0 && !selectedStaffId)}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {loading ? 'Accepting...' : 'Accept Booking'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

