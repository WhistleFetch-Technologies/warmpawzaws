/**
 * SUBSCRIPTION PACKAGE SCHEDULE SELECTOR
 * Production-Grade Component
 * 
 * Features:
 * - General time slots for packages (Morning, Afternoon, Evening)
 * - Preferred days selection
 * - Recurring schedule configuration
 * - Responsive UI
 */

import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Clock, Calendar, Check } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface SubscriptionPackageScheduleSelectorProps {
  vendorId: string;
  staffId?: string;
  packageId?: string;
  isPackage: boolean;
  serviceStyle: 'at_home' | 'at_center' | 'tele';
  customerLocation?: { lat: number; lng: number };
  serviceDuration?: number;
  onSelect: (schedule: PackageSchedule) => void;
  onBack: () => void;
}

interface PackageSchedule {
  timeWindow?: 'morning' | 'afternoon' | 'evening';
  time?: string;
  preferredDays: string[];
  startDate: string;
  endDate?: string;
  totalSessions?: number;
}

interface TimeSlot {
  timeWindow?: 'morning' | 'afternoon' | 'evening';
  time?: string;
  available: boolean;
  capacity: number;
  booked: number;
  distance?: number;
  estimatedTravelTime?: number;
}

const TIME_WINDOWS = {
  morning: { label: 'Morning', start: '08:00', end: '12:00', icon: '🌅' },
  afternoon: { label: 'Afternoon', start: '12:00', end: '16:00', icon: '☀️' },
  evening: { label: 'Evening', start: '16:00', end: '20:00', icon: '🌆' }
};

const DAYS = [
  { id: 'monday', label: 'Mon' },
  { id: 'tuesday', label: 'Tue' },
  { id: 'wednesday', label: 'Wed' },
  { id: 'thursday', label: 'Thu' },
  { id: 'friday', label: 'Fri' },
  { id: 'saturday', label: 'Sat' },
  { id: 'sunday', label: 'Sun' }
];

