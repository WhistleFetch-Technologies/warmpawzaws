'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, 
  Clock, 
  Plus, 
  Trash2,
  Power,
  Calendar,
  Check,
  X,
  Save,
  AlertCircle,
  MapPin,
  Settings
} from 'lucide-react';
// Uses apiClient (API Gateway)

interface VendorScheduleManagementProps {
  vendorId: string;
  onBack: () => void;
}

// ✅ ENRICHED: Location override for per-slot location
interface LocationOverride {
  address: string;
  formatted_address?: string;
  lat?: number;
  lng?: number;
  place_id?: string;
}

interface TimeSlot {
  id: string;
  startTime: string; // e.g., "09:00"
  endTime: string; // e.g., "17:00"
  isEnabled: boolean;
  locationOverride?: LocationOverride | null; // ✅ NEW: Per-slot location
}

interface ServiceSlotConfig {
  serviceStyle: string; // 'at_center', 'at_home', 'tele'
  slotDuration: number; // in minutes: 15, 30, 45, 60, 75, 90, 105, 120
  serviceArea?: number; // in km: 1-10 (only for at_home)
}

interface DayAvailability {
  dayOfWeek: string; // 'monday', 'tuesday', etc., or 'weekdays', 'weekends', 'all'
  timeWindows: TimeSlot[];
  serviceConfigs: ServiceSlotConfig[];
}

const DAYS = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' }
];

const SLOT_DURATIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 75, label: '1 hr 15 min' },
  { value: 90, label: '1 hr 30 min' },
  { value: 105, label: '1 hr 45 min' },
  { value: 120, label: '2 hours' }
];

const SERVICE_AREAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const SERVICE_STYLE_LABELS: Record<string, string> = {
  'at_center': 'At Center/Clinic',
  'at_home': 'At Home',
  'tele': 'Tele Consulting'
};

// Generate time options for dropdowns (24-hour format)
const generateTimeOptions = () => {
  const times = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hour = h.toString().padStart(2, '0');
      const minute = m.toString().padStart(2, '0');
      times.push(`${hour}:${minute}`);
    }
  }
  return times;
};

const TIME_OPTIONS = generateTimeOptions();

// Initialize default availability helper - MUST be outside component
function initializeDefaultAvailability(): DayAvailability[] {
  return DAYS.map(day => ({
    dayOfWeek: day.value,
    timeWindows: [],
    serviceConfigs: []
  }));
}

