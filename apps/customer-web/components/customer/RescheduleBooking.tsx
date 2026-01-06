'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, DollarSign, Info } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface RescheduleBookingProps {
  bookingId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function RescheduleBooking({ bookingId, onSuccess, onCancel }: RescheduleBookingProps) {
  const [policy, setPolicy] = useState<any>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [bookingId]);

  const loadData = async () => {
    try {
      const [policyRes, slotsRes] = await Promise.all([
        apiClient.get<any>(`/bookings/${bookingId}/reschedule-policy`),
        apiClient.get<any>(`/bookings/${bookingId}/reschedule-options`)
      ]);

      if (policyRes.success) {
        setPolicy(policyRes.policy);
      }

      if (slotsRes.success) {
        setSlots(slotsRes.slots || []);
      }
    } catch (error) {
      console.error('Failed to load reschedule data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedSlot) {
      alert('Please select a time slot');
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiClient.post<any>(`/bookings/${bookingId}/reschedule`, {
        newDate: selectedSlot.date,
        newTimeSlot: selectedSlot.timeSlot,
        reason
      });

      if (response.success) {
        alert('Reschedule request submitted!');
        onSuccess?.();
      }
    } catch (error) {
      console.error('Failed to reschedule:', error);
      alert('Failed to submit reschedule request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!policy?.canReschedule) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-xl border border-red-200 text-center max-w-md">
          <Info className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="font-semibold text-gray-900 mb-2">Cannot Reschedule</p>
          <p className="text-gray-700">{policy?.reason}</p>
          {onCancel && (
            <button
              onClick={onCancel}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-lg"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  const slotsByDate = slots.reduce((acc: Record<string, any[]>, slot: any) => {
    const date = slot.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(slot);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      {/* Policy Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Rescheduling Policy</h4>
            <ul className="space-y-1 text-sm text-gray-700">
              {policy.rules.map((rule: string, idx: number) => (
                <li key={idx}>• {rule}</li>
              ))}
            </ul>
            {policy.fee > 0 && (
              <div className="mt-3 flex items-center gap-2 text-orange-700">
                <DollarSign className="w-4 h-4" />
                <span className="font-semibold">Rescheduling Fee: ₹{policy.fee}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Available Slots */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h4 className="font-semibold text-gray-900 mb-4">Select New Date & Time</h4>
        {Object.keys(slotsByDate).length === 0 ? (
          <p className="text-gray-600 text-center py-8">No available slots found</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(slotsByDate).map(([date, dateSlots]: [string, any[]]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-gray-600" />
                  <span className="font-semibold text-gray-900">
                    {new Date(date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {dateSlots.map((slot) => {
                    const isSelected = selectedSlot?.date === date && selectedSlot?.timeSlot === slot.timeSlot;
                    return (
                      <button
                        key={slot.timeSlot}
                        onClick={() => setSelectedSlot({ date, timeSlot: slot.timeSlot })}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'border-primary bg-orange-50 text-primary'
                            : 'border-gray-200 hover:border-primary text-gray-900'
                        }`}
                      >
                        <Clock className="w-4 h-4 mx-auto mb-1" />
                        <span className="text-sm font-medium">{slot.timeSlot}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reason */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <label className="block text-sm font-medium mb-2">Reason for rescheduling (optional)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg"
          rows={3}
          placeholder="Please provide a reason..."
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={!selectedSlot || submitting}
          className="flex-1 px-4 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting...' : 'Confirm Reschedule'}
        </button>
      </div>
    </div>
  );
}

