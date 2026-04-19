'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar } from 'lucide-react';
import { SmartTimeSlotSelection } from './vet/SmartTimeSlotSelection';
import { apiClient } from '@/lib/api-client';
import { pickBookingApiMessage } from '@/lib/booking-response-message';
import { toast } from 'sonner';
import {
  getResolvedCustomerId,
  isCustomerDatabaseUuid,
  persistCustomerDatabaseId,
} from '@/lib/customer-id-storage';
import { ServiceDashboardHeader } from './shared/ServiceDashboardHeader';
import { normalizeAppointmentDetailPayload } from './AppointmentDetailsView';

interface RescheduleAppointmentViewProps {
  appointmentId: string;
  phone: string;
  onBack: () => void;
  onSuccess: () => void;
}

async function resolveCustomerDatabaseIdForPhone(loginPhone: string): Promise<string | null> {
  const cached = getResolvedCustomerId();
  if (cached) return cached;
  if (!loginPhone?.trim()) return null;
  try {
    const res = (await apiClient.get(
      `/customer/profile?phone=${encodeURIComponent(loginPhone.trim())}`
    )) as Record<string, unknown>;
    const p = (res.profile ?? res) as Record<string, unknown>;
    const id = p?.id ?? p?.customer_id;
    if (typeof id === 'string' && isCustomerDatabaseUuid(id)) {
      persistCustomerDatabaseId(id);
      return id;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function RescheduleAppointmentView({
  appointmentId,
  phone,
  onBack,
  onSuccess
}: RescheduleAppointmentViewProps) {
  const [appointment, setAppointment] = useState<any>(null);
  const [customerDbId, setCustomerDbId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rescheduling, setRescheduling] = useState(false);

  const loadAppointment = useCallback(async () => {
    try {
      setLoading(true);
      const cid = await resolveCustomerDatabaseIdForPhone(phone);
      setCustomerDbId(cid);
      if (!cid) {
        setAppointment(null);
        return;
      }
      const data = await apiClient.get<{ appointment?: Record<string, unknown> }>(
        `/appointment/${appointmentId}?customerId=${encodeURIComponent(cid)}`
      );
      const raw = data.appointment ?? (data as any).data?.appointment;
      const { appointment: appt } = normalizeAppointmentDetailPayload(
        raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
      );
      setAppointment(appt);
    } catch (error) {
      console.error('Error loading appointment:', error);
      setAppointment(null);
    } finally {
      setLoading(false);
    }
  }, [appointmentId, phone]);

  useEffect(() => {
    loadAppointment();
  }, [loadAppointment]);

  const handleReschedule = async (date: string, time: string) => {
    if (!customerDbId) {
      toast.error('Unable to verify your account. Please try again.');
      return;
    }
    try {
      setRescheduling(true);
      const data = await apiClient.post<{ message?: string; error?: string }>(
        `/appointment/${appointmentId}/reschedule?customerId=${encodeURIComponent(customerDbId)}`,
        {
          appointment_date: date,
          appointment_time: time,
          reason: 'Customer requested reschedule',
        }
      );

      if ((data as any).error) {
        toast.error(String((data as any).error));
      } else {
        toast.success(pickBookingApiMessage(data, 'Appointment rescheduled successfully!'));
        onSuccess();
      }
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      toast.error('Failed to reschedule appointment');
    } finally {
      setRescheduling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-customer mx-auto">
        <ServiceDashboardHeader
          serviceName="Reschedule"
          serviceSubtitle="Pick a new time"
          serviceIcon={Calendar}
          stats={[
            { value: '…', label: 'Step' },
            { value: '1/1', label: '' },
          ]}
          onBack={onBack}
          showBackButton
        />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-purple-200 border-t-purple-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-customer mx-auto">
        <ServiceDashboardHeader
          serviceName="Reschedule"
          serviceSubtitle="Unavailable"
          serviceIcon={Calendar}
          stats={[{ value: '—', label: 'Status' }]}
          onBack={onBack}
          showBackButton
        />
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <p className="text-gray-900 font-medium">Appointment not found</p>
          <button type="button" onClick={onBack} className="mt-4 text-[#FF8C42] font-medium">
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (rescheduling) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-customer mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-purple-200 border-t-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Rescheduling appointment…</p>
        </div>
      </div>
    );
  }

  const serviceType =
    appointment.serviceStyle === 'tele'
      ? 'tele'
      : appointment.serviceStyle === 'at_home'
        ? 'home'
        : 'clinic';

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-customer mx-auto">
      <ServiceDashboardHeader
        serviceName="Reschedule"
        serviceSubtitle={appointment.serviceName || 'Choose a new slot'}
        serviceIcon={Calendar}
        stats={[
          { value: appointment.vendorName || '📍', label: 'Provider' },
          { value: 'Slots', label: 'Next' },
        ]}
        onBack={onBack}
        showBackButton
      />
      <SmartTimeSlotSelection
        serviceType={serviceType}
        vendorName={appointment.vendorName || appointment.vendor_name || 'Clinic'}
        vendorId={appointment.vendorId}
        selectedService={{
          serviceName: appointment.serviceName,
          duration: appointment.duration,
        }}
        selectedStaffId={appointment.staffId}
        vendorRoleId={appointment.vendorRoleId}
        serviceStyle={
          appointment.serviceStyle === 'at_home' || appointment.serviceStyle === 'tele'
            ? appointment.serviceStyle
            : 'at_center'
        }
        onBack={onBack}
        onSelectSlot={handleReschedule}
      />
    </div>
  );
}
