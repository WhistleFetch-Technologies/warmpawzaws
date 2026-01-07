'use client';

import { useState } from 'react';
import { X, Calendar, Clock, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

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
      const startTime = selectedTime.split(' - ')[0];

      const response = await apiClient.post<any>('/customer/bookings/create', {
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
        paymentMethod: 'cash',
        amount: 0
      });

      if (response.success || response.bookingId) {
        alert('Follow-up booked successfully!');
        onSuccess();
      } else {
        throw new Error(response.error || 'Failed to create follow-up booking');
      }
    } catch (err) {
      console.error('Error:', err);
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
        <div className="sticky top-0 bg-white border-b border-gray-200 px-0 py-4 flex items-center justify-between rounded-t-[32px] z-10">
          <h2 className="font-bold text-gray-800">Book Follow-Up</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-0 space-y-6">
          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-0">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm text-blue-900 font-medium">Follow-up Appointment</p>
                <p className="text-xs text-blue-700 mt-0">
                  Schedule a follow-up with {vendorName} for {petName}
                </p>
              </div>
            </div>
          </div>

          {/* Date Selection */}
          <div>
            <label className="block text-sm font-medium mb-0 flex items-center gap-0">
              <Calendar className="w-4 h-4" />
              Select Date
            </label>
            <div className="grid grid-cols-2 gap-0">
              {getAvailableDates().map((date) => {
                const dateStr = date.toISOString().split('T')[0];
                const isSelected = selectedDate === dateStr;
                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`p-0 rounded-lg border-2 transition-all text-sm ${
                      isSelected
                        ? 'border-primary bg-orange-50 text-primary'
                        : 'border-gray-200 hover:border-primary text-gray-900'
                    }`}
                  >
                    <div className="font-semibold">{formatDate(date)}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Selection */}
          {selectedDate && (
            <div>
              <label className="block text-sm font-medium mb-0 flex items-center gap-0">
                <Clock className="w-4 h-4" />
                Select Time
              </label>
              <div className="grid grid-cols-2 gap-0">
                {timeSlots.map((slot) => {
                  const isSelected = selectedTime === slot;
                  return (
                    <button
                      key={slot}
                      onClick={() => setSelectedTime(slot)}
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
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-0">Additional Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
              className="w-full p-0 border border-gray-300 rounded-lg"
              rows={3}
              placeholder="Any special instructions or concerns..."
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-0">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleBookFollowUp}
            disabled={saving || !selectedDate || !selectedTime}
            className="w-full py-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Booking...' : 'Confirm Follow-Up Booking'}
          </button>
        </div>
      </div>
    </div>
  );
}

