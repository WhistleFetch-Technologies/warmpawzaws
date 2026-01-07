'use client';

import React, { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Calendar, Clock, Save, Loader2 } from 'lucide-react';

interface VendorAvailabilitySetupProps {
  vendorId: string;
  onComplete: () => void;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, '0');
  return `${hour}:00`;
});

export function VendorAvailabilitySetup({ vendorId, onComplete }: VendorAvailabilitySetupProps) {
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState<Record<string, { start: string; end: string; enabled: boolean }>>(() => {
    const initial: Record<string, { start: string; end: string; enabled: boolean }> = {};
    DAYS_OF_WEEK.forEach(day => {
      initial[day] = { start: '09:00', end: '18:00', enabled: true };
    });
    return initial;
  });

  const handleDayToggle = (day: string) => {
    setAvailability(prev => ({
      ...prev,
      [day]: { ...prev[day], enabled: !prev[day].enabled },
    }));
  };

  const handleTimeChange = (day: string, field: 'start' | 'end', value: string) => {
    setAvailability(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const response = await apiClient.post<any>('/vendor/availability', {
        vendorId,
        availability,
      });

      if (response.success) {
        onComplete();
      } else {
        alert('Failed to save availability');
      }
    } catch (error) {
      console.error('Error saving availability:', error);
      alert('Error saving availability');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto p-4">
      <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Calendar className="w-6 h-6 text-orange-600" />
          <h1 className="text-xl font-bold text-gray-900">Set Your Availability</h1>
        </div>

        <p className="text-sm text-gray-600 mb-6">
          Configure when you're available to receive bookings. You can update this anytime from your dashboard.
        </p>

        <div className="space-y-4">
          {DAYS_OF_WEEK.map((day) => (
            <div key={day} className="border-2 border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={availability[day].enabled}
                    onChange={() => handleDayToggle(day)}
                    className="w-4 h-4 text-orange-600 rounded"
                  />
                  <span className="font-medium text-gray-900">{day}</span>
                </label>
              </div>

              {availability[day].enabled && (
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-600 mb-1">Start Time</label>
                    <select
                      value={availability[day].start}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleTimeChange(day, 'start', e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    >
                      {TIME_SLOTS.map(time => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
                  <div className="pt-6">
                    <Clock className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-600 mb-1">End Time</label>
                    <select
                      value={availability[day].end}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleTimeChange(day, 'end', e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    >
                      {TIME_SLOTS.map(time => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full mt-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Save Availability
            </>
          )}
        </button>
      </div>
    </div>
  );
}

