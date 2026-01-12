import React, { useState, useEffect } from 'react';
import { Calendar, Clock, AlertCircle, Check } from 'lucide-react';

/**
 * 📅 RESCHEDULE BOOKING
 * 
 * Phase 7C: Rule 15 - Rescheduling Policies
 */

export function RescheduleBooking({ 
  bookingId, 
  apiUrl = `${import.meta.env.VITE_API_URL}/make-server-3dd53475` 
}) {
  const [options, setOptions] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadOptions();
  }, [bookingId]);

  const loadOptions = async () => {
    const response = await fetch(`${apiUrl}/booking/${bookingId}/reschedule-options`);
    const data = await response.json();
    setOptions(data.data?.options);
  };

  const handleReschedule = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/booking/${bookingId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newDateTime: `${selectedDate}T${selectedTime}`,
          reason,
        }),
      });
      if (response.ok) setSuccess(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <Check className="w-12 h-12 text-green-600 mx-auto mb-3" />
        <h3 className="mb-2">Reschedule Request Submitted!</h3>
        <p className="text-gray-600">Your request is being reviewed</p>
      </div>
    );
  }

  if (!options) {
    return <div className="animate-pulse bg-gray-100 rounded-lg h-64" />;
  }

  if (!options.canReschedule) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <AlertCircle className="w-6 h-6 text-yellow-600 mb-2" />
        <h3>Rescheduling Not Available</h3>
        <p className="text-sm text-gray-600">
          {options.remainingReschedules === 0 
            ? 'You have reached the maximum number of reschedules' 
            : 'Rescheduling is not allowed for this booking'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2">Reschedule Booking</h2>
        <p className="text-sm text-gray-600">
          {options.remainingReschedules} reschedule{options.remainingReschedules !== 1 ? 's' : ''} remaining
          {options.reschedulingFee > 0 && ` • ₹${options.reschedulingFee} fee`}
        </p>
      </div>

      <div>
        <label className="block mb-2">Select New Date</label>
        <select
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg"
        >
          <option value="">Choose a date</option>
          {options.availableSlots?.map((slot: any) => (
            <option key={slot.date} value={slot.date}>{slot.date}</option>
          ))}
        </select>
      </div>

      {selectedDate && (
        <div>
          <label className="block mb-2">Select Time</label>
          <div className="grid grid-cols-4 gap-2">
            {options.availableSlots
              ?.find((s: any) => s.date === selectedDate)
              ?.slots.map((slot: any) => (
                <button
                  key={slot.time}
                  onClick={() => setSelectedTime(slot.time)}
                  disabled={!slot.available}
                  className={`p-3 border rounded-lg ${
                    selectedTime === slot.time
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  } disabled:opacity-50`}
                >
                  {slot.time}
                </button>
              ))}
          </div>
        </div>
      )}

      <div>
        <label className="block mb-2">Reason (Optional)</label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg"
          rows={3}
          placeholder="Why do you need to reschedule?"
        />
      </div>

      <button
        onClick={handleReschedule}
        disabled={!selectedDate || !selectedTime || loading}
        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
      >
        {loading ? 'Submitting...' : 'Submit Reschedule Request'}
      </button>
    </div>
  );
}
