import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
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
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface VendorScheduleManagementProps {
  vendorId: string;
  onBack: () => void;
}

interface TimeSlot {
  id: string;
  startTime: string; // e.g., "09:00"
  endTime: string; // e.g., "17:00"
  isEnabled: boolean;
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
    endTime: '17:00'
  });

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  // Fetch vendor status and availability
  useEffect(() => {
    loadScheduleData();
  }, [vendorId]);

  const loadScheduleData = async () => {
    try {
      setLoading(true);
      console.log('📥 Loading schedule data for vendor:', vendorId);

      // Fetch vendor status
      const statusRes = await fetch(`${API_BASE}/vendor/status/${vendorId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.success) {
          setIsOnline(statusData.status.isOnline);
        }
      }

      // Fetch availability (new format)
      const availRes = await fetch(`${API_BASE}/vendor/availability-v2/${vendorId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      if (availRes.ok) {
        const availData = await availRes.json();
        console.log('📊 Availability API response:', availData);
        if (availData.success && availData.availability && Array.isArray(availData.availability) && availData.availability.length > 0) {
          console.log('✅ Setting availability from API:', availData.availability);
          
          // Check if schedule has any configured windows
          const hasSchedule = availData.availability.some((day: DayAvailability) => 
            day.timeWindows.length > 0 || day.serviceConfigs.length > 0
          );
          
          setAvailability(availData.availability);
          setVendorServiceStyles(availData.serviceStyles || []);
          setHasPublishedSchedule(hasSchedule);
        } else {
          console.log('⚠️ API returned empty/invalid availability, initializing defaults');
          const defaultAvail = initializeDefaultAvailability();
          console.log('✅ Setting default availability:', defaultAvail);
          setAvailability(defaultAvail);
        }
      } else {
        // Initialize default availability for all days
        console.log('⚠️ API call failed, initializing defaults');
        const defaultAvail = initializeDefaultAvailability();
        console.log('✅ Setting default availability:', defaultAvail);
        setAvailability(defaultAvail);
      }

      // Fetch vendor's service styles - handle 404 gracefully
      try {
        const vendorRes = await fetch(`${API_BASE}/vendor/${vendorId}`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        });

        if (vendorRes.ok) {
          const vendorData = await vendorRes.json();
          if (vendorData.vendor) {
            // Get service styles from vendor profile
            const servicesRes = await fetch(`${API_BASE}/vendor/${vendorId}/services`, {
              headers: { 'Authorization': `Bearer ${publicAnonKey}` }
            });

            if (servicesRes.ok) {
              const servicesData = await servicesRes.json();
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
      
      const res = await fetch(`${API_BASE}/vendor/status/${vendorId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isOnline: newStatus })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setIsOnline(newStatus);
        }
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

      const res = await fetch(`${API_BASE}/vendor/availability-v2/${vendorId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ availability })
      });

      console.log('📡 Save API response status:', res.status);
      
      if (res.ok) {
        const data = await res.json();
        console.log('📊 Save API response data:', data);
        // ✅ FIX: Handle standardized response format
        if (data.success || data.data?.success) {
          toast.success('Schedule saved and published to customer app');
          setHasPublishedSchedule(true);
          setIsEditMode(false);
        } else {
          const errorMessage = data.error || data.message || 'Failed to save schedule';
          toast.error(errorMessage);
        }
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error occurred' }));
        const errorMessage = errorData.error || errorData.message || `Failed to save schedule (${res.status})`;
        console.error('❌ Save API error response:', errorMessage);
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error('❌ Error saving availability:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
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
      toast.error('Please select both start and end times');
      return;
    }
    
    if (newTimeWindow.startTime >= newTimeWindow.endTime) {
      toast.error('End time must be after start time');
      return;
    }

    // Ensure availability is initialized
    if (!availability || availability.length === 0) {
      console.error('❌ Availability array is empty or null!');
      toast.error('Schedule data not loaded. Please refresh the page.');
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
      toast.error('Day not found. Please try again.');
      return;
    }

    console.log('✅ Found day availability:', dayAvail);

    const newWindow: TimeSlot = {
      id: `window_${Date.now()}`,
      startTime: newTimeWindow.startTime,
      endTime: newTimeWindow.endTime,
      isEnabled: true
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
    setNewTimeWindow({ startTime: '09:00', endTime: '17:00' });
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
      toast.error('Configuration for this service style already exists. Remove it first to update.');
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

    toast.success('Schedule copied to all days');
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
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen pb-24">
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
          
          {/* Debug Button */}
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
          <div className="max-w-[430px] mx-auto">
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
            onClose={() => setShowAddWindowModal(false)}
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
  onClose 
}: {
  newTimeWindow: { startTime: string; endTime: string };
  setNewTimeWindow: (value: any) => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-[400px]">
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

          <div className="mb-6">
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