export function SubscriptionPackageScheduleSelector({
  vendorId,
  staffId,
  packageId,
  isPackage,
  serviceStyle,
  customerLocation,
  serviceDuration = 60,
  onSelect,
  onBack
}: SubscriptionPackageScheduleSelectorProps) {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTimeWindow, setSelectedTimeWindow] = useState<'morning' | 'afternoon' | 'evening' | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [endDate, setEndDate] = useState('');

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(tomorrow.toISOString().split('T')[0]);

    // Set default end date to 30 days from start
    const end = new Date(tomorrow);
    end.setDate(end.getDate() + 30);
    setEndDate(end.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (selectedDate) {
      loadSlots();
    }
  }, [selectedDate, vendorId, staffId, isPackage, serviceStyle]);

  const loadSlots = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        vendorId,
        isPackage: isPackage.toString(),
        serviceStyle,
        serviceDuration: serviceDuration.toString(),
        date: selectedDate
      });

      if (staffId) params.append('staffId', staffId);
      if (customerLocation) {
        params.append('customerLat', customerLocation.lat.toString());
        params.append('customerLng', customerLocation.lng.toString());
      }

      const response = await fetch(
        `${API_BASE}/booking/subscription-slots?${params.toString()}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          if (isPackage) {
            // For packages: slots are time windows
            const windowSlots = Object.entries(data.slots || {}).map(([key, slot]: [string, any]) => ({
              ...slot,
              timeWindow: key as 'morning' | 'afternoon' | 'evening'
            }));
            setSlots(windowSlots);
          } else {
            // For single sessions: slots are specific times
            setSlots(data.slots || []);
          }
        }
      }
    } catch (error) {
      console.error('Error loading slots:', error);
      toast.error('Failed to load available slots');
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (dayId: string) => {
    setSelectedDays(prev =>
      prev.includes(dayId)
        ? prev.filter(d => d !== dayId)
        : [...prev, dayId]
    );
  };

  const handleContinue = () => {
    if (isPackage) {
      if (!selectedTimeWindow || selectedDays.length === 0) {
        toast.error('Please select a time window and preferred days');
        return;
      }
      onSelect({
        timeWindow: selectedTimeWindow,
        preferredDays: selectedDays,
        startDate: selectedDate,
        endDate,
        totalSessions: undefined
      });
    } else {
      if (!selectedTime) {
        toast.error('Please select a time slot');
        return;
      }
      onSelect({
        time: selectedTime,
        preferredDays: [],
        startDate: selectedDate
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {isPackage ? 'Select Package Schedule' : 'Select Time Slot'}
            </h1>
            <p className="text-sm text-gray-500">
              {isPackage ? 'Choose time window and preferred days' : 'Choose a specific time'}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Date Selection */}
        <Card className="p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="w-4 h-4 inline mr-2" />
            Start Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            min={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
          />
        </Card>

        {isPackage && (
          <Card className="p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date (Optional)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={selectedDate}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
            />
          </Card>
        )}

        {/* Time Slots */}
        {loading ? (
          <Card className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42] mx-auto"></div>
            <p className="mt-4 text-sm text-gray-600">Loading available slots...</p>
          </Card>
        ) : (
          <>
            {isPackage ? (
              // Package: Time Windows
              <Card className="p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  <Clock className="w-4 h-4 inline mr-2" />
                  Select Time Window
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {Object.entries(TIME_WINDOWS).map(([key, window]) => {
                    const slot = slots.find(s => s.timeWindow === key);
                    const isSelected = selectedTimeWindow === key;
                    const isAvailable = slot?.available !== false;

                    return (
                      <button
                        key={key}
                        onClick={() => isAvailable && setSelectedTimeWindow(key as any)}
                        disabled={!isAvailable}
                        className={`p-4 rounded-lg border-2 text-left transition-all ${
                          isSelected
                            ? 'border-[#FF8C42] bg-orange-50'
                            : isAvailable
                            ? 'border-gray-200 hover:border-[#FF8C42] bg-white'
                            : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{window.icon}</span>
                            <div>
                              <div className="font-medium text-gray-900">{window.label}</div>
                              <div className="text-xs text-gray-500">{window.start} - {window.end}</div>
                            </div>
                          </div>
                          {isSelected && <Check className="w-5 h-5 text-[#FF8C42]" />}
                        </div>
                        {slot && (
                          <div className="mt-2 text-xs text-gray-600">
                            {slot.booked}/{slot.capacity} booked
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Card>
            ) : (
              // Single Session: Specific Times
              <Card className="p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  <Clock className="w-4 h-4 inline mr-2" />
                  Available Time Slots
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {slots.map((slot, index) => {
                    const isSelected = selectedTime === slot.time;
                    return (
                      <button
                        key={index}
                        onClick={() => slot.available && setSelectedTime(slot.time || null)}
                        disabled={!slot.available}
                        className={`p-3 rounded-lg border text-sm transition-all ${
                          isSelected
                            ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42] font-medium'
                            : slot.available
                            ? 'border-gray-200 hover:border-[#FF8C42] bg-white'
                            : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        {slot.time}
                      </button>
                    );
                  })}
                </div>
                {slots.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No available slots for this date</p>
                )}
              </Card>
            )}

            {/* Preferred Days (for packages) */}
            {isPackage && selectedTimeWindow && (
              <Card className="p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Preferred Days
                </h3>
                <div className="grid grid-cols-7 gap-2">
                  {DAYS.map(day => {
                    const isSelected = selectedDays.includes(day.id);
                    return (
                      <button
                        key={day.id}
                        onClick={() => toggleDay(day.id)}
                        className={`p-2 rounded-lg border text-xs transition-all ${
                          isSelected
                            ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42] font-medium'
                            : 'border-gray-200 hover:border-[#FF8C42] bg-white'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
                {selectedDays.length === 0 && (
                  <p className="text-xs text-gray-500 mt-2">Select at least one day</p>
                )}
              </Card>
            )}
          </>
        )}

        {/* Continue Button */}
        <Button
          onClick={handleContinue}
          disabled={loading || (isPackage ? (!selectedTimeWindow || selectedDays.length === 0) : !selectedTime)}
          className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E] text-white py-3"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

