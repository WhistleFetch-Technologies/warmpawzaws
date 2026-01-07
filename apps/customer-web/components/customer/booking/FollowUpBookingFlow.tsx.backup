'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Clock, CheckCircle, X } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';
import { CalendarSlotPicker } from './CalendarSlotPicker';

interface FollowUpBookingFlowProps {
  phone: string;
  previousBookingId: string;
  onBack: () => void;
  onSuccess: (bookingId: string) => void;
}

export function FollowUpBookingFlow({
  phone,
  previousBookingId,
  onBack,
  onSuccess
}: FollowUpBookingFlowProps) {
  const [loading, setLoading] = useState(false);
  const [previousBooking, setPreviousBooking] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');

  useEffect(() => {
    loadPreviousBooking();
  }, [previousBookingId]);

  const loadPreviousBooking = async () => {
    try {
      const response = await apiClient.get<{ booking: any }>(`/bookings/${previousBookingId}`);
      if (response.booking) {
        setPreviousBooking(response.booking);
      }
    } catch (error) {
      console.error('Error loading previous booking:', error);
    }
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTimeSlot) {
      alert('Please select date and time slot');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post<{ bookingId: string }>('/booking/follow-up', {
        phone,
        previousBookingId,
        scheduledDate: selectedDate,
        scheduledTime: selectedTimeSlot
      });

      if (response.bookingId) {
        alert('Follow-up booking created successfully!');
        onSuccess(response.bookingId);
      }
    } catch (err) {
      console.error('Error creating follow-up booking:', err);
      alert('Failed to create follow-up booking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary-dark px-6 pt-12 pb-6 sticky top-0 z-20">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBack}
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-white text-xl font-bold">Follow-Up Booking</h1>
            <p className="text-white/90 text-sm">Schedule your next appointment</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6 space-y-6">
        {/* Previous Booking Info */}
        {previousBooking && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border-2 border-primary">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <h3 className="font-bold text-gray-900">Previous Appointment</h3>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <p>Service: {previousBooking.serviceName}</p>
              <p>Date: {new Date(previousBooking.scheduledDate).toLocaleDateString()}</p>
              <p>Pet: {previousBooking.petName}</p>
            </div>
          </div>
        )}

        {/* Calendar & Time Slot Picker */}
        <CalendarSlotPicker
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          onTimeSlotSelect={setSelectedTimeSlot}
        />

        {/* Confirm Button */}
        <button
          onClick={handleSubmit}
          disabled={loading || !selectedDate || !selectedTimeSlot}
          className="w-full py-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating Follow-Up...' : 'Confirm Follow-Up Booking'}
        </button>
      </div>
    </div>
  );
}

