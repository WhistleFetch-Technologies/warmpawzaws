'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { LoadingState } from '@/components/ui/states';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { pickBookingApiMessage } from '@/lib/booking-response-message';
import { formatLocalDateYYYYMMDD } from '@/lib/local-calendar-date';
import { toast } from 'sonner';

interface RescheduleBookingModalProps {
  bookingId: string;
  currentDate: string;
  currentTime: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function RescheduleBookingModal({
  bookingId,
  currentDate,
  currentTime,
  onClose,
  onSuccess
}: RescheduleBookingModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date(currentDate));
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    if (selectedDate) {
      loadAvailableSlots(formatLocalDateYYYYMMDD(selectedDate));
    }
  }, [selectedDate]);

  const loadAvailableSlots = async (date: string) => {
    try {
      setLoadingSlots(true);
      
      // Get booking to get vendor ID
      const bookingResponse = await apiClient.get(`/bookings/${bookingId}`) as any;
      const booking = bookingResponse.booking || bookingResponse;
      if (!booking?.vendor_id) {
        throw new Error('Booking vendor not found');
      }

      // Get available slots from vendor schedule API
      const params = new URLSearchParams({
        vendorId: booking.vendor_id,
        date: date,
      });

      const response = await apiClient.get(`/bookings/available-slots?${params.toString()}`);
      const slots = (response as any).slots || [];
      
      setAvailableSlots(slots.map((slot: any) => ({
        time: slot.time || slot,
        available: slot.available !== false,
      })));
    } catch (error) {
      console.error('Error loading slots:', error);
      // Fallback to default slots
      const defaultSlots = [
        '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
      ].map(time => ({ time, available: true }));
      setAvailableSlots(defaultSlots);
      toast.error('Failed to load available slots, showing default times');
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleReschedule = async () => {
    if (!selectedDate || !selectedSlot) {
      toast.error('Please select date and time');
      return;
    }

    try {
      setLoading(true);

      const result = await apiClient.post(`/bookings/${bookingId}/reschedule`, {
        newDate: formatLocalDateYYYYMMDD(selectedDate),
        newTime: selectedSlot,
        reason,
        actorType: 'customer'
      }) as any;

      if (result && result.success === false) {
        const err = result.error;
        const errText =
          typeof err === 'string' ? err : err && typeof err === 'object' && typeof err.message === 'string' ? err.message : null;
        toast.error(errText || 'Failed to reschedule');
        return;
      }

      toast.success(pickBookingApiMessage(result, 'Booking rescheduled successfully'));
      onSuccess();
    } catch (error: any) {
      console.error('Error rescheduling:', error);
      toast.error(error.message || 'Failed to reschedule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reschedule Booking</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Schedule */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Current Schedule</p>
            <p className="font-semibold text-gray-900">
              {new Date(currentDate).toLocaleDateString()} at {currentTime}
            </p>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Select New Date
            </label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date < new Date()}
              className="rounded-md border"
            />
          </div>

          {/* Time Slots */}
          {selectedDate && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Select Time Slot
              </label>
              <p className="text-xs text-gray-500 mb-2">Select next closest time</p>
              
              {loadingSlots ? (
                <div className="py-8">
                  <LoadingState message="Loading available slots..." />
                </div>
              ) : availableSlots.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">
                  No slots available on this date
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.time}
                      onClick={() => setSelectedSlot(slot.time)}
                      disabled={!slot.available}
                      className={`
                        px-4 py-2 rounded-lg border text-sm font-medium
                        ${selectedSlot === slot.time
                          ? 'bg-blue-600 text-white border-blue-600'
                          : slot.available
                          ? 'bg-white text-gray-900 border-gray-300 hover:border-blue-500'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }
                      `}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reason (Optional) */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Reason for Rescheduling (Optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg resize-none"
              rows={3}
              placeholder="E.g., Need to change due to emergency"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleReschedule}
            disabled={loading || !selectedDate || !selectedSlot}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? 'Rescheduling...' : 'Confirm Reschedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
