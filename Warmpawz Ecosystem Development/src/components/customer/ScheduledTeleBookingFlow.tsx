import { useState, useEffect } from 'react';
import { 
  Calendar, Clock, Video, Star, Award, ChevronLeft, ChevronRight,
  Check, AlertCircle, Loader, User, MapPin, Languages
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface ScheduledTeleBookingFlowProps {
  serviceId: string;
  serviceName: string;
  basePrice: number;
  onBookingComplete: (bookingId: string) => void;
  onBack: () => void;
}

interface StaffAvailability {
  staffId: string;
  staffName: string;
  staffPhoto?: string;
  specialization: string;
  rating: number;
  reviewCount: number;
  experience: number;
  languages: string[];
  slots: TimeSlot[];
}

interface TimeSlot {
  slotId: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: number;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  available: boolean;
  bufferTime: number;
}

interface SelectedSlot {
  staff: StaffAvailability;
  slot: TimeSlot;
}

export function ScheduledTeleBookingFlow({
  serviceId,
  serviceName,
  basePrice,
  onBookingComplete,
  onBack
}: ScheduledTeleBookingFlowProps) {
  const [availabilityData, setAvailabilityData] = useState<StaffAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(new Date());

  // Generate next 7 days
  const [availableDates, setAvailableDates] = useState<Date[]>([]);

  useEffect(() => {
    generateAvailableDates();
  }, [currentWeekStart]);

  useEffect(() => {
    if (selectedDate) {
      loadAvailability(selectedDate);
    }
  }, [selectedDate, serviceId]);

  const generateAvailableDates = () => {
    const dates: Date[] = [];
    const start = new Date(currentWeekStart);
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date);
    }
    
    setAvailableDates(dates);
    
    // Auto-select first date if none selected
    if (!selectedDate && dates.length > 0) {
      setSelectedDate(formatDate(dates[0]));
    }
  };

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const formatDisplayDate = (date: Date): string => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // TASK 3: Load tele availability from staff schedules
  const loadAvailability = async (date: string) => {
    try {
      setLoading(true);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/tele/scheduled-availability?serviceId=${serviceId}&date=${date}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAvailabilityData(data.availability || []);
      } else {
        toast.error('Failed to load availability');
        setAvailabilityData([]);
      }
    } catch (error) {
      console.error('Error loading availability:', error);
      toast.error('Error loading availability');
      setAvailabilityData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSlotSelect = (staff: StaffAvailability, slot: TimeSlot) => {
    if (!slot.available) {
      toast.error('This slot is not available');
      return;
    }

    setSelectedSlot({ staff, slot });
  };

  // TASK 3: Create booking with assigned consultant
  const handleConfirmBooking = async () => {
    if (!selectedSlot) {
      toast.error('Please select a time slot');
      return;
    }

    try {
      setBookingInProgress(true);

      // TASK 3: API contract for booking creation
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/bookings/scheduled-tele`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            serviceId,
            serviceName,
            staffId: selectedSlot.staff.staffId,
            staffName: selectedSlot.staff.staffName,
            slotId: selectedSlot.slot.slotId,
            scheduledDate: selectedSlot.slot.date,
            scheduledTime: selectedSlot.slot.startTime,
            duration: calculateDuration(selectedSlot.slot),
            amount: basePrice,
            bookingType: 'scheduled_tele'
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create booking');
      }

      const data = await response.json();
      
      toast.success('Booking confirmed! Proceeding to payment...');
      
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Process payment
      const paymentRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/payments/process`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            bookingId: data.bookingId,
            amount: basePrice,
            paymentMethod: 'razorpay'
          })
        }
      );

      if (paymentRes.ok) {
        toast.success('Payment successful! Your consultation is confirmed.');
        onBookingComplete(data.bookingId);
      } else {
        throw new Error('Payment failed');
      }

    } catch (error: any) {
      console.error('Booking error:', error);
      toast.error(error.message || 'Failed to create booking');
    } finally {
      setBookingInProgress(false);
    }
  };

  const calculateDuration = (slot: TimeSlot): number => {
    const start = parseTime(slot.startTime);
    const end = parseTime(slot.endTime);
    return end - start;
  };

  const parseTime = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const handleWeekChange = (direction: 'prev' | 'next') => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(newStart);
  };

  const getDayName = (dayOfWeek: number): string => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[dayOfWeek];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" onClick={onBack} className="mb-4">
            ← Back
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Schedule Tele Consultation</h1>
          <p className="text-gray-600 mt-1">{serviceName}</p>
        </div>

        {/* TASK 3: Date Selector */}
        <Card className="p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Select Date</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleWeekChange('prev')}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleWeekChange('next')}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {availableDates.map((date, idx) => {
              const dateStr = formatDate(date);
              const selected = selectedDate === dateStr;
              const today = isToday(date);

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`p-3 rounded-lg text-center transition-colors ${
                    selected
                      ? 'bg-[#FF8C42] text-white'
                      : 'bg-white border-2 border-gray-200 hover:border-[#FF8C42]'
                  }`}
                >
                  <div className="text-xs font-medium mb-1">
                    {getDayName(date.getDay())}
                  </div>
                  <div className={`text-lg font-bold ${selected ? 'text-white' : 'text-gray-900'}`}>
                    {date.getDate()}
                  </div>
                  {today && !selected && (
                    <div className="text-xs text-[#FF8C42] mt-1">Today</div>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        {/* TASK 3: Staff Availability with Time Slots */}
        {loading ? (
          <Card className="p-8 text-center">
            <Loader className="w-8 h-8 animate-spin text-[#FF8C42] mx-auto mb-4" />
            <p className="text-gray-600">Loading available time slots...</p>
          </Card>
        ) : availabilityData.length === 0 ? (
          <Card className="p-8 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900 mb-2">No Availability</h3>
            <p className="text-gray-600">
              No consultants available on {formatDisplayDate(new Date(selectedDate))}. Please try another date.
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            {availabilityData.map((staff) => (
              <Card key={staff.staffId} className="p-6">
                {/* Staff Info */}
                <div className="flex items-start gap-4 mb-6 pb-6 border-b">
                  <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                    {staff.staffPhoto ? (
                      <img 
                        src={staff.staffPhoto} 
                        alt={staff.staffName} 
                        className="w-full h-full rounded-full object-cover" 
                      />
                    ) : (
                      <User className="w-10 h-10 text-gray-400" />
                    )}
                  </div>

                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      Dr. {staff.staffName}
                    </h3>
                    <p className="text-gray-600 mb-3">{staff.specialization}</p>

                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span className="font-medium">{staff.rating.toFixed(1)}</span>
                        <span className="text-gray-500">({staff.reviewCount} reviews)</span>
                      </div>

                      <div className="flex items-center gap-2 text-gray-600">
                        <Award className="w-4 h-4" />
                        <span>{staff.experience} years experience</span>
                      </div>

                      {staff.languages.length > 0 && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Languages className="w-4 h-4" />
                          <span>{staff.languages.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* TASK 3: Time Slots */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Available Time Slots
                  </h4>

                  {staff.slots.length === 0 ? (
                    <p className="text-sm text-gray-500">No slots available for this doctor on selected date</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                      {staff.slots.map((slot) => {
                        const isSelected = 
                          selectedSlot?.staff.staffId === staff.staffId && 
                          selectedSlot?.slot.slotId === slot.slotId;

                        return (
                          <button
                            key={slot.slotId}
                            onClick={() => handleSlotSelect(staff, slot)}
                            disabled={!slot.available}
                            className={`p-3 rounded-lg text-center transition-all ${
                              isSelected
                                ? 'bg-green-600 text-white shadow-lg'
                                : slot.available
                                  ? 'bg-white border-2 border-gray-200 hover:border-[#FF8C42] hover:shadow-md'
                                  : 'bg-gray-100 text-gray-400 cursor-not-allowed border-2 border-gray-200'
                            }`}
                          >
                            <div className={`text-sm font-semibold ${
                              isSelected ? 'text-white' : slot.available ? 'text-gray-900' : 'text-gray-400'
                            }`}>
                              {slot.startTime}
                            </div>
                            <div className={`text-xs ${
                              isSelected ? 'text-white' : 'text-gray-500'
                            }`}>
                              {slot.endTime}
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 mx-auto mt-1" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* TASK 3: Selected Slot Summary & Booking */}
        {selectedSlot && (
          <Card className="p-6 mt-6 sticky bottom-6 shadow-xl border-2 border-[#FF8C42]">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-2">Selected Appointment</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-500" />
                    <span>Dr. {selectedSlot.staff.staffName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span>{formatDisplayDate(new Date(selectedSlot.slot.date))}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span>{selectedSlot.slot.startTime} - {selectedSlot.slot.endTime}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-gray-500" />
                    <span>Tele Consultation</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-3">
                <div className="text-right">
                  <div className="text-sm text-gray-600">Total Amount</div>
                  <div className="text-2xl font-bold text-gray-900">₹{basePrice}</div>
                </div>
                <Button
                  onClick={handleConfirmBooking}
                  disabled={bookingInProgress}
                  className="bg-green-600 hover:bg-green-700 min-w-[200px]"
                >
                  {bookingInProgress ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Confirm & Pay
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Info Banner */}
        {!selectedSlot && availabilityData.length > 0 && (
          <Card className="p-4 mt-6 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">How to Book</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Select your preferred date from the calendar above</li>
                  <li>Choose a consultant and available time slot</li>
                  <li>Confirm your appointment and complete payment</li>
                  <li>You'll receive a video call link before your appointment</li>
                </ol>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
