'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Calendar, Plus, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { getApiBaseUrl, getAuthHeaders } from '@/lib/api-config';

interface TimeSlot {
  start: string;
  end: string;
}

interface DayAvailability {
  enabled: boolean;
  slots: TimeSlot[];
}

interface VendorAvailabilitySetupProps {
  vendorId: string;
  onComplete: () => void;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function VendorAvailabilitySetup({ vendorId, onComplete }: VendorAvailabilitySetupProps) {
  const [everydayEnabled, setEverydayEnabled] = useState(false);
  const [availability, setAvailability] = useState<Record<string, DayAvailability>>({
    monday: { enabled: false, slots: [] },
    tuesday: { enabled: false, slots: [] },
    wednesday: { enabled: false, slots: [] },
    thursday: { enabled: false, slots: [] },
    friday: { enabled: false, slots: [] },
    saturday: { enabled: false, slots: [] },
    sunday: { enabled: false, slots: [] },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEverydayToggle = (checked: boolean) => {
    setEverydayEnabled(checked);
    if (checked) {
      // Enable all days with default slot
      const updatedAvailability: Record<string, DayAvailability> = {};
      DAYS.forEach(day => {
        const dayKey = day.toLowerCase();
        updatedAvailability[dayKey] = {
          enabled: true,
          slots: [{ start: '09:00', end: '18:00' }]
        };
      });
      setAvailability(updatedAvailability);
    }
  };

  const handleDayToggle = (day: string, checked: boolean) => {
    const dayKey = day.toLowerCase();
    setAvailability(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        enabled: checked,
        slots: checked && prev[dayKey].slots.length === 0 
          ? [{ start: '09:00', end: '18:00' }] 
          : prev[dayKey].slots
      }
    }));
    
    // If any day is disabled, turn off "everyday"
    if (!checked && everydayEnabled) {
      setEverydayEnabled(false);
    }
  };

  const handleAddTimeSlot = (day: string) => {
    const dayKey = day.toLowerCase();
    setAvailability(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        enabled: true,
        slots: [...prev[dayKey].slots, { start: '09:00', end: '18:00' }]
      }
    }));
  };

  const handleTimeChange = (day: string, slotIndex: number, field: 'start' | 'end', value: string) => {
    const dayKey = day.toLowerCase();
    setAvailability(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        slots: prev[dayKey].slots.map((slot, idx) => 
          idx === slotIndex ? { ...slot, [field]: value } : slot
        )
      }
    }));
  };

  const handleRemoveTimeSlot = (day: string, slotIndex: number) => {
    const dayKey = day.toLowerCase();
    setAvailability(prev => {
      const newSlots = prev[dayKey].slots.filter((_, idx) => idx !== slotIndex);
      return {
        ...prev,
        [dayKey]: {
          ...prev[dayKey],
          slots: newSlots,
          enabled: newSlots.length > 0
        }
      };
    });
  };

  const hasAnyAvailability = () => {
    return Object.values(availability).some(day => day.enabled && day.slots.length > 0);
  };

  const handleContinue = async () => {
    if (!hasAnyAvailability()) {
      alert('Please set at least one day with availability');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        vendorId,
        availability
      };
      
      const data = await apiClient.put(`/vendor/${vendorId}/availability`, { availability }) as any;

      if (!data || !data.success) {
        throw new Error(data?.error || 'Failed to save availability');
      }
      console.log('✅ Availability saved:', data);
      
      // Move to completion screen
      onComplete();
    } catch (error) {
      console.error('Error saving availability:', error);
      alert('Failed to save availability. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E8F5E3] flex items-center justify-center p-4">
      <div className="w-full max-w-[430px] bg-white rounded-3xl shadow-lg p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#FF8C42] rounded-full">
            <Calendar className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl text-gray-900">
            Set your Availability
          </h1>
          <p className="text-sm text-gray-600">
            Configure your working hours
          </p>
        </div>

        {/* Availability Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-orange-50 rounded-xl border border-orange-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FF8C42] rounded-full flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Availability</h3>
                <p className="text-xs text-gray-600">Everyday</p>
              </div>
            </div>
            <Switch
              checked={everydayEnabled}
              onCheckedChange={handleEverydayToggle}
            />
          </div>

          {/* Days List */}
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {DAYS.map(day => {
              const dayKey = day.toLowerCase();
              const dayData = availability[dayKey];
              
              return (
                <div key={day} className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-gray-400" />
                      <span className="font-medium text-gray-900">{day}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={dayData.enabled}
                        onCheckedChange={(checked) => handleDayToggle(day, checked)}
                      />
                      <button
                        onClick={() => handleAddTimeSlot(day)}
                        className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center hover:bg-orange-100 transition-colors"
                      >
                        <Plus className="w-4 h-4 text-[#FF8C42]" />
                      </button>
                    </div>
                  </div>

                  {/* Time Slots */}
                  {dayData.slots.length > 0 ? (
                    <div className="space-y-2 pl-8">
                      {dayData.slots.map((slot, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="time"
                            value={slot.start}
                            onChange={(e) => handleTimeChange(day, idx, 'start', e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                          <span className="text-gray-500">-</span>
                          <input
                            type="time"
                            value={slot.end}
                            onChange={(e) => handleTimeChange(day, idx, 'end', e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                          <button
                            onClick={() => handleRemoveTimeSlot(day, idx)}
                            className="text-red-500 hover:text-red-700 text-xs px-2"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 pl-8">
                      {dayData.enabled ? 'No time set yet' : 'No work in this day'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Warning Box */}
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-[#FF8C42] rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs">!</span>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">Setup Process</h4>
              <p className="text-xs text-gray-600">
                Please set availability for at least one day to continue
              </p>
            </div>
          </div>
        </div>

        {/* Continue Button */}
        <Button
          onClick={handleContinue}
          disabled={!hasAnyAvailability() || isSubmitting}
          className="w-full h-12 bg-[#FF8C42] hover:bg-[#ff7a28] text-white rounded-xl disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : 'Continue'}
        </Button>

        <p className="text-center text-xs text-gray-500">
          You can always modify your availability later from the dashboard
        </p>
      </div>
    </div>
  );
}
