'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Calendar, Clock, DollarSign, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { projectId, publicAnonKey } from '@/lib/supabase/info';

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

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadData();
  }, [bookingId]);

  const loadData = async () => {
    try {
      const [policyData, slotsData] = await Promise.all([
        apiClient.get<{ success?: boolean; policy?: any }>(`/vendor/reschedule-policy?bookingId=${bookingId}`),
        apiClient.get<{ success?: boolean; slots?: any[] }>(`/vendor/available-slots?bookingId=${bookingId}`)
      ]);

      if (policyData && policyData.success && policyData.policy) {
        setPolicy(policyData.policy);
      }

      if (slotsData && slotsData.success && slotsData.slots) {
        setSlots(slotsData.slots || []);
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
      const response = await fetch(`${API_BASE}/bookings/${bookingId}/reschedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          newDate: selectedSlot.date,
          newTimeSlot: selectedSlot.timeSlot,
          reason
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          alert('Reschedule request submitted!');
          onSuccess?.();
        }
      }
    } catch (error) {
      console.error('Failed to reschedule:', error);
      alert('Failed to submit reschedule request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Card className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div></Card>;
  }

  if (!policy?.canReschedule) {
    return (
      <Card className="p-8 text-center bg-red-50">
        <Info className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="font-semibold text-gray-900 mb-2">Cannot Reschedule</p>
        <p className="text-gray-700">{policy?.reason}</p>
      </Card>
    );
  }

  // Group slots by date
  const slotsByDate = slots.reduce((acc, slot) => {
    const date = slot.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(slot);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-6">
      {/* Policy Info */}
      <Card className="p-6 bg-blue-50 border-blue-200">
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
      </Card>

      {/* Available Slots */}
      <Card className="p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Select New Date & Time</h4>
        {Object.keys(slotsByDate).length === 0 ? (
          <p className="text-gray-600 text-center py-8">No available slots found</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(slotsByDate).map(([date, dateSlots]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-gray-600" />
                  <span className="font-semibold text-gray-900">
                    {new Date(date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {(dateSlots as any[]).map((slot, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedSlot(slot)}
                      className={`p-3 border-2 rounded-lg transition-all ${
                        selectedSlot?.date === slot.date && selectedSlot?.timeSlot === slot.timeSlot
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <Clock className="w-4 h-4 mx-auto mb-1 text-gray-600" />
                      <div className="text-sm font-medium">{slot.timeSlot}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Reason */}
      {selectedSlot && (
        <Card className="p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Reason (Optional)</h4>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you rescheduling?"
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          onClick={handleSubmit}
          disabled={!selectedSlot || submitting}
          className="flex-1"
        >
          {submitting ? 'Submitting...' : 'Confirm Reschedule'}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
