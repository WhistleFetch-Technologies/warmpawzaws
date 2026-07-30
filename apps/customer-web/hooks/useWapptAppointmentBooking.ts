'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  WAPPT_APPOINTMENT_SERVICE_ID,
  WAPPT_DEFAULT_SLOT_DURATION_MIN,
  getWarmpawzAppointmentServiceLabel,
} from '@/lib/warmpawz-appointments-customer';
import { getWapptDiscoveryCategory } from '@/lib/wappt-hub-registry';

export type WapptVendorServiceShape = {
  id: string;
  serviceId: string;
  service_id: string;
  name: string;
  price: number;
  duration: number;
  serviceStyle?: string;
};

export function useWapptAppointmentBooking(opts: {
  appointmentsMode: boolean;
  vendorId?: string;
  category?: string;
  serviceStyle?: string;
  serviceType?: string;
  initialPrice?: number | null;
}) {
  const {
    appointmentsMode,
    vendorId,
    category = 'grooming',
    serviceStyle,
    serviceType,
    initialPrice,
  } = opts;

  const wapptCategory = getWapptDiscoveryCategory(category);
  const style = serviceStyle || serviceType || 'at_center';

  const [appointmentFee, setAppointmentFee] = useState<number | null>(
    appointmentsMode && initialPrice != null ? Number(initialPrice) : null,
  );

  const [selectedVendorService, setSelectedVendorService] = useState<WapptVendorServiceShape | null>(
    appointmentsMode
      ? {
          id: WAPPT_APPOINTMENT_SERVICE_ID,
          serviceId: WAPPT_APPOINTMENT_SERVICE_ID,
          service_id: WAPPT_APPOINTMENT_SERVICE_ID,
          name: getWarmpawzAppointmentServiceLabel({ category: wapptCategory, serviceStyle: style }),
          price: initialPrice ?? 0,
          duration: WAPPT_DEFAULT_SLOT_DURATION_MIN,
          serviceStyle: style,
        }
      : null,
  );

  useEffect(() => {
    if (!appointmentsMode || !vendorId) return;
    let cancelled = false;
    const qs = new URLSearchParams({
      category: wapptCategory,
      serviceStyle: style,
    });
    void apiClient
      .get<{ appointmentFee?: number }>(
        `/customer/warmpawz-appointments/vendors/${encodeURIComponent(String(vendorId))}/fee?${qs}`,
      )
      .then((res) => {
        if (cancelled) return;
        const fee = Number(res?.appointmentFee ?? 0);
        setAppointmentFee(fee > 0 ? fee : null);
        setSelectedVendorService({
          id: WAPPT_APPOINTMENT_SERVICE_ID,
          serviceId: WAPPT_APPOINTMENT_SERVICE_ID,
          service_id: WAPPT_APPOINTMENT_SERVICE_ID,
          name: getWarmpawzAppointmentServiceLabel({ category: wapptCategory, serviceStyle: style }),
          price: fee > 0 ? fee : initialPrice ?? 0,
          duration: WAPPT_DEFAULT_SLOT_DURATION_MIN,
          serviceStyle: style,
        });
      })
      .catch(() => {
        if (!cancelled) setAppointmentFee(null);
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentsMode, vendorId, wapptCategory, style, initialPrice]);

  return {
    appointmentFee,
    selectedVendorService,
    wapptCategory,
    wapptServiceId: WAPPT_APPOINTMENT_SERVICE_ID,
  };
}
