'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import Image from 'next/image';
import { formatLocalDateYYYYMMDD } from '@/lib/local-calendar-date';

interface TimeSlot {
  time: string;
  available: boolean;
  price?: number;
}

interface CalendarSlotPickerProps {
  selectedDate?: string;
  onDateSelect: (date: string) => void;
  onTimeSlotSelect: (timeSlot: string) => void;
  availableSlots?: TimeSlot[];
  minDate?: string;
  maxDate?: string;
}

export function CalendarSlotPicker({
  selectedDate,
  onDateSelect,
  onTimeSlotSelect,
  availableSlots = [],
  minDate,
  maxDate
}: CalendarSlotPickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDateState, setSelectedDateState] = useState<string>(selectedDate || '');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');

  const today = new Date();
  const minDateObj = minDate ? new Date(minDate) : today;
  const maxDateObj = maxDate ? new Date(maxDate) : new Date(today.getFullYear(), today.getMonth() + 3);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const isDateAvailable = (date: Date) => {
    return date >= minDateObj && date <= maxDateObj;
  };

  const isDateSelected = (date: Date) => {
    if (!selectedDateState) return false;
    const selected = new Date(selectedDateState);
    return date.toDateString() === selected.toDateString();
  };

  const isToday = (date: Date) => {
    return date.toDateString() === today.toDateString();
  };

  const handleDateClick = (date: Date) => {
    if (!isDateAvailable(date)) return;
    const dateStr = formatLocalDateYYYYMMDD(date);
    setSelectedDateState(dateStr);
    onDateSelect(dateStr);
  };

  const handleTimeSlotClick = (timeSlot: string) => {
    setSelectedTimeSlot(timeSlot);
    onTimeSlotSelect(timeSlot);
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const days = getDaysInMonth(currentMonth);

  const defaultTimeSlots: TimeSlot[] = [
    { time: '09:00', available: true },
    { time: '10:00', available: true },
    { time: '11:00', available: true },
    { time: '12:00', available: true },
    { time: '14:00', available: true },
    { time: '15:00', available: true },
    { time: '16:00', available: true },
    { time: '17:00', available: true },
    { time: '18:00', available: true }
  ];

  const timeSlots = availableSlots.length > 0 ? availableSlots : defaultTimeSlots;

  return (
    <div className="space-y-6">
      {/* Calendar */}
      <div className="bg-white rounded-2xl p-0 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="font-bold text-gray-900">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h3>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Day Names */}
        <div className="grid grid-cols-7 gap-3 mb-0">
          {dayNames.map((day) => (
            <div key={day} className="text-center text-xs font-semibold text-gray-600 py-0">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-3">
          {days.map((date, idx) => {
            if (!date) {
              return <div key={idx} className="aspect-square" />;
            }

            const available = isDateAvailable(date);
            const selected = isDateSelected(date);
            const isTodayDate = isToday(date);

            return (
              <button
                key={idx}
                onClick={() => handleDateClick(date)}
                disabled={!available}
                className={`aspect-square rounded-xl font-semibold transition-all ${
                  selected
                    ? 'bg-primary text-white'
                    : available
                    ? isTodayDate
                      ? 'bg-orange-50 text-primary border-2 border-primary'
                      : 'bg-gray-50 text-gray-900 hover:bg-gray-100'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Slots */}
      {selectedDateState && (
        <div className="bg-white rounded-2xl p-0 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-3">
            <Clock className="w-5 h-5" />
            Available Time Slots
          </h3>
          <p className="text-xs text-gray-500 mb-2">Select next closest time</p>
          <div className="grid grid-cols-3 gap-3">
            {timeSlots.map((slot) => (
              <button
                key={slot.time}
                onClick={() => slot.available && handleTimeSlotClick(slot.time)}
                disabled={!slot.available}
                className={`px-4 py-0 rounded-xl font-medium transition-all ${
                  selectedTimeSlot === slot.time
                    ? 'bg-primary text-white'
                    : slot.available
                    ? 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                }`}
              >
                {slot.time}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

