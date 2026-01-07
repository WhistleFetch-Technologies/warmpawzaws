'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';
import { CalendarSlotPicker } from './booking/CalendarSlotPicker';

interface RescheduleAppointmentViewProps {
  appointmentId: string;
  onBack: () => void;
  onSuccess: () => void;
}

export function RescheduleAppointmentView({
  appointmentId,
  onBack,
  onSuccess
}: RescheduleAppointmentViewProps) {
  const [appointment, setAppointment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rescheduling, setRescheduling] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  useEffect(() => {
    loadAppointment();
  }, [appointmentId]);

  const loadAppointment = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/appointment/${appointmentId}`);
      if (response.appointment) {
        setAppointment(response.appointment);
      }
    } catch (error) {
      console.error('Error loading appointment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async (date: string, time: string) => {
    try {
      setRescheduling(true);
      const response = await apiClient.post<any>(`/appointment/${appointmentId}/reschedule`, {
        newDate: date,
        newTime: time
      });

      if (response.success) {
        alert('Appointment rescheduled successfully!');
        onSuccess();
      } else {
        alert(response.error || 'Failed to reschedule appointment');
      }
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      alert('Failed to reschedule appointment');
    } finally {
      setRescheduling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-900">Appointment not found</p>
          <button onClick={onBack} className="mt-4 text-primary">Go Back</button>
        </div>
      </div>
    );
  }

  if (rescheduling) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Rescheduling appointment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-lg">Reschedule Appointment</h1>
        </div>
      </div>

      <div className="px-6 py-6">
        <CalendarSlotPicker
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          onTimeSlotSelect={setSelectedTime}
          availableSlots={[]}
        />

        {selectedDate && selectedTime && (
          <button
            onClick={() => handleReschedule(selectedDate, selectedTime)}
            className="w-full mt-6 py-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors"
          >
            Confirm Reschedule
          </button>
        )}
      </div>
    </div>
  );
}

