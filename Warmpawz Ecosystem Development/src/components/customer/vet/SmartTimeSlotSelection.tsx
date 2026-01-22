import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Clock, ChevronRight, AlertCircle, MapPin, User, ChevronLeft, Home as HomeIcon, ShoppingCart, User as UserIcon } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { useCart } from '../../../context/CartContext';

interface SmartTimeSlotSelectionProps {
  serviceType: string;
  vendorName: string;
  vendorId: string;
  selectedService: any; // Service object with duration, price, etc.
  selectedStaffId?: string; // Optional: Pre-selected staff member
  vendorRoleId?: string; // ✅ NEW: Vendor role (veterinarian, groomer, etc.)
  onBack: () => void;
  onSelectSlot: (date: string, time: string, slotData?: any) => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface TimeSlot {
  startTime: string;
  endTime: string;
  duration: number;
  locationId: string | null;
  locationName: string | null;
}

interface StaffMember {
  id: string;
  fullName: string;
  roleType: string;
  specializations?: string[];
  photo?: string;
}

export function SmartTimeSlotSelection({ 
  serviceType, 
  vendorName, 
  vendorId, 
  selectedService,
  selectedStaffId,
  vendorRoleId,
  onBack, 
  onSelectSlot,
  onNavigate
}: SmartTimeSlotSelectionProps) {
  
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [availableStaff, setAvailableStaff] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>(selectedStaffId || '');
  const [locationInfo, setLocationInfo] = useState<any>(null);
  const [autoSelectingDate, setAutoSelectingDate] = useState(false); // ✅ NEW: Track auto-selection
  const { itemCount } = useCart();

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  const serviceDuration = selectedService?.duration || selectedService?.customDuration || 30;

  // Generate next 7 days
  const getNextDays = () => {
    const days = [];
    const today = new Date();
    
    for (let i = 0; i < 30; i++) { // ✅ Show 30 days (configurable from admin settings)
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

  // Load available staff for this service
  useEffect(() => {
    if (vendorId && selectedService) {
      loadAvailableStaff();
    }
  }, [vendorId, selectedService]);

  // ✅ NEW: Auto-select first available date when staff is selected
  useEffect(() => {
    if (selectedStaff && !selectedDate && !autoSelectingDate) {
      autoSelectFirstAvailableDate();
    }
  }, [selectedStaff]);

  // Fetch available slots when date and staff are selected
  useEffect(() => {
    if (selectedDate && selectedStaff) {
      fetchAvailableSlots();
    }
  }, [selectedDate, selectedStaff]);

  const loadAvailableStaff = async () => {
    try {
      // Get all staff members from the vendor who can provide this service
      const response = await fetch(
        `${API_BASE}/vendor/${vendorId}/staff`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const staffList = data.staff || [];
        
        // Filter staff who have this service assigned
        const serviceId = selectedService.serviceId || selectedService.id;
        const eligibleStaff: StaffMember[] = [];

        for (const staff of staffList) {
          // Check if staff has this service
          const staffServicesRes = await fetch(
            `${API_BASE}/staff/${staff.id}/services`,
            {
              headers: { 'Authorization': `Bearer ${publicAnonKey}` }
            }
          );

          if (staffServicesRes.ok) {
            const servicesData = await staffServicesRes.json();
            const hasService = servicesData.services?.some((s: any) => 
              s.serviceId === serviceId || s.id === serviceId
            );

            if (hasService) {
              eligibleStaff.push(staff);
            }
          }
        }

        setAvailableStaff(eligibleStaff);

        // Auto-select first staff if none selected
        if (!selectedStaff && eligibleStaff.length > 0) {
          setSelectedStaff(eligibleStaff[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading available staff:', error);
    }
  };

  const fetchAvailableSlots = async () => {
    try {
      setLoading(true);
      
      // ✅ Determine service style from serviceType
      let serviceStyle = 'at_center'; // default
      if (serviceType === 'tele' || serviceType === 'video') {
        serviceStyle = 'tele';
      } else if (serviceType === 'home') {
        serviceStyle = 'at_home';
      } else if (serviceType === 'clinic' || serviceType === 'center') {
        serviceStyle = 'at_center';
      }
      
      console.log('🎯 Fetching smart availability:');
      console.log('  - staffId:', selectedStaff);
      console.log('  - date:', selectedDate);
      console.log('  - duration:', serviceDuration);
      console.log('  - serviceStyle:', serviceStyle);
      console.log('  - vendorRoleId:', vendorRoleId);
      
      // ✅ Build URL with service style and vendor role
      let url = `${API_BASE}/staff/${selectedStaff}/available-slots?date=${selectedDate}&duration=${serviceDuration}&serviceStyle=${serviceStyle}`;
      if (vendorRoleId) {
        url += `&vendorRoleId=${vendorRoleId}`;
      }
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      console.log('📡 Response status:', res.status);

      if (res.ok) {
        const data = await res.json();
        console.log('📊 Smart slots received:', data);
        
        if (data.availableSlots && data.availableSlots.length > 0) {
          setAvailableSlots(data.availableSlots);
          setLocationInfo({
            name: data.locationName,
            id: data.locationId,
            dayOfWeek: data.dayOfWeek
          });
        } else {
          console.log('⚠️ No slots available:', data.reason || 'Unknown reason');
          setAvailableSlots([]);
          setLocationInfo(null);
        }
      } else {
        const errorText = await res.text();
        console.error('❌ Failed to fetch available slots');
        console.error('   Status:', res.status);
        console.error('   Response:', errorText);
        setAvailableSlots([]);
      }
    } catch (error) {
      console.error('❌ Error fetching available slots:', error);
      setAvailableSlots([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: Auto-select first available date
  const autoSelectFirstAvailableDate = async () => {
    setAutoSelectingDate(true);
    try {
      // ✅ Determine service style from serviceType
      let serviceStyle = 'at_center'; // default
      if (serviceType === 'tele' || serviceType === 'video') {
        serviceStyle = 'tele';
      } else if (serviceType === 'home') {
        serviceStyle = 'at_home';
      } else if (serviceType === 'clinic' || serviceType === 'center') {
        serviceStyle = 'at_center';
      }
      
      console.log('🔍 Auto-selecting first available date...');
      
      // Check each date starting from today
      for (const day of days) {
        console.log(`  Checking ${day.date}...`);
        
        let url = `${API_BASE}/staff/${selectedStaff}/available-slots?date=${day.date}&duration=${serviceDuration}&serviceStyle=${serviceStyle}`;
        if (vendorRoleId) {
          url += `&vendorRoleId=${vendorRoleId}`;
        }
        
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        });

        if (res.ok) {
          const data = await res.json();
          
          if (data.availableSlots && data.availableSlots.length > 0) {
            console.log(`  ✅ Found ${data.availableSlots.length} slots on ${day.date}`);
            setSelectedDate(day.date);
            return; // Exit after finding first available date
          }
        }
      }
      
      // No available slots found in any date
      console.log('  ❌ No available slots found in the next 30 days');
      setSelectedDate(days[0].date); // Default to today anyway
    } catch (error) {
      console.error('❌ Error auto-selecting date:', error);
      setSelectedDate(days[0].date); // Default to today on error
    } finally {
      setAutoSelectingDate(false);
    }
  };

  // Organize slots into time periods
  const getTimeSlots = () => {
    if (!availableSlots || availableSlots.length === 0) {
      return { morning: [], afternoon: [], evening: [] };
    }

    const morning = availableSlots.filter(slot => {
      const hour = parseInt(slot.startTime.split(':')[0]);
      return hour >= 6 && hour < 12;
    });

    const afternoon = availableSlots.filter(slot => {
      const hour = parseInt(slot.startTime.split(':')[0]);
      return hour >= 12 && hour < 16;
    });

    const evening = availableSlots.filter(slot => {
      const hour = parseInt(slot.startTime.split(':')[0]);
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
    onSelectSlot(selectedDate, selectedTime, {
      staffId: selectedStaff,
      staffName: availableStaff.find(s => s.id === selectedStaff)?.fullName,
      duration: serviceDuration,
      locationId: selectedSlot?.locationId,
      locationName: selectedSlot?.locationName
    });
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
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#FF8C42] to-[#FF7029] text-white px-6 pt-8 pb-6 sticky top-0 z-10">
        <button onClick={onBack} className="mb-4 flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl text-white mb-1">Select Date & Time</h1>
            <p className="text-sm text-white/80">{selectedService?.serviceName || selectedService?.name}</p>
            <p className="text-xs text-white/60">Duration: {serviceDuration} minutes</p>
          </div>
          <div className="text-3xl">{getServiceTypeIcon()}</div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* ✅ Scheduling Policy Info Card */}
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-1">
                {vendorName} Booking Info
              </h3>
              <p className="text-xs text-blue-700">Review the scheduling policy before booking</p>
            </div>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-blue-800">
              <span className="text-blue-600">⏰</span>
              <span className="font-medium">Duration:</span>
              <span>{serviceDuration} minutes</span>
            </div>
            
            <div className="flex items-center gap-2 text-blue-800">
              <span className="text-blue-600">📅</span>
              <span className="font-medium">Booking Window:</span>
              <span>Up to 30 days ahead</span>
            </div>
            
            <div className="flex items-center gap-2 text-blue-800">
              <span className="text-blue-600">❌</span>
              <span className="font-medium">Cancellation:</span>
              <span>Free up to 4 hours before</span>
            </div>
            
            <div className="flex items-center gap-2 text-blue-800">
              <span className="text-blue-600">✅</span>
              <span className="font-medium">Confirmation:</span>
              <span>Instant confirmation</span>
            </div>
          </div>
        </Card>

        {/* Staff Selection */}
        {availableStaff.length > 1 && (
          <div>
            <h3 className="text-gray-900 mb-3 flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-[#FF8C42]" />
              Select Doctor/Staff
            </h3>
            <div className="space-y-2">
              {availableStaff.map((staff) => (
                <button
                  key={staff.id}
                  onClick={() => {
                    setSelectedStaff(staff.id);
                    setSelectedTime(''); // Reset time selection
                  }}
                  className={`w-full p-3 rounded-xl border-2 transition-all text-left ${ 
                    selectedStaff === staff.id
                      ? 'border-[#FF8C42] bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {staff.photo ? (
                      <img src={staff.photo} alt={staff.fullName} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-500" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className={`text-sm ${selectedStaff === staff.id ? 'text-[#FF8C42]' : 'text-gray-900'}`}>
                        {staff.fullName}
                      </p>
                      {staff.specializations && staff.specializations.length > 0 && (
                        <p className="text-xs text-gray-500">{staff.specializations.join(', ')}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Date Selection */}
        <div>
          <h3 className="text-gray-900 mb-3 flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-[#FF8C42]" />
            Select Date
          </h3>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
            {days.map((day) => (
              <button
                key={day.date}
                onClick={() => {
                  console.log('📅 Date selected:', day.date);
                  setSelectedDate(day.date);
                  setSelectedTime(''); // Reset time selection
                }}
                className={`flex-shrink-0 w-20 p-3 rounded-xl border-2 transition-all ${ 
                  selectedDate === day.date
                    ? 'border-[#FF8C42] bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="text-center">
                  {day.isToday && (
                    <div className="text-[10px] text-[#FF8C42] mb-1">TODAY</div>
                  )}
                  <div className={`text-xs ${selectedDate === day.date ? 'text-[#FF8C42]' : 'text-gray-500'}`}>
                    {day.dayName}
                  </div>
                  <div className={`text-2xl ${selectedDate === day.date ? 'text-[#FF8C42]' : 'text-gray-900'}`}>
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

        {/* Location Info */}
        {locationInfo && locationInfo.name && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <div className="flex items-center gap-2 text-sm text-blue-900">
              <MapPin className="w-4 h-4" />
              <span>Available at: <strong>{locationInfo.name}</strong></span>
            </div>
          </div>
        )}

        {/* Time Slots */}
        {selectedDate && selectedStaff && (
          <div className="space-y-4">
            <h3 className="text-gray-900 flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-[#FF8C42]" />
              Available Time Slots ({serviceDuration} min blocks)
            </h3>

            {/* Loading State */}
            {loading && (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-[#FF8C42] animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-600">Loading available slots...</p>
              </div>
            )}

            {/* No Slots Available */}
            {!loading && availableSlots.length === 0 && (
              <div className="text-center py-12 bg-orange-50 rounded-xl border-2 border-orange-200">
                <AlertCircle className="w-12 h-12 text-orange-500 mx-auto mb-3" />
                <p className="text-orange-900 mb-1">No Slots Available</p>
                <p className="text-sm text-orange-700">Please select a different date or staff member</p>
              </div>
            )}

            {/* Available Slots */}
            {!loading && availableSlots.length > 0 && (
              <>
                {/* Morning Slots */}
                {timeSlots.morning.length > 0 && (
                  <div>
                    <h4 className="text-sm text-gray-600 mb-2">☀️ Morning (6 AM - 12 PM)</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {timeSlots.morning.map((slot) => (
                        <button
                          key={slot.startTime}
                          onClick={() => {
                            setSelectedTime(slot.startTime);
                            setSelectedSlot(slot);
                          }}
                          className={`p-3 rounded-lg border-2 transition-all text-sm ${ 
                            selectedTime === slot.startTime
                              ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]'
                              : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                          }`}
                        >
                          <div>{formatTime(slot.startTime)}</div>
                          <div className="text-xs text-gray-500">-{formatTime(slot.endTime)}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Afternoon Slots */}
                {timeSlots.afternoon.length > 0 && (
                  <div>
                    <h4 className="text-sm text-gray-600 mb-2">🌤️ Afternoon (12 PM - 4 PM)</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {timeSlots.afternoon.map((slot) => (
                        <button
                          key={slot.startTime}
                          onClick={() => {
                            setSelectedTime(slot.startTime);
                            setSelectedSlot(slot);
                          }}
                          className={`p-3 rounded-lg border-2 transition-all text-sm ${ 
                            selectedTime === slot.startTime
                              ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]'
                              : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                          }`}
                        >
                          <div>{formatTime(slot.startTime)}</div>
                          <div className="text-xs text-gray-500">-{formatTime(slot.endTime)}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Evening Slots */}
                {timeSlots.evening.length > 0 && (
                  <div>
                    <h4 className="text-sm text-gray-600 mb-2">🌙 Evening (4 PM - 10 PM)</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {timeSlots.evening.map((slot) => (
                        <button
                          key={slot.startTime}
                          onClick={() => {
                            setSelectedTime(slot.startTime);
                            setSelectedSlot(slot);
                          }}
                          className={`p-3 rounded-lg border-2 transition-all text-sm ${ 
                            selectedTime === slot.startTime
                              ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]'
                              : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                          }`}
                        >
                          <div>{formatTime(slot.startTime)}</div>
                          <div className="text-xs text-gray-500">-{formatTime(slot.endTime)}</div>
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
              <strong>📌 Note:</strong> Your {serviceDuration}-minute appointment is confirmed. Please arrive 10 minutes early.
            </p>
          </Card>
        )}
      </div>

      {/* Continue Button */}
      {selectedDate && selectedTime && (
        <div className="fixed bottom-16 left-0 right-0 w-full max-w-[430px] mx-auto bg-white border-t border-gray-200 p-4 shadow-lg z-40">
          <div className="mb-3 text-center">
            <p className="text-sm text-gray-600">Selected Slot</p>
            <p className="text-gray-900 text-sm">
              {new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })} at {formatTime(selectedTime)}
            </p>
            {locationInfo && locationInfo.name && (
              <p className="text-xs text-gray-500 flex items-center justify-center gap-1 mt-1">
                <MapPin className="w-3 h-3" />
                {locationInfo.name}
              </p>
            )}
          </div>
          <Button
            onClick={handleContinue}
            className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF7029] hover:from-[#FF7029] hover:to-[#FF8C42] h-12 text-base"
          >
            Continue to Payment
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      )}

      {/* Fixed Bottom Navigation - Matching Customer Home */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 max-w-[430px] mx-auto z-50">
        <div className="flex items-center justify-around">
          <button 
            onClick={() => onNavigate && onNavigate('home')}
            className="flex flex-col items-center gap-1"
          >
            <HomeIcon className="w-6 h-6 text-[#FF8C42]" />
            <span className="text-xs font-medium text-[#FF8C42]">Home</span>
          </button>
          <button 
            onClick={() => onNavigate && onNavigate('cart')}
            className="flex flex-col items-center gap-1 relative"
          >
            <div className="relative">
              <ShoppingCart className="w-6 h-6 text-gray-400" />
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400">Cart</span>
          </button>
          <button 
            onClick={() => onNavigate && onNavigate('bookings')}
            className="flex flex-col items-center gap-1"
          >
            <Calendar className="w-6 h-6 text-gray-400" />
            <span className="text-xs text-gray-400">Bookings</span>
          </button>
          <button 
            onClick={() => onNavigate && onNavigate('profile')}
            className="flex flex-col items-center gap-1"
          >
            <UserIcon className="w-6 h-6 text-gray-400" />
            <span className="text-xs text-gray-400">Profile</span>
          </button>
        </div>
        {/* Home Indicator */}
        <div className="flex justify-center mt-2">
          <div className="w-32 h-1 bg-black rounded-full"></div>
        </div>
      </div>
    </div>
  );
}