export function VendorScheduleManagement({ vendorId, onBack }: VendorScheduleManagementProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [availability, setAvailability] = useState<DayAvailability[]>(initializeDefaultAvailability());
  const [vendorServiceStyles, setVendorServiceStyles] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('monday');
  const [showAddWindowModal, setShowAddWindowModal] = useState(false);
  const [showServiceConfigModal, setShowServiceConfigModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false); // Track edit mode
  const [hasPublishedSchedule, setHasPublishedSchedule] = useState(false); // Track if schedule exists
  const [newTimeWindow, setNewTimeWindow] = useState({
    startTime: '09:00',
    endTime: '17:00',
    locationOverride: null as LocationOverride | null
  });
  
  // ✅ ENRICHED: Location search state for Google Places
  const [locationSearch, setLocationSearch] = useState('');
  const [locationResults, setLocationResults] = useState<any[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);

  // Using apiClient instead of API_BASE

  // ✅ ENRICHED: Google Places location search handler
  const handleLocationSearch = async (query: string) => {
    setLocationSearch(query);
    
    if (query.length < 3) {
      setLocationResults([]);
      return;
    }

    setIsSearchingLocation(true);
    try {
      const response = await apiClient.post<any>('/location/autocomplete', { input: query });
      if (response && response.success) {
        setLocationResults(response.predictions || []);
      }
    } catch (error) {
      console.error('Location search error:', error);
      setLocationResults([]);
    } finally {
      setIsSearchingLocation(false);
    }
  };

  // ✅ ENRICHED: Select location from search results
  const handleSelectLocation = async (placeId: string, description: string) => {
    try {
      const response = await apiClient.post<any>('/location/details', { placeId });
      if (response && response.success && response.location) {
        const locationData: LocationOverride = {
          address: response.location.formatted_address || description,
          formatted_address: response.location.formatted_address,
          lat: response.location.lat,
          lng: response.location.lng,
          place_id: placeId
        };
        setNewTimeWindow(prev => ({ ...prev, locationOverride: locationData }));
        setLocationSearch(locationData.address);
        setLocationResults([]);
      }
    } catch (error) {
      console.error('Location details error:', error);
      // Use description as fallback
      setNewTimeWindow(prev => ({ 
        ...prev, 
        locationOverride: { address: description, place_id: placeId } 
      }));
      setLocationSearch(description);
      setLocationResults([]);
    }
  };

  // ✅ ENRICHED: Clear location selection
  const clearLocation = () => {
    setNewTimeWindow(prev => ({ ...prev, locationOverride: null }));
    setLocationSearch('');
    setLocationResults([]);
  };

  // Fetch vendor status and availability
  useEffect(() => {
    loadScheduleData();
  }, [vendorId]);

  const loadScheduleData = async () => {
    try {
      setLoading(true);
      console.log('📥 Loading schedule data for vendor:', vendorId);

      // ✅ FIX: Use correct endpoints - GET /vendor/:vendorId/schedule (exists in Lambda)
      // Fetch vendor schedule
      const scheduleData = await apiClient.get(`/vendor/${vendorId}/schedule`) as any;

      if (scheduleData && scheduleData.success && scheduleData.schedule) {
        // Convert schedule format from Lambda (grouped by day_of_week) to UI format
        const scheduleByDay = scheduleData.schedule; // { 0: [...], 1: [...], ... }
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const convertedAvailability = dayNames.map((dayName, dayIndex) => {
          const slots = scheduleByDay[dayIndex] || [];
          return {
            dayOfWeek: dayName,
            timeWindows: slots.map((slot: any) => ({
              id: slot.id,
              startTime: slot.time_window_start,
              endTime: slot.time_window_end,
              isEnabled: slot.is_enabled !== false,
            })),
            serviceConfigs: [], // TODO: Extract from slots if needed
          };
        });
        
        const hasSchedule = convertedAvailability.some((day: DayAvailability) => 
          day.timeWindows.length > 0
        );
        
        setAvailability(convertedAvailability);
        setHasPublishedSchedule(hasSchedule);
      } else {
        // Initialize default availability
        const defaultAvail = initializeDefaultAvailability();
        setAvailability(defaultAvail);
      }

      // Fetch availability (new format) - removed placeholder endpoint
      // Availability is now loaded from the schedule endpoint above

      // Fetch vendor's service styles - handle 404 gracefully
      try {
        const vendorData = await apiClient.get(`/vendor/${vendorId}/profile`) as any;

        if (vendorData && vendorData.vendor) {
          // Get service styles from vendor profile
          const servicesData = await apiClient.get(`/vendor/${vendorId}/services`) as any;

          if (servicesData) {
            // Services are returned as an object with keys: at_home, at_center, tele
            // Each containing { services: [], publishedCount: 0 }
            const allServices: string[] = [];
            
            if (servicesData.services && typeof servicesData.services === 'object') {
              // Extract service styles from the services object
              Object.keys(servicesData.services).forEach(style => {
                const styleData = servicesData.services[style];
                if (styleData && styleData.services && Array.isArray(styleData.services) && styleData.services.length > 0) {
                  allServices.push(style);
                }
              });
            }
            
            // If no services configured, default to all service types for demo purposes
            if (allServices.length === 0) {
              console.log('⚠️ No services configured for vendor, enabling all service types for schedule management');
              allServices.push('at_center', 'at_home', 'tele');
            }
            
            setVendorServiceStyles(allServices);
          }
        } else {
          // Vendor not found, default to all service types
          console.log('⚠️ Vendor not found (404), enabling all service types for schedule management');
          setVendorServiceStyles(['at_center', 'at_home', 'tele']);
        }
      } catch (vendorError) {
        console.log('⚠️ Error fetching vendor details, enabling all service types:', vendorError);
        setVendorServiceStyles(['at_center', 'at_home', 'tele']);
      }
    } catch (error) {
      console.error('❌ Error loading schedule data:', error);
      // Ensure we have valid availability even on error
      const defaultAvail = initializeDefaultAvailability();
      console.log('✅ Error recovery: Setting default availability:', defaultAvail);
      setAvailability(defaultAvail);
    } finally {
      setLoading(false);
      console.log('✅ Schedule data loading complete');
    }
  };

  const toggleOnlineStatus = async () => {
    try {
      const newStatus = !isOnline;
      
      const data = await apiClient.put(`/vendor/status/${vendorId}`, { isOnline: newStatus }) as any;
      if (data && data.success) {
        setIsOnline(newStatus);
      }
    } catch (error) {
      console.error('Error toggling online status:', error);
    }
  };

  const saveAvailability = async () => {
    try {
      console.log('💾 SAVE BUTTON CLICKED - Starting save process...');
      console.log('📊 Availability to save:', availability);
      console.log('🆔 Vendor ID:', vendorId);
      
      setSaving(true);

      // ✅ FIX: Use POST /vendor/:vendorId/schedule endpoint (exists in Lambda)
      // Convert UI format to Lambda format
      const slots: any[] = [];
      availability.forEach((day: DayAvailability) => {
        const dayIndex = DAYS.findIndex(d => d.value === day.dayOfWeek);
        if (dayIndex === -1) return;
        
        day.timeWindows.forEach((window: TimeSlot) => {
          if (window.startTime && window.endTime) {
            slots.push({
              dayOfWeek: dayIndex,
              day_of_week: dayIndex,
              serviceStyle: day.serviceConfigs[0]?.serviceStyle || 'at_center',
              service_style: day.serviceConfigs[0]?.serviceStyle || 'at_center',
              timeWindowStart: window.startTime,
              time_window_start: window.startTime,
              timeWindowEnd: window.endTime,
              time_window_end: window.endTime,
              slotDurationMinutes: day.serviceConfigs[0]?.slotDuration || 30,
              slot_duration_minutes: day.serviceConfigs[0]?.slotDuration || 30,
              maxCapacity: 1,
              max_capacity: 1,
              isEnabled: window.isEnabled !== false,
              is_enabled: window.isEnabled !== false,
            });
          }
        });
      });

      const data = await apiClient.post(`/vendor/${vendorId}/schedule`, { slots }) as any;

      console.log('📊 Save API response data:', data);
      if (data && data.success) {
        alert('✅ Schedule saved and published to customer app!');
        setHasPublishedSchedule(true);
        setIsEditMode(false);
      } else {
        console.error('❌ Save API error response:', data);
        alert('❌ Failed to save schedule');
      }
    } catch (error) {
      console.error('❌ Error saving availability:', error);
      alert('❌ Failed to save schedule: ' + error);
    } finally {
      setSaving(false);
      console.log('✅ Save process completed');
    }
  };

  const addTimeWindow = () => {
    console.log('🕐 Adding time window:', newTimeWindow);
    console.log('📊 Current availability state:', availability);
    console.log('📅 Selected day:', selectedDay);
    console.log('🔍 Looking for day in availability...');
    
    if (!newTimeWindow.startTime || !newTimeWindow.endTime) {
      alert('Please select both start and end times');
      return;
    }
    
    if (newTimeWindow.startTime >= newTimeWindow.endTime) {
      alert('End time must be after start time');
      return;
    }

    // Ensure availability is initialized
    if (!availability || availability.length === 0) {
      console.error('❌ Availability array is empty or null!');
      alert('Error: Schedule data not loaded. Please refresh the page.');
      return;
    }

    console.log(`🔎 Searching for day "${selectedDay}" in availability array of ${availability.length} items`);
    availability.forEach((a, index) => {
      console.log(`  [${index}] dayOfWeek: "${a.dayOfWeek}", matches: ${a.dayOfWeek === selectedDay}`);
    });

    const dayAvail = availability.find(a => a.dayOfWeek === selectedDay);
    if (!dayAvail) {
      console.error('❌ Day availability not found for:', selectedDay);
      console.error('Available days:', availability.map(a => a.dayOfWeek));
      alert('Error: Day not found. Please try again.');
      return;
    }

    console.log('✅ Found day availability:', dayAvail);

    const newWindow: TimeSlot = {
      id: `window_${Date.now()}`,
      startTime: newTimeWindow.startTime,
      endTime: newTimeWindow.endTime,
      isEnabled: true,
      locationOverride: newTimeWindow.locationOverride // ✅ ENRICHED: Include location
    };

    console.log('✅ Creating new window:', newWindow);

    const updatedAvailability = availability.map(a =>
      a.dayOfWeek === selectedDay
        ? { ...a, timeWindows: [...a.timeWindows, newWindow] }
        : a
    );
    
    setAvailability(updatedAvailability);
    console.log('✅ Time window added successfully, new availability:', updatedAvailability);

    setShowAddWindowModal(false);
    setNewTimeWindow({ startTime: '09:00', endTime: '17:00', locationOverride: null });
    setLocationSearch(''); // ✅ Clear location search
    setLocationResults([]);
  };

  const removeTimeWindow = (dayOfWeek: string, windowId: string) => {
    setAvailability(availability.map(a =>
      a.dayOfWeek === dayOfWeek
        ? { ...a, timeWindows: a.timeWindows.filter(w => w.id !== windowId) }
        : a
    ));
  };

  const toggleTimeWindow = (dayOfWeek: string, windowId: string) => {
    setAvailability(availability.map(a =>
      a.dayOfWeek === dayOfWeek
        ? {
            ...a,
            timeWindows: a.timeWindows.map(w =>
              w.id === windowId ? { ...w, isEnabled: !w.isEnabled } : w
            )
          }
        : a
    ));
  };

  const addServiceConfig = (serviceStyle: string, slotDuration: number, serviceArea?: number) => {
    const dayAvail = availability.find(a => a.dayOfWeek === selectedDay);
    if (!dayAvail) return;

    // Check if config already exists
    const exists = dayAvail.serviceConfigs.some(c => c.serviceStyle === serviceStyle);
    if (exists) {
      alert('Configuration for this service style already exists. Remove it first to update.');
      return;
    }

    const newConfig: ServiceSlotConfig = {
      serviceStyle,
      slotDuration,
      ...(serviceStyle === 'at_home' && serviceArea ? { serviceArea } : {})
    };

    setAvailability(availability.map(a =>
      a.dayOfWeek === selectedDay
        ? { ...a, serviceConfigs: [...a.serviceConfigs, newConfig] }
        : a
    ));
  };

  const removeServiceConfig = (dayOfWeek: string, serviceStyle: string) => {
    setAvailability(availability.map(a =>
      a.dayOfWeek === dayOfWeek
        ? { ...a, serviceConfigs: a.serviceConfigs.filter(c => c.serviceStyle !== serviceStyle) }
        : a
    ));
  };

  const getCurrentDayAvailability = () => {
    return availability.find(a => a.dayOfWeek === selectedDay);
  };

  const copyToAllDays = () => {
    const currentDay = getCurrentDayAvailability();
    if (!currentDay) return;

    if (!confirm('Copy this day\'s schedule to all other days?')) return;

    setAvailability(availability.map(a => ({
      ...a,
      timeWindows: currentDay.timeWindows.map(w => ({ ...w, id: `window_${Date.now()}_${Math.random()}` })),
      serviceConfigs: [...currentDay.serviceConfigs]
    })));

    alert('✅ Schedule copied to all days!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-8 h-8 text-[#FF8C42] animate-spin mx-auto mb-2" />
          <p className="text-gray-600">Loading schedule...</p>
        </div>
      </div>
    );
  }

  const currentDayAvail = getCurrentDayAvailability();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="vendor-app-column bg-white min-h-screen pb-24">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h1 className="flex-1 text-center font-semibold text-gray-900">Advanced Schedule</h1>
              <div className="w-10" />
            </div>

            {/* Vacation Mode Toggle */}
            <div className="p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl border border-orange-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}>
                    <Power className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">
                      {isOnline ? 'Online' : 'Vacation Mode'}
                    </div>
                    <div className="text-xs text-gray-600">
                      {isOnline ? 'Accepting bookings' : 'Not accepting bookings'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={toggleOnlineStatus}
                  className={`relative w-16 h-8 rounded-full transition-colors ${
                    isOnline ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${
                    isOnline ? 'translate-x-9' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Day Selector */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {DAYS.map(day => (
              <button
                key={day.value}
                onClick={() => setSelectedDay(day.value)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedDay === day.value
                    ? 'bg-[#FF8C42] text-white'
                    : 'bg-white text-gray-700 border border-gray-300'
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
          
          {/* Debug Button - only shown in development */}
          {process.env.NODE_ENV === 'development' && (
            <button
              onClick={() => {
                console.log('🐛 DEBUG STATE:');
                console.log('  - availability:', availability);
                console.log('  - availability.length:', availability?.length);
                console.log('  - selectedDay:', selectedDay);
                console.log('  - vendorServiceStyles:', vendorServiceStyles);
                console.log('  - currentDayAvail:', currentDayAvail);
              }}
              className="mt-2 w-full py-1 bg-purple-100 text-purple-700 text-xs rounded"
            >
              🐛 Debug: Log Current State
            </button>
          )}
        </div>

        {/* Schedule Configuration */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">{DAYS.find(d => d.value === selectedDay)?.label} Schedule</h2>
            <Button
              onClick={copyToAllDays}
              className="bg-blue-500 hover:bg-blue-600 text-white h-8 px-3 text-xs"
            >
              Copy to All Days
            </Button>
          </div>

          {/* Service Configuration Section */}
          <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Service Configuration</h3>
              </div>
              <Button
                onClick={() => setShowServiceConfigModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-3 text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Service
              </Button>
            </div>

            {currentDayAvail && currentDayAvail.serviceConfigs.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">
                No service configurations yet. Add service types to control slot durations and areas.
              </div>
            ) : (
              <div className="space-y-2">
                {currentDayAvail?.serviceConfigs.map((config) => (
                  <div key={config.serviceStyle} className="p-3 bg-white rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 text-sm">
                          {SERVICE_STYLE_LABELS[config.serviceStyle] || config.serviceStyle}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {config.slotDuration} min slots
                          </span>
                          {config.serviceArea && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {config.serviceArea} km radius
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeServiceConfig(selectedDay, config.serviceStyle)}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Time Windows Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Time Windows</h3>
              <Button
                onClick={() => setShowAddWindowModal(true)}
                className="bg-[#FF8C42] hover:bg-[#ff7a28] text-white h-8 px-3 text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Window
              </Button>
            </div>

            {currentDayAvail && currentDayAvail.timeWindows.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 mb-2">No time windows set</p>
                <p className="text-xs text-gray-500">Add time windows to define when you're available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentDayAvail?.timeWindows.map(window => (
                  <div
                    key={window.id}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      window.isEnabled
                        ? 'bg-white border-gray-200'
                        : 'bg-gray-50 border-gray-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-[#FF8C42]" />
                        <span className="font-semibold text-gray-900">
                          {window.startTime} - {window.endTime}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleTimeWindow(selectedDay, window.id)}
                          className={`p-2 rounded-lg transition-colors ${
                            window.isEnabled ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'
                          }`}
                        >
                          {window.isEnabled ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => removeTimeWindow(selectedDay, window.id)}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Show generated slots preview */}
                    {currentDayAvail.serviceConfigs.length > 0 && window.isEnabled && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-xs text-gray-500 mb-2">Slots will be generated for:</div>
                        <div className="space-y-1">
                          {currentDayAvail.serviceConfigs.map(config => {
                            const slots = calculateSlots(window.startTime, window.endTime, config.slotDuration);
                            return (
                              <div key={config.serviceStyle} className="text-xs text-gray-600">
                                <span className="font-medium">{SERVICE_STYLE_LABELS[config.serviceStyle]}:</span>
                                {' '}{slots} slots ({config.slotDuration} min each)
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="p-4 bg-green-50 rounded-xl border border-green-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-700">
                <p className="font-medium mb-1">How it works:</p>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>• Configure service types with slot durations</li>
                  <li>• Add time windows (e.g., 9 AM - 5 PM)</li>
                  <li>• Slots are auto-generated based on your config</li>
                  <li>• Customers see only enabled slots in real-time</li>
                  <li>• Service area applies to home visits only</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
          <div className="vendor-app-column-inner">
            <Button
              onClick={saveAvailability}
              disabled={saving}
              className="w-full bg-[#FF8C42] hover:bg-[#ff7a28] text-white h-12"
            >
              {saving ? (
                <>
                  <Clock className="w-5 h-5 mr-2 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Save & Publish Schedule
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Add Time Window Modal */}
        {showAddWindowModal && (
          <AddTimeWindowModal
            newTimeWindow={newTimeWindow}
            setNewTimeWindow={setNewTimeWindow}
            onAdd={addTimeWindow}
            onClose={() => {
              setShowAddWindowModal(false);
              setLocationSearch('');
              setLocationResults([]);
            }}
            locationSearch={locationSearch}
            locationResults={locationResults}
            isSearchingLocation={isSearchingLocation}
            onLocationSearch={handleLocationSearch}
            onSelectLocation={handleSelectLocation}
            onClearLocation={clearLocation}
          />
        )}

        {/* Add Service Config Modal */}
        {showServiceConfigModal && (
          <AddServiceConfigModal
            vendorServiceStyles={vendorServiceStyles}
            existingConfigs={currentDayAvail?.serviceConfigs || []}
            onAdd={addServiceConfig}
            onClose={() => setShowServiceConfigModal(false)}
          />
        )}
      </div>
    </div>
  );
}

// Helper function to calculate number of slots
function calculateSlots(startTime: string, endTime: string, slotDuration: number): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const totalMinutes = endMinutes - startMinutes;
  return Math.floor(totalMinutes / slotDuration);
}

// Add Time Window Modal Component
function AddTimeWindowModal({ 
  newTimeWindow, 
  setNewTimeWindow, 
  onAdd, 
  onClose,
  locationSearch,
  locationResults,
  isSearchingLocation,
  onLocationSearch,
  onSelectLocation,
  onClearLocation
}: {
  newTimeWindow: { startTime: string; endTime: string; locationOverride?: LocationOverride | null };
  setNewTimeWindow: (value: any) => void;
  onAdd: () => void;
  onClose: () => void;
  locationSearch: string;
  locationResults: any[];
  isSearchingLocation: boolean;
  onLocationSearch: (query: string) => void;
  onSelectLocation: (placeId: string, description: string) => void;
  onClearLocation: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-[400px] max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Time Window</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
            <select
              value={newTimeWindow.startTime}
              onChange={(e) => setNewTimeWindow({ ...newTimeWindow, startTime: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg"
            >
              {TIME_OPTIONS.map(time => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
            <select
              value={newTimeWindow.endTime}
              onChange={(e) => setNewTimeWindow({ ...newTimeWindow, endTime: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg"
            >
              {TIME_OPTIONS.map(time => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
          </div>

          {/* ✅ ENRICHED: Location Search with Google Places */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              Location for this slot (optional)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Set a specific location for this time window (useful for home visits)
            </p>
            
            {newTimeWindow.locationOverride ? (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span className="text-sm text-green-800 flex-1 truncate">
                  {newTimeWindow.locationOverride.address}
                </span>
                <button
                  onClick={onClearLocation}
                  className="text-green-600 hover:text-green-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={locationSearch}
                  onChange={(e) => onLocationSearch(e.target.value)}
                  placeholder="Search for a location..."
                  className="w-full p-3 pl-10 border border-gray-300 rounded-lg"
                />
                <MapPin className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                {isSearchingLocation && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                
                {/* Location search results dropdown */}
                {locationResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {locationResults.map((result: any) => (
                      <button
                        key={result.place_id}
                        onClick={() => onSelectLocation(result.place_id, result.description)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-gray-900 line-clamp-1">
                              {result.structured_formatting?.main_text || result.description}
                            </p>
                            <p className="text-xs text-gray-500 line-clamp-1">
                              {result.structured_formatting?.secondary_text || ''}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              onClick={onClose}
              className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 h-11"
            >
              Cancel
            </Button>
            <Button
              onClick={onAdd}
              className="flex-1 bg-[#FF8C42] hover:bg-[#ff7a28] text-white h-11"
            >
              Add Window
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Add Service Config Modal Component
function AddServiceConfigModal({
  vendorServiceStyles,
  existingConfigs,
  onAdd,
  onClose
}: {
  vendorServiceStyles: string[];
  existingConfigs: ServiceSlotConfig[];
  onAdd: (serviceStyle: string, slotDuration: number, serviceArea?: number) => void;
  onClose: () => void;
}) {
  // Calculate available styles first
  const availableStyles = vendorServiceStyles.length > 0 
    ? vendorServiceStyles.filter(style => !existingConfigs.some(c => c.serviceStyle === style))
    : ['at_center', 'at_home', 'tele'].filter(style => !existingConfigs.some(c => c.serviceStyle === style));

  // Initialize state with the FIRST available style (not the first from all styles)
  const [serviceStyle, setServiceStyle] = useState(availableStyles[0] || 'at_center');
  const [slotDuration, setSlotDuration] = useState(30);
  const [serviceArea, setServiceArea] = useState(2);

  if (availableStyles.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-[400px]">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Service Configuration</h2>
            <p className="text-sm text-gray-600 mb-6">All service types have been configured for this day.</p>
            <Button
              onClick={onClose}
              className="w-full bg-gray-100 text-gray-700 hover:bg-gray-200 h-11"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-[400px] max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Service Configuration</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Service Type</label>
            <select
              value={serviceStyle}
              onChange={(e) => setServiceStyle(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg"
            >
              {availableStyles.map(style => (
                <option key={style} value={style}>
                  {SERVICE_STYLE_LABELS[style] || style}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Slot Duration</label>
            <select
              value={slotDuration}
              onChange={(e) => setSlotDuration(Number(e.target.value))}
              className="w-full p-3 border border-gray-300 rounded-lg"
            >
              {SLOT_DURATIONS.map(duration => (
                <option key={duration.value} value={duration.value}>
                  {duration.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Recommended: At Center (30 min), At Home (60 min), Tele (15 min)
            </p>
          </div>

          {serviceStyle === 'at_home' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Service Area (km)</label>
              <select
                value={serviceArea}
                onChange={(e) => setServiceArea(Number(e.target.value))}
                className="w-full p-3 border border-gray-300 rounded-lg"
              >
                {SERVICE_AREAS.map(area => (
                  <option key={area} value={area}>{area} km</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Maximum distance for home visits
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              onClick={onClose}
              className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200 h-11"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                onAdd(serviceStyle, slotDuration, serviceStyle === 'at_home' ? serviceArea : undefined);
                onClose();
              }}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-11"
            >
              Add Configuration
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}