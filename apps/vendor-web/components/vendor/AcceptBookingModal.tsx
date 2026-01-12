'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, User } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

interface AcceptBookingModalProps {
  booking: any;
  vendorId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AcceptBookingModal({ booking, vendorId, onClose, onSuccess }: AcceptBookingModalProps) {
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState(booking.staffId || '');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(true);

  useEffect(() => {
    loadStaffMembers();
  }, []);

  const loadStaffMembers = async () => {
    try {
      const data = await apiClient.get<any>(`/vendor/${vendorId}/staff?active=true`);
      if (data && data.success) {
        setStaffMembers(data.staff || []);
      } else {
        setStaffMembers(data.staff || data || []);
      }
    } catch (error) {
      console.error('Error loading staff:', error);
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleAccept = async () => {
    if (!selectedStaffId && staffMembers.length > 0) {
      toast.error('Please assign a staff member');
      return;
    }

    try {
      setLoading(true);

      const data = await apiClient.post(`/vendor/bookings/${booking.id}/confirm`, {
        vendorId,
        staffId: selectedStaffId || undefined,
        notes
      }) as any;

      if (data && data.success) {
        toast.success('Booking accepted successfully!');
        onSuccess();
      } else {
        toast.error(data?.error || 'Failed to accept booking');
      }
    } catch (error: any) {
      console.error('Error accepting booking:', error);
      toast.error(error?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-5 h-5" />
            Accept Booking
          </DialogTitle>
          <DialogDescription>
            Confirm this booking request and assign a staff member
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Booking Summary */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-gray-600">Customer</p>
                <p className="font-semibold">{booking.customerName}</p>
              </div>
              <div>
                <p className="text-gray-600">Amount</p>
                <p className="font-semibold">₹{booking.totalAmount || booking.price}</p>
              </div>
              <div>
                <p className="text-gray-600">Date</p>
                <p className="font-semibold">
                  {new Date(booking.scheduledDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Time</p>
                <p className="font-semibold">{booking.scheduledTime || 'Flexible'}</p>
              </div>
            </div>
          </div>

          {/* Staff Assignment */}
          {staffMembers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign Staff Member <span className="text-red-500">*</span>
              </label>
              <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staffMembers.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {staff.name}
                        {staff.specialization && (
                          <span className="text-xs text-gray-500">
                            - {staff.specialization}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Confirmation Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirmation Message (Optional)
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g., Looking forward to serving you! Please arrive 5 minutes early."
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              This message will be sent to the customer
            </p>
          </div>

          {/* Info Box */}
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>Next Steps:</strong> After accepting, the customer will be notified. 
              You can start the service using the OTP on the scheduled date.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleAccept}
            disabled={loading || (staffMembers.length > 0 && !selectedStaffId)}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? 'Accepting...' : 'Accept Booking'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
