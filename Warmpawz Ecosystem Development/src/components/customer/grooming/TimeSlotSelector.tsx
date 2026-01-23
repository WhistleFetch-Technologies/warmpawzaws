import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { ArrowLeft, Calendar, Clock, ChevronLeft, ChevronRight, AlertCircle, Info, Building2, XCircle, CheckCircle2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface SchedulingPolicy {
  advanceBookingDays: number;
  cancellationHours: number;
  operatingHours: string;
  workingDays: string[];
  autoConfirm: boolean;
  maxBookingsPerSlot: number;
}

interface TimeSlotSelectorProps {
  vendorId: string;
  serviceDuration?: number; // Kept for display
  serviceStyle?: string;    // ✅ NEW: Required for V2 slots (default: 'at_center')
  vendorName?: string;      // ✅ NEW: For display
  onBack: () => void;
  onSelect: (date: string, time: string) => void;
}

export function TimeSlotSelector({ vendorId, serviceDuration = 60, serviceStyle = 'at_center', vendorName, onBack, onSelect }: TimeSlotSelectorProps) {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(new Date());
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [vendorOffline, setVendorOffline] = useState(false);
  const [showPolicy, setShowPolicy] = useState(true);
  
  // ✅ NEW: Scheduling policy state
  const [schedulingPolicy, setSchedulingPolicy] = useState<SchedulingPolicy>({
    advanceBookingDays: 7,
    cancellationHours: 4,
    operatingHours: 'Mon-Sat: 9:00 AM - 7:00 PM',
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    autoConfirm: true,
    maxBookingsPerSlot: 1
  });
  const [loadingPolicy, setLoadingPolicy] = useState(false);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;
  
  // ✅ NEW: Load vendor scheduling policy
  useEffect(() => {
    loadSchedulingPolicy();
  }, [vendorId]);
  
  const loadSchedulingPolicy = async () => {
    try {
      setLoadingPolicy(true);
      const response = await fetch(
        `${API_BASE}/vendor/${vendorId}/scheduling-policy`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.policy) {
          setSchedulingPolicy({
            advanceBookingDays: data.policy.advanceBookingDays || 7,
            cancellationHours: data.policy.cancellationHours || 4,
            operatingHours: data.policy.operatingHours || 'Mon-Sat: 9:00 AM - 7:00 PM',
            workingDays: data.policy.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
            autoConfirm: data.policy.autoConfirm !== false,
            maxBookingsPerSlot: data.policy.maxBookingsPerSlot || 1
          });
        }
      }
    } catch (error) {
      console.log('Using default scheduling policy');
    } finally {
      setLoadingPolicy(false);
    }
  };

  // Generate next 7 days
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
    // Auto-select today
    const today = new Date();
    const todayStr = formatDate(today);
    setSelectedDate(todayStr);
  }, []);

  // Load slots when date changes
  useEffect(() => {
    if (selectedDate && vendorId) {
      loadSlotsForDate(selectedDate);
    }
  }, [selectedDate, vendorId, serviceStyle]);

  const loadSlotsForDate = async (date: string) => {
    try {
      setLoadingSlots(true);
      setVendorOffline(false);
      
      console.log('🎯 [TIME-SLOTS] Fetching V2 slots:', { vendorId, date, serviceStyle });
      
      // ✅ USE UNIVERSAL V2 SCHEDULE ENDPOINT
      const response = await fetch(
        `${API_BASE}/vendor/${vendorId}/available-slots?date=${date}&serviceStyle=${serviceStyle}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [TIME-SLOTS] Loaded slots:', data);
        
        if (!data.available) {
          console.log('❌ Vendor offline');
          setVendorOffline(true);
          setSlots([]);
          return;
        }

        // The API returns strings like "09:00 - 10:00" or just "09:00"
        // We normalize to start time
        const normalizedSlots = (data.slots || []).map((s: string) => s.split(' - ')[0]);
        setSlots(normalizedSlots);
      } else {
        console.error('❌ [TIME-SLOTS] Failed to fetch slots:', response.status);
        setSlots([]);
      }
    } catch (error) {
      console.error('❌ [TIME-SLOTS] Error loading slots:', error);
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

  const TimeSlotButton = ({ time }: { time: string }) => {
    const isSelected = selectedTime === time;
    return (
      <button
        onClick={() => setSelectedTime(time)}
        className={`p-3 rounded-lg border transition-all text-sm ${
          isSelected
            ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42] font-semibold'
            : 'border-gray-200 hover:border-[#FF8C42] bg-white text-gray-900'
        }`}
      >
        <div>{formatTime(time)}</div>
      </button>
    );
  };

  // Group slots by time period
  const categorizeSlotByTime = (timeString: string): string => {
    const hour = parseInt(timeString.split(':')[0]);
    if (hour < 12) return 'morning';
    if (hour < 16) return 'afternoon';
    return 'evening';
  };

  const morningSlots = slots.filter(s => categorizeSlotByTime(s) === 'morning');
  const afternoonSlots = slots.filter(s => categorizeSlotByTime(s) === 'afternoon');
  const eveningSlots = slots.filter(s => categorizeSlotByTime(s) === 'evening');

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#FF8C42] to-[#FF7029] text-white px-6 pt-8 pb-6 sticky top-0 z-10">
        <button 
          onClick={onBack}
          className="mb-4 flex items-center gap-2 text-white/90 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        
        <div className="flex items-center gap-3 mb-2">
          <Calendar className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Select Date & Time</h1>
        </div>
        <p className="text-white/80 text-sm">Choose a convenient slot</p>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        {/* ✅ NEW: Scheduling Policy Info Card */}
        {showPolicy && (
          <Card className="p-4 mb-6 bg-blue-50 border-blue-200 relative">
            <button
              onClick={() => setShowPolicy(false)}
              className="absolute top-2 right-2 p-1 hover:bg-blue-100 rounded-full transition-colors"
            >
              <XCircle className="w-4 h-4 text-blue-400" />
            </button>
            
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">
                  {vendorName || 'Center'} Booking Info
                </h3>
                <p className="text-xs text-blue-700">Review the scheduling policy before booking</p>
              </div>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-blue-800">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="font-medium">Operating Hours:</span>
                <span>{schedulingPolicy.operatingHours}</span>
              </div>
              
              <div className="flex items-center gap-2 text-blue-800">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="font-medium">Advance Booking:</span>
                <span>Up to {schedulingPolicy.advanceBookingDays} days ahead</span>
              </div>
              
              <div className="flex items-center gap-2 text-blue-800">
                <Info className="w-4 h-4 text-blue-600" />
                <span className="font-medium">Cancellation:</span>
                <span>Free up to {schedulingPolicy.cancellationHours} hours before</span>
              </div>
              
              <div className="flex items-center gap-2 text-blue-800">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                <span className="font-medium">Confirmation:</span>
                <span>{schedulingPolicy.autoConfirm ? 'Instant confirmation' : 'Requires approval'}</span>
              </div>
            </div>
            
            {/* Working Days Pills */}
            <div className="mt-3 pt-3 border-t border-blue-200">
              <p className="text-xs text-blue-700 mb-2">Working Days:</p>
              <div className="flex flex-wrap gap-1">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                  const fullDay = day === 'Mon' ? 'Monday' : day === 'Tue' ? 'Tuesday' : day === 'Wed' ? 'Wednesday' : day === 'Thu' ? 'Thursday' : day === 'Fri' ? 'Friday' : day === 'Sat' ? 'Saturday' : 'Sunday';
                  const isWorking = schedulingPolicy.workingDays.includes(fullDay);
                  return (
                    <Badge 
                      key={day}
                      className={`text-xs ${
                        isWorking 
                          ? 'bg-green-100 text-green-700 border-green-200' 
                          : 'bg-gray-100 text-gray-400 border-gray-200'
                      }`}
                    >
                      {day}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </Card>
        )}
        
        {/* Show Policy Button (when hidden) */}
        {!showPolicy && (
          <button
            onClick={() => setShowPolicy(true)}
            className="mb-4 text-sm text-blue-600 flex items-center gap-1 hover:underline"
          >
            <Info className="w-4 h-4" />
            View booking policy
          </button>
        )}

        {/* Date Selection */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Select Date</h2>
            <div className="flex gap-2">
              <button
                onClick={goToPreviousWeek}
                className="p-1.5 rounded-lg border border-gray-200 hover:border-[#FF8C42] transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={goToNextWeek}
                className="p-1.5 rounded-lg border border-gray-200 hover:border-[#FF8C42] transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {weekDates.map((date, index) => {
              const dateStr = formatDate(date);
              const isSelected = selectedDate === dateStr;
              const isPast = date < new Date() && !isToday(date);

              return (
                <button
                  key={index}
                  disabled={isPast}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`p-2 rounded-lg border transition-all ${
                    isSelected
                      ? 'border-[#FF8C42] bg-orange-50'
                      : isPast
                      ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                      : 'border-gray-200 hover:border-[#FF8C42] bg-white'
                  }`}
                >
                  <div className="text-xs text-gray-500 mb-1">{getDayName(date)}</div>
                  <div className={`text-sm font-semibold ${isSelected ? 'text-[#FF8C42]' : 'text-gray-900'}`}>
                    {date.getDate()}
                  </div>
                  {isToday(date) && (
                    <div className="text-xs text-green-600 mt-1">Today</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Selection */}
        {selectedDate && (
          <div className="space-y-6">
            {loadingSlots ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42] mx-auto mb-3"></div>
                <p className="text-gray-500 text-sm">Loading available slots...</p>
              </div>
            ) : vendorOffline ? (
              <div className="text-center py-12 bg-red-50 rounded-xl border-2 border-red-200">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <p className="font-semibold text-red-900 mb-1">Vendor Unavailable</p>
                <p className="text-sm text-red-700">This vendor is currently in vacation mode</p>
              </div>
            ) : slots.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No slots available for this date</p>
                <p className="text-gray-400 text-sm mt-1">Try selecting another date</p>
              </div>
            ) : (
              <>
                {/* Morning Slots */}
                {morningSlots.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="w-4 h-4 text-gray-600" />
                      <h3 className="font-semibold">Morning</h3>
                      <Badge variant="secondary" className="text-xs">9 AM - 12 PM</Badge>
                      <span className="text-xs text-gray-500 ml-auto">
                        {morningSlots.length} available
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {morningSlots.map((time) => (
                        <TimeSlotButton key={time} time={time} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Afternoon Slots */}
                {afternoonSlots.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="w-4 h-4 text-gray-600" />
                      <h3 className="font-semibold">Afternoon</h3>
                      <Badge variant="secondary" className="text-xs">12 PM - 4 PM</Badge>
                      <span className="text-xs text-gray-500 ml-auto">
                        {afternoonSlots.length} available
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {afternoonSlots.map((time) => (
                        <TimeSlotButton key={time} time={time} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Evening Slots */}
                {eveningSlots.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="w-4 h-4 text-gray-600" />
                      <h3 className="font-semibold">Evening</h3>
                      <Badge variant="secondary" className="text-xs">4 PM - 7 PM</Badge>
                      <span className="text-xs text-gray-500 ml-auto">
                        {eveningSlots.length} available
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {eveningSlots.map((time) => (
                        <TimeSlotButton key={time} time={time} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Fixed Bottom Bar */}
      {selectedDate && selectedTime && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 max-w-md mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-gray-500">Selected Slot</p>
              <p className="font-semibold">
                {new Date(selectedDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} at {formatTime(selectedTime)}
              </p>
            </div>
            <Badge className="bg-green-100 text-green-600 border-none">
              {serviceDuration} mins
            </Badge>
          </div>
          <Button
            className="w-full bg-[#FF8C42] text-white hover:bg-[#FF7029]"
            onClick={handleContinue}
          >
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}
