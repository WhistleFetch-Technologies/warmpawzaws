import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Clock, ChevronRight, AlertCircle } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface VetTimeSlotSelectionProps {
  serviceType: string;
  vendorName: string;
  vendorId: string;
  serviceStyle: string;
  selectedService?: any; // Service object with duration info
  selectedStaffId?: string; // Optional specific staff/doctor
  onBack: () => void;
  onSelectSlot: (date: string, time: string) => void;
}

export function VetTimeSlotSelection({ serviceType, vendorName, vendorId, serviceStyle, selectedService, selectedStaffId, onBack, onSelectSlot }: VetTimeSlotSelectionProps) {
  console.log('🚀 VetTimeSlotSelection MOUNTED with props:', {
    serviceType,
    vendorName,
    vendorId,
    serviceStyle
  });

  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [vendorOffline, setVendorOffline] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  // Generate next 7 days
  const getNextDays = () => {
    const days = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      days.push({
        date: date.toISOString().split('T')[0],
        dayName: date.toLocaleDateString('en-IN', { weekday: 'short' }),
        dayNum: date.getDate(),
        month: date.toLocaleDateString('en-IN', { month: 'short' }),
        isToday: i === 0
      });
    }
    return days;
  };

  const days = getNextDays();

  // Fetch available slots when date is selected
  useEffect(() => {
    if (selectedDate && vendorId) {
      fetchAvailableSlots();
    }
  }, [selectedDate, vendorId]);

  const fetchAvailableSlots = async () => {
    try {
      setLoading(true);
      setVendorOffline(false);
      
      console.log('🎯 Fetching slots for customer:');
      console.log('  - vendorId:', vendorId);
      console.log('  - date:', selectedDate);
      console.log('  - serviceStyle:', serviceStyle);
      
      const res = await fetch(
        `${API_BASE}/vendor/${vendorId}/available-slots?date=${selectedDate}&serviceStyle=${serviceStyle}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      console.log('📡 Response status:', res.status);

      if (res.ok) {
        const data = await res.json();
        console.log('📊 API Response:', data);
        
        if (!data.available) {
          console.log('❌ Vendor not available');
          setVendorOffline(true);
          setAvailableSlots([]);
          return;
        }

        console.log('✅ Slots received:', data.slots);
        // Convert slots to simple time format
        const slots = data.slots.map((slot: string) => slot.split(' - ')[0]);
        console.log('✅ Processed slots:', slots);
        setAvailableSlots(slots);
      } else {
        console.error('❌ Failed to fetch available slots, status:', res.status);
        const errorText = await res.text();
        console.error('Error response:', errorText);
        // Fallback to default slots
        setAvailableSlots(getDefaultTimeSlots());
      }
    } catch (error) {
      console.error('❌ Error fetching available slots:', error);
      // Fallback to default slots
      setAvailableSlots(getDefaultTimeSlots());
    } finally {
      setLoading(false);
    }
  };

  // Default slots as fallback
  const getDefaultTimeSlots = () => {
    return [
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
      '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
      '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'
    ];
  };

  // Organize slots into time periods
  const getTimeSlots = () => {
    if (!availableSlots || availableSlots.length === 0) {
      return { morning: [], afternoon: [], evening: [] };
    }

    const morning = availableSlots.filter(slot => {
      const hour = parseInt(slot.split(':')[0]);
      return hour >= 6 && hour < 12;
    });

    const afternoon = availableSlots.filter(slot => {
      const hour = parseInt(slot.split(':')[0]);
      return hour >= 12 && hour < 16;
    });

    const evening = availableSlots.filter(slot => {
      const hour = parseInt(slot.split(':')[0]);
      return hour >= 16 && hour < 22;
    });

    return { morning, afternoon, evening };
  };

  const timeSlots = getTimeSlots();

  const handleContinue = () => {
    if (!selectedDate || !selectedTime) {
      alert('Please select date and time');
      return;
    }
    onSelectSlot(selectedDate, selectedTime);
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
  };

  const getServiceTypeIcon = () => {
    switch (serviceType) {
      case 'tele': return '📹';
      case 'clinic': return '🏥';
      case 'home': return '🏠';
      case 'lab': return '🧪';
      default: return '📅';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#FF8C42] to-[#FF7029] text-white px-6 pt-8 pb-6 sticky top-0 z-10">
        <button onClick={onBack} className="mb-4 flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">Select Date & Time</h1>
            <p className="text-white/80 text-sm">{vendorName}</p>
          </div>
          <div className="text-3xl">{getServiceTypeIcon()}</div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Date Selection */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#FF8C42]" />
            Select Date
          </h3>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
            {days.map((day) => (
              <button
                key={day.date}
                onClick={() => {
                  console.log('📅 Date selected:', day.date);
                  setSelectedDate(day.date);
                }}
                className={`flex-shrink-0 w-20 p-3 rounded-xl border-2 transition-all ${
                  selectedDate === day.date
                    ? 'border-[#FF8C42] bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="text-center">
                  {day.isToday && (
                    <div className="text-[10px] font-semibold text-[#FF8C42] mb-1">TODAY</div>
                  )}
                  <div className={`text-xs font-medium ${selectedDate === day.date ? 'text-[#FF8C42]' : 'text-gray-500'}`}>
                    {day.dayName}
                  </div>
                  <div className={`text-2xl font-bold ${selectedDate === day.date ? 'text-[#FF8C42]' : 'text-gray-900'}`}>
                    {day.dayNum}
                  </div>
                  <div className={`text-xs ${selectedDate === day.date ? 'text-[#FF8C42]' : 'text-gray-500'}`}>
                    {day.month}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Time Slots */}
        {selectedDate && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#FF8C42]" />
              Available Time Slots
            </h3>

            {/* Loading State */}
            {loading && (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-[#FF8C42] animate-spin mx-auto mb-3" />
                <p className="text-gray-600">Loading available slots...</p>
              </div>
            )}

            {/* Vendor Offline State */}
            {!loading && vendorOffline && (
              <div className="text-center py-12 bg-red-50 rounded-xl border-2 border-red-200">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <p className="font-semibold text-red-900 mb-1">Vendor Unavailable</p>
                <p className="text-sm text-red-700">This vendor is currently in vacation mode</p>
              </div>
            )}

            {/* No Slots Available */}
            {!loading && !vendorOffline && availableSlots.length === 0 && (
              <div className="text-center py-12 bg-orange-50 rounded-xl border-2 border-orange-200">
                <AlertCircle className="w-12 h-12 text-orange-500 mx-auto mb-3" />
                <p className="font-semibold text-orange-900 mb-1">No Slots Available</p>
                <p className="text-sm text-orange-700">Please select a different date</p>
              </div>
            )}

            {/* Available Slots */}
            {!loading && !vendorOffline && availableSlots.length > 0 && (
              <>
                {/* Morning Slots */}
                {timeSlots.morning.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-600 mb-2">☀️ Morning (6 AM - 12 PM)</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {timeSlots.morning.map((time) => (
                        <button
                          key={time}
                          onClick={() => setSelectedTime(time)}
                          className={`p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                            selectedTime === time
                              ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]'
                              : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                          }`}
                        >
                          {formatTime(time)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Afternoon Slots */}
                {timeSlots.afternoon.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-600 mb-2">🌤️ Afternoon (12 PM - 4 PM)</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {timeSlots.afternoon.map((time) => (
                        <button
                          key={time}
                          onClick={() => setSelectedTime(time)}
                          className={`p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                            selectedTime === time
                              ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]'
                              : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                          }`}
                        >
                          {formatTime(time)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Evening Slots */}
                {timeSlots.evening.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-600 mb-2">🌙 Evening (4 PM - 10 PM)</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {timeSlots.evening.map((time) => (
                        <button
                          key={time}
                          onClick={() => setSelectedTime(time)}
                          className={`p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                            selectedTime === time
                              ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]'
                              : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                          }`}
                        >
                          {formatTime(time)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Info Card */}
        {selectedDate && selectedTime && (
          <Card className="p-4 bg-blue-50 border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>📌 Note:</strong> Please arrive 10 minutes before your scheduled time for a smooth experience.
            </p>
          </Card>
        )}
      </div>

      {/* Continue Button */}
      {selectedDate && selectedTime && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 p-4 shadow-lg">
          <div className="mb-3 text-center">
            <p className="text-sm text-gray-600">Selected Slot</p>
            <p className="font-semibold text-gray-900">
              {new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })} at {formatTime(selectedTime)}
            </p>
          </div>
          <Button
            onClick={handleContinue}
            className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF7029] hover:from-[#FF7029] hover:to-[#FF8C42] h-12 text-base font-semibold"
          >
            Continue to Payment
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}