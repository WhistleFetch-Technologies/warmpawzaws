'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

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
  onBack: () => void;
  onSelectSlot: (date: string, time: string) => void;
}

export function SmartTimeSlotSelection({
  serviceType,
  vendorName,
  vendorId,
  selectedService,
  selectedStaffId,
  vendorRoleId,
  onBack,
  onSelectSlot
}: SmartTimeSlotSelectionProps) {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedDate) {
      loadAvailableSlots(selectedDate);
    }
  }, [selectedDate, vendorId, selectedStaffId]);

  const loadAvailableSlots = async (date: string) => {
    setLoading(true);
    try {
      const data = await apiClient.get<{ slots?: string[] }>(
        `/vendor/${vendorId}/availability?date=${date}&staffId=${selectedStaffId || ''}`
      );
      setAvailableSlots(data.slots || []);
    } catch (error) {
      console.error('Error loading available slots:', error);
      setAvailableSlots([]);
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

  // Generate dates for the next 30 days
  const generateDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push({
        date: date.toISOString().split('T')[0],
        label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      });
    }
    return dates;
  };

  const dates = generateDates();
  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00'
  ];

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      <div className="bg-white sticky top-0 z-10 p-4 border-b flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">Select Time Slot</h1>
          <p className="text-sm text-gray-500">{vendorName}</p>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Selected Service Info */}
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

        {/* Date Selection */}
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

        {/* Time Slot Selection */}
        {selectedDate && (
          <div>
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Select Time
            </h2>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42] mx-auto"></div>
                <p className="text-gray-500 mt-2">Loading available slots...</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {timeSlots.map((time) => {
                  const isAvailable = availableSlots.length === 0 || availableSlots.includes(time);
                  const isSelected = selectedTime === time;
                  return (
                    <button
                      key={time}
                      onClick={() => isAvailable && handleTimeSelect(time)}
                      disabled={!isAvailable}
                      className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-[#FF8C42] text-white border-[#FF8C42]'
                          : isAvailable
                          ? 'bg-white text-gray-700 border-gray-300 hover:border-[#FF8C42]'
                          : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      }`}
                    >
                      {time}
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
