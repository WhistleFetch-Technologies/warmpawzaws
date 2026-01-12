import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Sun, Sunset, Moon, Check } from 'lucide-react';

/**
 * ⏰ TIME WINDOW SCHEDULER
 * 
 * Phase 7C: Rule 2 - Home Services Enhancement
 * 
 * Features:
 * - Subscription package time window selection
 * - Morning (8-12), Afternoon (12-4), Evening (4-8)
 * - Recurring schedule management
 */

interface TimeWindow {
  name: 'morning' | 'afternoon' | 'evening';
  label: string;
  hours: string;
  icon: React.ReactNode;
}

interface TimeWindowSchedulerProps {
  customerId: string;
  serviceType: string;
  onScheduleCreated?: (subscriptionId: string) => void;
  apiUrl?: string;
}

export function TimeWindowScheduler({
  customerId,
  serviceType,
  onScheduleCreated,
  apiUrl = `${import.meta.env.VITE_API_URL}/make-server-3dd53475`,
}: TimeWindowSchedulerProps) {
  const [selectedWindow, setSelectedWindow] = useState<'morning' | 'afternoon' | 'evening'>('morning');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [selectedDays, setSelectedDays] = useState<string[]>(['monday', 'wednesday', 'friday']);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState(1); // months
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeWindows: TimeWindow[] = [
    {
      name: 'morning',
      label: 'Morning',
      hours: '8 AM - 12 PM',
      icon: <Sun className="w-6 h-6 text-yellow-500" />,
    },
    {
      name: 'afternoon',
      label: 'Afternoon',
      hours: '12 PM - 4 PM',
      icon: <Sunset className="w-6 h-6 text-orange-500" />,
    },
    {
      name: 'evening',
      label: 'Evening',
      hours: '4 PM - 8 PM',
      icon: <Moon className="w-6 h-6 text-indigo-500" />,
    },
  ];

  const weekDays = [
    { value: 'monday', label: 'Mon' },
    { value: 'tuesday', label: 'Tue' },
    { value: 'wednesday', label: 'Wed' },
    { value: 'thursday', label: 'Thu' },
    { value: 'friday', label: 'Fri' },
    { value: 'saturday', label: 'Sat' },
    { value: 'sunday', label: 'Sun' },
  ];

  const toggleDay = (day: string) => {
    setSelectedDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const calculateEndDate = () => {
    const start = new Date(startDate);
    start.setMonth(start.getMonth() + duration);
    return start.toISOString().split('T')[0];
  };

  const calculateTotalSessions = () => {
    if (frequency === 'daily') return duration * 30;
    if (frequency === 'weekly') return duration * 4 * selectedDays.length;
    return duration;
  };

  const handleCreateSchedule = async () => {
    try {
      setLoading(true);
      setError(null);

      const payload = {
        customerId,
        serviceType,
        timeWindow: selectedWindow,
        recurringSchedule: {
          frequency,
          days: frequency === 'weekly' ? selectedDays : undefined,
        },
        startDate,
        endDate: calculateEndDate(),
        totalSessions: calculateTotalSessions(),
      };

      const response = await fetch(`${apiUrl}/subscriptions/time-window/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to create schedule');
      }

      const data = await response.json();
      onScheduleCreated?.(data.data.subscription.subscriptionId);
    } catch (err: any) {
      console.error('Error creating schedule:', err);
      setError(err.message || 'Failed to create schedule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="mb-2">Schedule Your Service</h2>
        <p className="text-gray-600">
          Choose your preferred time window and frequency for {serviceType} services
        </p>
      </div>

      {/* Time Window Selection */}
      <div>
        <label className="block mb-3">
          <span className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            <span>Select Time Window</span>
          </span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {timeWindows.map(window => (
            <button
              key={window.name}
              onClick={() => setSelectedWindow(window.name)}
              className={`p-4 border-2 rounded-lg transition-all ${
                selectedWindow === window.name
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                {window.icon}
                <div className="text-center">
                  <div className="font-medium">{window.label}</div>
                  <div className="text-sm text-gray-600">{window.hours}</div>
                </div>
                {selectedWindow === window.name && (
                  <Check className="w-5 h-5 text-blue-600" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Frequency Selection */}
      <div>
        <label className="block mb-3">
          <span className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            <span>Frequency</span>
          </span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {['daily', 'weekly', 'monthly'].map(freq => (
            <button
              key={freq}
              onClick={() => setFrequency(freq as any)}
              className={`p-3 border-2 rounded-lg capitalize transition-all ${
                frequency === freq
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {freq}
            </button>
          ))}
        </div>
      </div>

      {/* Day Selection (for weekly) */}
      {frequency === 'weekly' && (
        <div>
          <label className="block mb-3">Select Days</label>
          <div className="flex gap-2">
            {weekDays.map(day => (
              <button
                key={day.value}
                onClick={() => toggleDay(day.value)}
                className={`flex-1 py-2 px-3 border-2 rounded-lg transition-all ${
                  selectedDays.includes(day.value)
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Date & Duration */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block mb-2">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full p-3 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block mb-2">Duration (months)</label>
          <input
            type="number"
            value={duration}
            onChange={e => setDuration(parseInt(e.target.value))}
            min={1}
            max={12}
            className="w-full p-3 border border-gray-300 rounded-lg"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="mb-3">Schedule Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Time Window:</span>
            <span className="font-medium capitalize">{selectedWindow}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Frequency:</span>
            <span className="font-medium capitalize">{frequency}</span>
          </div>
          {frequency === 'weekly' && (
            <div className="flex justify-between">
              <span className="text-gray-600">Days:</span>
              <span className="font-medium">{selectedDays.length} selected</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">Period:</span>
            <span className="font-medium">
              {startDate} to {calculateEndDate()}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-300">
            <span className="text-gray-600">Total Sessions:</span>
            <span className="font-medium text-blue-600">
              ~{calculateTotalSessions()} sessions
            </span>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Create Button */}
      <button
        onClick={handleCreateSchedule}
        disabled={loading || (frequency === 'weekly' && selectedDays.length === 0)}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Creating Schedule...' : 'Create Schedule'}
      </button>
    </div>
  );
}
