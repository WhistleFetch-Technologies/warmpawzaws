'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { normalizeAvailableSlotsResponse } from '@/lib/available-slots-response';
import { generateBookingDates } from '@/lib/wappt-booking-time';

export type WapptTimeSlot = {
  time: string;
  available: boolean;
};

export function useWapptBookingSlots(opts: {
  vendorId?: string;
  serviceStyle: string;
  serviceIds?: string;
  totalDurationMinutes: number;
  selectedDate: string;
  enabled?: boolean;
}) {
  const {
    vendorId,
    serviceStyle,
    serviceIds,
    totalDurationMinutes,
    selectedDate,
    enabled = true,
  } = opts;

  const [timeSlots, setTimeSlots] = useState<WapptTimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const dates = generateBookingDates();

  const loadTimeSlots = useCallback(
    async (date: string) => {
      if (!vendorId || !date) {
        setTimeSlots([]);
        return;
      }
      try {
        setLoadingSlots(true);
        const params = new URLSearchParams({
          date,
          serviceStyle,
          totalDuration: String(Math.max(15, totalDurationMinutes)),
        });
        if (serviceIds?.trim()) params.set('serviceIds', serviceIds.trim());
        const raw = await apiClient.get(
          `/customer/vendor/${vendorId}/available-slots?${params.toString()}`,
        );
        const { success, slots } = normalizeAvailableSlotsResponse(raw, date);
        if (success && slots.length > 0) {
          setTimeSlots(slots);
        } else {
          setTimeSlots([]);
        }
      } catch {
        setTimeSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    },
    [vendorId, serviceIds, serviceStyle, totalDurationMinutes],
  );

  useEffect(() => {
    if (!enabled || !selectedDate || !vendorId) {
      setTimeSlots([]);
      return;
    }
    void loadTimeSlots(selectedDate);
  }, [enabled, selectedDate, vendorId, loadTimeSlots]);

  return { dates, timeSlots, loadingSlots, loadTimeSlots };
}
