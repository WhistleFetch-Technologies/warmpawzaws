import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Calendar, Clock, AlertCircle, Check, Loader2, Palmtree } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface CalendarSlotPickerProps {
  vendorId: string;
  onSlotSelected: (date: string, time: string) => void;
  serviceStyle?: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
  bookedCount: number;
  isPast: boolean;
}

export function CalendarSlotPicker({ vendorId, onSlotSelected, serviceStyle = 'at_center' }: CalendarSlotPickerProps) {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [onVacation, setOnVacation] = useState(false);
  const [vacationMessage, setVacationMessage] = useState('');
  const [dates, setDates] = useState<{ date: string; label: string; day: string }[]>([]);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    generateNext7Days();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchAvailableSlots(selectedDate);
    }
  }, [selectedDate, vendorId]);

  const generateNext7Days = () => {
    const daysArray = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      const dateStr = date.toISOString().split('T')[0];
      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      const day = date.toLocaleDateString('en-IN', { weekday: 'short' });
      
      daysArray.push({ date: dateStr, label, day });
    }
    
    setDates(daysArray);
    setSelectedDate(daysArray[0].date); // Auto-select today
  };

  const fetchAvailableSlots = async (date: string) => {
    try {
      setLoading(true);
      setOnVacation(false);
      setAvailableSlots([]);
      
      console.log(`📅 [CALENDAR] Fetching slots for ${vendorId} on ${date}`);
      
      const response = await fetch(
        `${API_BASE}/vendor/${vendorId}/slots/${date}?serviceStyle=${serviceStyle}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('📦 [CALENDAR] Slots response:', data);
        
        if (data.onVacation) {
          setOnVacation(true);
          setVacationMessage(data.vacationMessage || 'Vendor is on vacation');
          setAvailableSlots([]);
        } else {
          setAvailableSlots(data.slots || []);
        }
      } else {
        console.error('❌ [CALENDAR] Failed to fetch slots:', response.status);
      }
    } catch (error) {
      console.error('❌ [CALENDAR] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSlotClick = (time: string) => {
    setSelectedTime(time);
    onSlotSelected(selectedDate, time);
  };

  const availableCount = availableSlots.filter(s => s.available).length;

  return (
    <div className="space-y-4">
      {/* Date Selector */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Select Date</h3>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {dates.map((d) => (
            <button
              key={d.date}
              onClick={() => {
                setSelectedDate(d.date);
                setSelectedTime('');
              }}
              className={`flex-shrink-0 px-4 py-3 rounded-lg border-2 transition-all min-w-[80px] ${
                selectedDate === d.date
                  ? 'border-[#FF8C42] bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`text-xs ${selectedDate === d.date ? 'text-[#FF8C42]' : 'text-gray-500'}`}>
                {d.day}
              </div>
              <div className={`font-semibold ${selectedDate === d.date ? 'text-[#FF8C42]' : 'text-gray-900'}`}>
                {d.label}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Time Slots */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Select Time</h3>
          {!loading && !onVacation && (
            <span className="text-sm text-gray-500">
              {availableCount} slot{availableCount !== 1 ? 's' : ''} available
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#FF8C42] animate-spin" />
          </div>
        ) : onVacation ? (
          <Card className="p-6 text-center">
            <Palmtree className="w-12 h-12 text-orange-400 mx-auto mb-3" />
            <h4 className="font-semibold text-gray-900 mb-1">On Vacation</h4>
            <p className="text-sm text-gray-600">{vacationMessage}</p>
          </Card>
        ) : availableSlots.length === 0 ? (
          <Card className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h4 className="font-semibold text-gray-900 mb-1">No Slots Available</h4>
            <p className="text-sm text-gray-600">Please select another date</p>
          </Card>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {availableSlots.map((slot) => (
              <button
                key={slot.time}
                onClick={() => slot.available && handleSlotClick(slot.time)}
                disabled={!slot.available}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectedTime === slot.time
                    ? 'border-[#FF8C42] bg-orange-50'
                    : slot.available
                    ? 'border-gray-200 hover:border-gray-300'
                    : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-50'
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <Clock className={`w-3.5 h-3.5 ${
                    selectedTime === slot.time ? 'text-[#FF8C42]' : slot.available ? 'text-gray-600' : 'text-gray-400'
                  }`} />
                  <span className={`text-sm font-medium ${
                    selectedTime === slot.time ? 'text-[#FF8C42]' : slot.available ? 'text-gray-900' : 'text-gray-400'
                  }`}>
                    {slot.time}
                  </span>
                </div>
                {selectedTime === slot.time && (
                  <Check className="w-4 h-4 text-[#FF8C42] mx-auto mt-1" />
                )}
                {!slot.available && (
                  <span className="text-xs text-gray-400 block mt-1">Booked</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <Card className="p-3 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800">
            Slots shown are at least 30 minutes from current time. Already booked slots are marked unavailable.
          </p>
        </div>
      </Card>
    </div>
  );
}
