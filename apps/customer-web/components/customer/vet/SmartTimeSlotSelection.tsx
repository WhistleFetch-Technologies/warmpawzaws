'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import {
  buildDefaultSlotsWithPastGuard,
  formatIstDateYYYYMMDD,
  normalizeAvailableSlotsResponse,
  type NormalizedTimeSlot,
} from '@/lib/available-slots-response';

interface SmartTimeSlotSelectionProps {
  serviceType: string;
  vendorName: string;
  vendorId: string;
  selectedService?: {
    serviceName: string;
    duration?: number;
  };
  selectedStaffId?: string;
  vendorRoleId?: string;
  /** at_home | at_center | tele — must match backend service_styles for slot filtering */
  serviceStyle?: string;
  onBack: () => void;
  onSelectSlot: (date: string, time: string) => void;
}

function normalizeServiceStyle(style: string | undefined): 'at_home' | 'at_center' | 'tele' {
  const s = (style || '').toLowerCase();
  if (s === 'at_home' || s === 'tele') return s;
  return 'at_center';
}

function addCalendarDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  base.setUTCDate(base.getUTCDate() + delta);
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}-${String(base.getUTCDate()).padStart(2, '0')}`;
}

export function SmartTimeSlotSelection({
  serviceType,
  vendorName,
  vendorId,
  selectedService,
  selectedStaffId,
  vendorRoleId,
  serviceStyle: serviceStyleProp,
  onBack,
  onSelectSlot
}: SmartTimeSlotSelectionProps) {
  const formatTime12Hour = (time24: string) => {
    if (!time24) return '';
    const [hRaw, mRaw = '00'] = String(time24).split(':');
    const hour = Number(hRaw);
    const minute = String(mRaw).slice(0, 2);
    if (Number.isNaN(hour)) return time24;
    if (hour === 0) return `12:${minute} AM`;
    if (hour === 12) return `12:${minute} PM`;
    if (hour < 12) return `${hour}:${minute} AM`;
    return `${hour - 12}:${minute} PM`;
  };

  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [slots, setSlots] = useState<NormalizedTimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const serviceStyle = normalizeServiceStyle(serviceStyleProp ?? serviceType);
  const totalDuration = Math.max(15, selectedService?.duration ?? 30);

  useEffect(() => {
    if (selectedDate) {
      loadAvailableSlots(selectedDate);
    }
  }, [selectedDate, vendorId, selectedStaffId, serviceStyle, totalDuration]);

  const loadAvailableSlots = async (date: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        date,
        serviceStyle,
        totalDuration: String(totalDuration),
      });
      if (selectedStaffId) params.set('staffId', selectedStaffId);
      const data = await apiClient.get<{ slots?: Array<{ time: string; available?: boolean; booked?: boolean }> }>(
        `/customer/vendor/${vendorId}/available-slots?${params}`
      );
      const { slots: normalized, success } = normalizeAvailableSlotsResponse(data, date);
      if (!success || normalized.length === 0) {
        setSlots(buildDefaultSlotsWithPastGuard(date));
      } else {
        setSlots(normalized);
      }
    } catch (error) {
      console.error('Error loading available slots:', error);
      setSlots(buildDefaultSlotsWithPastGuard(date));
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSelectedTime('');
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    if (selectedDate) {
      onSelectSlot(selectedDate, time);
    }
  };

  const generateDates = () => {
    const todayYmd = formatIstDateYYYYMMDD();
    const dates = [];
    for (let i = 0; i < 30; i++) {
      const date = addCalendarDaysYmd(todayYmd, i);
      const [y, m, d] = date.split('-').map(Number);
      const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      dates.push({
        date,
        label:
          i === 0
            ? 'Today'
            : i === 1
              ? 'Tomorrow'
              : dateObj.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  timeZone: 'UTC',
                }),
      });
    }
    return dates;
  };

  const dates = generateDates();

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-customer mx-auto">
      <div className="bg-white sticky top-0 z-10 p-4 border-b flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold">Select Time Slot</h1>
          <p className="text-xs text-gray-500 mb-2">Select next closest time</p>
          <p className="text-sm text-gray-500">{vendorName}</p>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {selectedService && (
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="font-semibold text-gray-900">{selectedService.serviceName}</p>
            {selectedService.duration && (
              <p className="text-sm text-gray-600 mt-1">
                Duration: {selectedService.duration} minutes
              </p>
            )}
          </div>
        )}

        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[#FF8C42] rounded-lg flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-orange-900 mb-1">
                {vendorName} Booking Info
              </h3>
              <p className="text-xs text-orange-700">Review the scheduling policy before booking</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Select Date
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {dates.map(({ date, label }) => (
              <button
                key={date}
                onClick={() => handleDateSelect(date)}
                className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                  selectedDate === date
                    ? 'bg-[#FF8C42] text-white border-[#FF8C42]'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-[#FF8C42]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {selectedDate && (
          <div>
            <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Select Time
            </h2>
            <p className="text-xs text-gray-500 mb-2">Select next closest time</p>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42] mx-auto"></div>
                <p className="text-gray-500 mt-2">Loading available slots...</p>
              </div>
            ) : slots.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">No slots available</div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot) => {
                  const isSelected = selectedTime === slot.time;
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      disabled={!slot.available}
                      onClick={() => slot.available && handleTimeSelect(slot.time)}
                      className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-[#FF8C42] text-white border-[#FF8C42]'
                          : slot.available
                            ? 'bg-white text-gray-700 border-gray-300 hover:border-[#FF8C42]'
                            : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-50'
                      }`}
                    >
                      {formatTime12Hour(slot.time)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
