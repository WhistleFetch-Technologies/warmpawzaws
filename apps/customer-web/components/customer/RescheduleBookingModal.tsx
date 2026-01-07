'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

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
  const [selectedDate, setSelectedDate] = useState<string>(currentDate);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    if (selectedDate) {
      loadAvailableSlots(selectedDate);
    }
  }, [selectedDate]);

  const loadAvailableSlots = async (date: string) => {
    try {
      setLoadingSlots(true);
      const response = await apiClient.get<{ slots: string[] }>(`/bookings/${bookingId}/available-slots?date=${date}`);
      if (response.slots) {
        setAvailableSlots(response.slots);
      }
    } catch (error) {
      console.error('Error loading slots:', error);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleReschedule = async () => {
    if (!selectedDate || !selectedSlot) {
      alert('Please select date and time');
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.post<any>(`/bookings/${bookingId}/reschedule`, {
        newDate: selectedDate,
        newTime: selectedSlot,
        reason
      });

      if (response.success) {
        onSuccess();
      } else {
        alert(response.error || 'Failed to reschedule');
      }
    } catch (error) {
      console.error('Error rescheduling:', error);
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-0 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-0">
          <h2 className="font-bold text-lg">Reschedule Booking</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Current Schedule */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-0">Current Schedule</p>
            <p className="font-semibold text-gray-900">
              {new Date(currentDate).toLocaleDateString()} at {currentTime}
            </p>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-sm font-medium mb-0 flex items-center gap-0">
              <Calendar className="w-4 h-4" />
              Select New Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full p-0 border border-gray-300 rounded-lg"
            />
          </div>

          {/* Time Slots */}
          {selectedDate && (
            <div>
              <label className="block text-sm font-medium mb-0 flex items-center gap-0">
                <Clock className="w-4 h-4" />
                Select Time Slot
              </label>
              
              {loadingSlots ? (
                <div className="py-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </div>
              ) : availableSlots.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">
                  No slots available on this date
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-0 max-h-60 overflow-y-auto">
                  {availableSlots.map((slot) => {
                    const isSelected = selectedSlot === slot;
                    return (
                      <button
                        key={slot}
                        onClick={() => setSelectedSlot(slot)}
                        className={`p-0 rounded-lg border-2 transition-all text-sm ${
                          isSelected
                            ? 'border-primary bg-orange-50 text-primary'
                            : 'border-gray-200 hover:border-primary text-gray-900'
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium mb-0">Reason (optional)</label>
            <textarea
              value={reason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
              className="w-full p-0 border border-gray-300 rounded-lg"
              rows={3}
              placeholder="Please provide a reason..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-0">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-0 border border-gray-300 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleReschedule}
              disabled={loading || !selectedDate || !selectedSlot}
              className="flex-1 px-4 py-0 bg-primary text-white rounded-lg font-semibold disabled:opacity-50"
            >
              {loading ? 'Rescheduling...' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

