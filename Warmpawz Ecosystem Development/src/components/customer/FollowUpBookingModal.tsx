import { useState } from 'react';
import { X, Calendar, Clock, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { toast } from 'sonner';

interface FollowUpBookingModalProps {
  originalBookingId: string;
  vendorId: string;
  vendorName: string;
  petId: string;
  petName: string;
  customerPhone: string;
  serviceType: string;
  serviceName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function FollowUpBookingModal({
  originalBookingId,
  vendorId,
  vendorName,
  petId,
  petName,
  customerPhone,
  serviceType,
  serviceName,
  onClose,
  onSuccess
}: FollowUpBookingModalProps) {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Generate next 14 days for date selection
  const getAvailableDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 1; i <= 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  // Common time slots
  const timeSlots = [
    '09:00 - 10:00',
    '10:00 - 11:00',
    '11:00 - 12:00',
    '12:00 - 13:00',
    '14:00 - 15:00',
    '15:00 - 16:00',
    '16:00 - 17:00',
    '17:00 - 18:00'
  ];

  const handleBookFollowUp = async () => {
    if (!selectedDate || !selectedTime) {
      setError('Please select both date and time');
      return;
    }

    setSaving(true);
    setError('');

    try {
      console.log('📅 [FOLLOW-UP-BOOKING] Creating follow-up booking:', {
        originalBookingId,
        vendorId,
        petId,
        customerPhone,
        serviceType,
        scheduledDate: selectedDate,
        scheduledTime: selectedTime,
        notes
      });

      // Extract time from slot (e.g., "09:00 - 10:00" -> "09:00")
      const startTime = selectedTime.split(' - ')[0];

      // Call booking creation API
      const response = await fetch(
        `${getApiBaseUrl()}/customer/bookings/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            phone: customerPhone,
            vendorId,
            petId,
            serviceType,
            serviceName,
            scheduledDate: selectedDate,
            scheduledTime: startTime,
            notes,
            isFollowUp: true,
            originalBookingId,
            // Additional required fields
            paymentMethod: 'cash', // Default for follow-up
            amount: 0 // Will be set by backend from service
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create follow-up booking');
      }

      const result = await response.json();
      console.log('✅ [FOLLOW-UP-BOOKING] Booking created:', result);

      toast.success('Follow-up booked successfully!', {
        description: `Appointment scheduled for ${new Date(selectedDate).toLocaleDateString()} at ${startTime}`
      });

      onSuccess();
      
    } catch (err) {
      console.error('❌ [FOLLOW-UP-BOOKING] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create follow-up booking');
      setSaving(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center">
      <div 
        className="bg-white w-full max-w-[430px] rounded-t-[32px] sm:rounded-[32px] max-h-[90vh] overflow-y-auto"
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-[32px] z-10">
          <h2 className="font-bold text-gray-800">Book Follow-Up</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6 pb-24">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Booking Info */}
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-2xl">
                📅
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800">Follow-up with {vendorName}</h3>
                <p className="text-sm text-gray-600">{petName} • {serviceName}</p>
              </div>
            </div>
            <p className="text-xs text-orange-700">
              Book a follow-up appointment within the 7-day window
            </p>
          </div>

          {/* Date Selection */}
          <div className="space-y-3">
            <label className="block font-semibold text-gray-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#FF8C42]" />
              Select Date
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
              {getAvailableDates().map((date) => {
                const dateStr = date.toISOString().split('T')[0];
                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      selectedDate === dateStr
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-gray-800 border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    <p className={`text-sm font-semibold ${
                      selectedDate === dateStr ? 'text-white' : 'text-gray-800'
                    }`}>
                      {formatDate(date)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Selection */}
          {selectedDate && (
            <div className="space-y-3">
              <label className="block font-semibold text-gray-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#FF8C42]" />
                Select Time Slot
              </label>
              <div className="grid grid-cols-2 gap-2">
                {timeSlots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setSelectedTime(slot)}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      selectedTime === slot
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-gray-800 border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    <p className={`text-sm font-semibold ${
                      selectedTime === slot ? 'text-white' : 'text-gray-800'
                    }`}>
                      {slot}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Additional Notes */}
          <div className="space-y-3">
            <label className="block font-semibold text-gray-800">
              Additional Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Any specific concerns or follow-up reasons..."
            />
          </div>
        </div>

        {/* Fixed Bottom Actions */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 space-y-3">
          <Button
            onClick={handleBookFollowUp}
            disabled={!selectedDate || !selectedTime || saving}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Booking...
              </>
            ) : (
              <>
                <Calendar className="w-5 h-5" />
                Confirm Follow-Up Booking
              </>
            )}
          </Button>

          {/* Home Indicator */}
          <div className="flex justify-center">
            <div className="w-32 h-1 bg-gray-300 rounded-full"></div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}