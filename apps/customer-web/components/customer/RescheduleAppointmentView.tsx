'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { SmartTimeSlotSelection } from './vet/SmartTimeSlotSelection';
import { apiClient } from '@/lib/api-client';

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

  useEffect(() => {
    loadAppointment();
  }, [appointmentId]);

  const loadAppointment = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<{ appointment?: any }>(
        `/appointment/${appointmentId}`
      );
      setAppointment(data.appointment);
    } catch (error) {
      console.error('Error loading appointment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async (date: string, time: string) => {
    try {
      setRescheduling(true);
      const data = await apiClient.post<{ success?: boolean }>(
        `/appointment/${appointmentId}/reschedule`,
        {
          newDate: date,
          newTime: time
        }
      );

      if (data.success !== false) {
        alert('Appointment rescheduled successfully!');
        onSuccess();
      } else {
        alert((data as any).error || 'Failed to reschedule appointment');
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
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
          <button onClick={onBack} className="mt-4 text-[#FF8C42]">Go Back</button>
        </div>
      </div>
    );
  }

  if (rescheduling) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Rescheduling appointment...</p>
        </div>
      </div>
    );
  }

  return (
    <SmartTimeSlotSelection
      serviceType={appointment.serviceStyle || 'clinic'}
      vendorName={appointment.vendorName || 'Clinic'}
      vendorId={appointment.vendorId}
      selectedService={{
        serviceName: appointment.serviceName,
        duration: appointment.duration
      }}
      selectedStaffId={appointment.staffId}
      vendorRoleId={appointment.vendorRoleId}
      onBack={onBack}
      onSelectSlot={handleReschedule}
    />
  );
}
