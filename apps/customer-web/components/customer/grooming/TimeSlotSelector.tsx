'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Clock, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface TimeSlotSelectorProps {
  vendorId: string;
  serviceDuration?: number;
  serviceStyle?: string;
  onBack: () => void;
  onSelect: (date: string, time: string) => void;
}

export function TimeSlotSelector({ 
  vendorId, 
  serviceDuration = 60, 
  serviceStyle = 'at_center', 
  onBack, 
  onSelect 
}: TimeSlotSelectorProps) {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(new Date());
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [vendorOffline, setVendorOffline] = useState(false);

  const getDatesForWeek = () => {
    const dates = [];
    const start = new Date(currentWeekStart);
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getDatesForWeek();

  useEffect(() => {
    const today = new Date();
    const todayStr = formatDate(today);
    setSelectedDate(todayStr);
  }, []);

  useEffect(() => {
    if (selectedDate && vendorId) {
      loadSlotsForDate(selectedDate);
    }
  }, [selectedDate, vendorId, serviceStyle]);

  const loadSlotsForDate = async (date: string) => {
    try {
      setLoadingSlots(true);
      setVendorOffline(false);

      // Customer available-slots: advanced schedule only (vendor_availability_v2), dynamic payload
      const params = new URLSearchParams({
        date,
        serviceStyle: serviceStyle || 'at_center',
        totalDuration: String(Math.max(15, serviceDuration || 30)),
      });
      const response = await apiClient.get<{
        success?: boolean;
        slots?: Array<{ time: string; available?: boolean; booked?: boolean; slotDuration?: number; bufferMinutes?: number; serviceStyles?: string[] } | string>;
        availabilityMeta?: Record<string, unknown>;
        message?: string;
        isOnline?: boolean;
        vendorOnline?: boolean;
      }>(`/customer/vendor/${vendorId}/available-slots?${params}`);

      const explicitOffline =
        response?.isOnline === false ||
        response?.vendorOnline === false;

      if (!response?.success || !response.slots?.length) {
        setVendorOffline(explicitOffline);
        setSlots([]);
        return;
      }

      // Normalize: slots are objects { time, available, ... } or legacy strings
      const normalizedSlots = (response.slots || []).map((s) =>
        typeof s === 'string' ? s.split(' - ')[0]?.trim() || s : (s as { time: string }).time || ''
      ).filter(Boolean);
      setSlots(normalizedSlots);
    } catch (error) {
      console.error('Error loading slots:', error);
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDisplayDate = (date: Date): string => {
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    return date.toLocaleDateString('en-US', options);
  };

  const getDayName = (date: Date): string => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const handleContinue = () => {
    if (selectedDate && selectedTime) {
      onSelect(selectedDate, selectedTime);
    }
  };

  const goToPreviousWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() - 7);
    setCurrentWeekStart(newStart);
  };

  const goToNextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + 7);
    setCurrentWeekStart(newStart);
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-customer mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-0 py-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">Select Time Slot</h1>
      </div>

      {/* Content */}
      <div className="px-0 py-0 space-y-6">
        {/* Week Navigation */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={goToPreviousWeek}
              className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="font-semibold text-gray-900">
              {formatDisplayDate(weekDates[0])} - {formatDisplayDate(weekDates[6])}
            </h3>
            <button
              onClick={goToNextWeek}
              className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Date Picker */}
          <div className="grid grid-cols-7 gap-3">
            {weekDates.map((date) => {
              const dateStr = formatDate(date);
              const isSelected = selectedDate === dateStr;
              const isTodayDate = isToday(date);

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`p-0 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-primary bg-orange-50'
                      : 'border-gray-200 hover:border-primary'
                  }`}
                >
                  <div className="text-xs text-gray-600 mb-0">{getDayName(date)}</div>
                  <div className={`text-lg font-semibold ${
                    isSelected ? 'text-primary' : 'text-gray-900'
                  }`}>
                    {date.getDate()}
                  </div>
                  {isTodayDate && (
                    <div className="w-1 h-1 bg-primary rounded-full mx-auto mt-0"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Slots */}
        <div className="bg-white rounded-2xl p-0 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-4">Available Time Slots</h3>
          
          {vendorOffline ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-0" />
              <p className="text-gray-600 font-medium">Vendor is offline</p>
              <p className="text-sm text-gray-500 mt-0">Please select another date</p>
            </div>
          ) : loadingSlots ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-0" />
              <p className="text-gray-600 font-medium">No slots available</p>
              <p className="text-sm text-gray-500 mt-0">Please select another date</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {slots.map((time) => {
                const isSelected = selectedTime === time;
                return (
                  <button
                    key={time}
                    onClick={() => setSelectedTime(time)}
                    className={`p-0 rounded-xl border-2 transition-all text-sm font-medium ${
                      isSelected
                        ? 'border-primary bg-orange-50 text-primary'
                        : 'border-gray-200 hover:border-primary text-gray-900'
                    }`}
                  >
                    {formatTime(time)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          disabled={!selectedDate || !selectedTime}
          className="w-full py-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

