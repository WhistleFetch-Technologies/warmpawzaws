'use client';

/**
 * ADVANCED SCHEDULE MANAGER
 * 
 * Complete scheduling system supporting:
 * - Multi-service style slots (e.g., 9-1 PM for Home + Tele, 3-6 PM for Clinic + Tele)
 * - Buffer times between appointments (configurable per service style)
 * - Breaks and holidays management
 * - Service time definitions
 * - Home service radius and travel time calculations
 * 
 * Works for both solo providers and staff within businesses
 */

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Clock,
  Calendar,
  Plus,
  Trash2,
  Save,
  X,
  MapPin,
  Coffee,
  AlertCircle,
  Home,
  Building,
  Video,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Settings,
  Timer,
  Route
} from 'lucide-react';

// Types
interface TimeWindow {
  id: string;
  startTime: string;
  endTime: string;
  serviceStyles: ServiceStyleConfig[];
  isEnabled: boolean;
}

interface ServiceStyleConfig {
  style: 'at_center' | 'at_home' | 'tele';
  enabled: boolean;
  slotDuration: number; // minutes
  bufferTime: number; // minutes between appointments
  maxCapacity: number;
  serviceRadius?: number; // km, only for at_home
}

interface BreakPeriod {
  id: string;
  startTime: string;
  endTime: string;
  name: string;
  isRecurring: boolean;
  dayOfWeek?: number;
  specificDate?: string;
}

interface Holiday {
  id: string;
  date: string;
  name: string;
}

interface DaySchedule {
  dayOfWeek: number;
  dayName: string;
  isEnabled: boolean;
  timeWindows: TimeWindow[];
  breaks: BreakPeriod[];
}

interface ScheduleConfig {
  schedules: DaySchedule[];
  holidays: Holiday[];
  defaultBufferTimes: {
    at_center: number;
    at_home: number;
    tele: number;
  };
  homeServiceConfig: {
    defaultRadius: number;
    commuteAllowance: number; // minutes per km
    maxDailyTravelTime: number;
    enableTrafficFactor: boolean;
  };
}

interface AdvancedScheduleManagerProps {
  vendorId: string;
  staffId?: string; // For staff scheduling
  staffName?: string;
  allowedServiceStyles: string[];
  roleId: string;
  onBack: () => void;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SERVICE_STYLE_CONFIG = {
  at_center: { 
    icon: Building, 
    label: 'At Center/Clinic', 
    color: 'bg-blue-100 text-blue-700 border-blue-300',
    defaultBuffer: 15,
    defaultDuration: 30
  },
  at_home: { 
    icon: Home, 
    label: 'At Home', 
    color: 'bg-green-100 text-green-700 border-green-300',
    defaultBuffer: 30,
    defaultDuration: 60
  },
  tele: { 
    icon: Video, 
    label: 'Tele/Video', 
    color: 'bg-purple-100 text-purple-700 border-purple-300',
    defaultBuffer: 5,
    defaultDuration: 20
  }
};

const SLOT_DURATIONS = [15, 20, 30, 45, 60, 75, 90, 120];
const BUFFER_TIMES = [0, 5, 10, 15, 20, 30, 45, 60];

// Generate time options (30-minute intervals)
const generateTimeOptions = (): string[] => {
  const times: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return times;
};

const TIME_OPTIONS = generateTimeOptions();

// Initialize default schedule
const initializeDefaultSchedule = (allowedStyles: string[]): ScheduleConfig => {
  const defaultStyles: ServiceStyleConfig[] = allowedStyles.map(style => ({
    style: style as 'at_center' | 'at_home' | 'tele',
    enabled: true,
    slotDuration: SERVICE_STYLE_CONFIG[style as keyof typeof SERVICE_STYLE_CONFIG]?.defaultDuration || 30,
    bufferTime: SERVICE_STYLE_CONFIG[style as keyof typeof SERVICE_STYLE_CONFIG]?.defaultBuffer || 15,
    maxCapacity: 1,
    serviceRadius: style === 'at_home' ? 10 : undefined
  }));

  return {
    schedules: DAY_NAMES.map((name, index) => ({
      dayOfWeek: index,
      dayName: name,
      isEnabled: index >= 1 && index <= 5, // Mon-Fri enabled by default
      timeWindows: index >= 1 && index <= 5 ? [{
        id: `window_${index}_0`,
        startTime: '09:00',
        endTime: '18:00',
        serviceStyles: defaultStyles,
        isEnabled: true
      }] : [],
      breaks: index >= 1 && index <= 5 ? [{
        id: `break_${index}_0`,
        startTime: '13:00',
        endTime: '14:00',
        name: 'Lunch Break',
        isRecurring: true,
        dayOfWeek: index
      }] : []
    })),
    holidays: [],
    defaultBufferTimes: {
      at_center: 15,
      at_home: 30,
      tele: 5
    },
    homeServiceConfig: {
      defaultRadius: 10,
      commuteAllowance: 3, // 3 min per km
      maxDailyTravelTime: 120,
      enableTrafficFactor: true
    }
  };
};

export function AdvancedScheduleManager({
  vendorId,
  staffId,
  staffName,
  allowedServiceStyles,
  roleId,
  onBack
}: AdvancedScheduleManagerProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ScheduleConfig>(initializeDefaultSchedule(allowedServiceStyles));
  const [selectedDay, setSelectedDay] = useState<number>(1); // Monday
  const [expandedWindows, setExpandedWindows] = useState<Set<string>>(new Set());
  
  // Modals
  const [showAddWindow, setShowAddWindow] = useState(false);
  const [showAddBreak, setShowAddBreak] = useState(false);
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [showBufferSettings, setShowBufferSettings] = useState(false);
  
  // Form states
  const [newWindow, setNewWindow] = useState({ startTime: '09:00', endTime: '17:00' });
  const [newBreak, setNewBreak] = useState({ startTime: '13:00', endTime: '14:00', name: 'Lunch Break' });
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' });

  // Load existing schedule
  useEffect(() => {
    loadSchedule();
  }, [vendorId, staffId]);

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const endpoint = staffId 
        ? `/staff/${staffId}/schedule`
        : `/vendor/${vendorId}/schedule`;
      
      const data = await apiClient.get(endpoint) as any;
      
      if (data && data.success && data.schedule) {
        // Convert from backend format to UI format
        const converted = convertFromBackendFormat(data.schedule, data.breaks, data.holidays);
        setConfig(prev => ({
          ...prev,
          ...converted
        }));
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
      // Keep default schedule on error
    } finally {
      setLoading(false);
    }
  };

  const convertFromBackendFormat = (schedule: any, breaks: any[], holidays: any[]): Partial<ScheduleConfig> => {
    // Convert grouped schedule format to DaySchedule[]
    const schedules: DaySchedule[] = DAY_NAMES.map((name, dayIndex) => {
      const daySlots = schedule[dayIndex] || [];
      
      // Group slots by time window
      const windowMap = new Map<string, TimeWindow>();
      
      daySlots.forEach((slot: any) => {
        const windowKey = `${slot.time_window_start}-${slot.time_window_end}`;
        
        if (!windowMap.has(windowKey)) {
          windowMap.set(windowKey, {
            id: `window_${dayIndex}_${windowMap.size}`,
            startTime: slot.time_window_start,
            endTime: slot.time_window_end,
            serviceStyles: [],
            isEnabled: true
          });
        }
        
        const window = windowMap.get(windowKey)!;
        window.serviceStyles.push({
          style: slot.service_style || 'at_center',
          enabled: slot.is_enabled !== false,
          slotDuration: slot.slot_duration_minutes || 30,
          bufferTime: slot.buffer_time_minutes || 15,
          maxCapacity: slot.max_capacity || 1,
          serviceRadius: slot.service_area_km
        });
      });

      return {
        dayOfWeek: dayIndex,
        dayName: name,
        isEnabled: daySlots.length > 0,
        timeWindows: Array.from(windowMap.values()),
        breaks: (breaks || [])
          .filter((b: any) => b.day_of_week === dayIndex || b.break_date)
          .map((b: any) => ({
            id: b.id,
            startTime: b.start_time,
            endTime: b.end_time,
            name: b.break_type || 'Break',
            isRecurring: !b.break_date,
            dayOfWeek: b.day_of_week,
            specificDate: b.break_date
          }))
      };
    });

    return {
      schedules,
      holidays: (holidays || []).map((h: any) => ({
        id: h.id,
        date: h.holiday_date,
        name: h.holiday_name || 'Holiday'
      }))
    };
  };

  const saveSchedule = async () => {
    try {
      setSaving(true);
      
      // Convert UI format to backend format
      const slots: any[] = [];
      
      config.schedules.forEach(day => {
        if (!day.isEnabled) return;
        
        day.timeWindows.forEach(window => {
          if (!window.isEnabled) return;
          
          window.serviceStyles.forEach(style => {
            if (!style.enabled) return;
            
            slots.push({
              day_of_week: day.dayOfWeek,
              time_window_start: window.startTime,
              time_window_end: window.endTime,
              service_style: style.style,
              slot_duration_minutes: style.slotDuration,
              buffer_time_minutes: style.bufferTime,
              max_capacity: style.maxCapacity,
              service_area_km: style.serviceRadius,
              is_enabled: true
            });
          });
        });
      });

      // Save breaks
      const breaks = config.schedules.flatMap(day => 
        day.breaks.map(b => ({
          day_of_week: b.isRecurring ? day.dayOfWeek : null,
          break_date: b.specificDate || null,
          start_time: b.startTime,
          end_time: b.endTime,
          break_type: b.name
        }))
      );

      // Save holidays
      const holidays = config.holidays.map(h => ({
        holiday_date: h.date,
        holiday_name: h.name
      }));

      const endpoint = staffId 
        ? `/staff/${staffId}/schedule`
        : `/vendor/${vendorId}/schedule`;

      const result = await apiClient.post(endpoint, {
        slots,
        breaks,
        holidays,
        homeServiceConfig: config.homeServiceConfig
      }) as any;

      if (result && result.success) {
        toast.success('Schedule saved successfully!');
      } else {
        throw new Error(result?.error || 'Failed to save schedule');
      }
    } catch (error: any) {
      console.error('Error saving schedule:', error);
      toast.error(error.message || 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  // Schedule modification functions
  const toggleDay = (dayIndex: number) => {
    setConfig(prev => ({
      ...prev,
      schedules: prev.schedules.map(day => 
        day.dayOfWeek === dayIndex 
          ? { ...day, isEnabled: !day.isEnabled }
          : day
      )
    }));
  };

  const addTimeWindow = () => {
    if (newWindow.startTime >= newWindow.endTime) {
      toast.error('End time must be after start time');
      return;
    }

    const newWindowObj: TimeWindow = {
      id: `window_${selectedDay}_${Date.now()}`,
      startTime: newWindow.startTime,
      endTime: newWindow.endTime,
      serviceStyles: allowedServiceStyles.map(style => ({
        style: style as 'at_center' | 'at_home' | 'tele',
        enabled: true,
        slotDuration: SERVICE_STYLE_CONFIG[style as keyof typeof SERVICE_STYLE_CONFIG]?.defaultDuration || 30,
        bufferTime: config.defaultBufferTimes[style as keyof typeof config.defaultBufferTimes] || 15,
        maxCapacity: 1,
        serviceRadius: style === 'at_home' ? config.homeServiceConfig.defaultRadius : undefined
      })),
      isEnabled: true
    };

    setConfig(prev => ({
      ...prev,
      schedules: prev.schedules.map(day =>
        day.dayOfWeek === selectedDay
          ? { ...day, timeWindows: [...day.timeWindows, newWindowObj], isEnabled: true }
          : day
      )
    }));

    setShowAddWindow(false);
    setNewWindow({ startTime: '09:00', endTime: '17:00' });
    toast.success('Time window added');
  };

  const removeTimeWindow = (dayIndex: number, windowId: string) => {
    setConfig(prev => ({
      ...prev,
      schedules: prev.schedules.map(day =>
        day.dayOfWeek === dayIndex
          ? { ...day, timeWindows: day.timeWindows.filter(w => w.id !== windowId) }
          : day
      )
    }));
  };

  const updateWindowServiceStyle = (
    dayIndex: number, 
    windowId: string, 
    styleIndex: number, 
    updates: Partial<ServiceStyleConfig>
  ) => {
    setConfig(prev => ({
      ...prev,
      schedules: prev.schedules.map(day =>
        day.dayOfWeek === dayIndex
          ? {
              ...day,
              timeWindows: day.timeWindows.map(window =>
                window.id === windowId
                  ? {
                      ...window,
                      serviceStyles: window.serviceStyles.map((style, idx) =>
                        idx === styleIndex ? { ...style, ...updates } : style
                      )
                    }
                  : window
              )
            }
          : day
      )
    }));
  };

  const addBreak = () => {
    if (newBreak.startTime >= newBreak.endTime) {
      toast.error('End time must be after start time');
      return;
    }

    const newBreakObj: BreakPeriod = {
      id: `break_${selectedDay}_${Date.now()}`,
      startTime: newBreak.startTime,
      endTime: newBreak.endTime,
      name: newBreak.name || 'Break',
      isRecurring: true,
      dayOfWeek: selectedDay
    };

    setConfig(prev => ({
      ...prev,
      schedules: prev.schedules.map(day =>
        day.dayOfWeek === selectedDay
          ? { ...day, breaks: [...day.breaks, newBreakObj] }
          : day
      )
    }));

    setShowAddBreak(false);
    setNewBreak({ startTime: '13:00', endTime: '14:00', name: 'Lunch Break' });
    toast.success('Break added');
  };

  const removeBreak = (dayIndex: number, breakId: string) => {
    setConfig(prev => ({
      ...prev,
      schedules: prev.schedules.map(day =>
        day.dayOfWeek === dayIndex
          ? { ...day, breaks: day.breaks.filter(b => b.id !== breakId) }
          : day
      )
    }));
  };

  const addHoliday = () => {
    if (!newHoliday.date) {
      toast.error('Please select a date');
      return;
    }

    const holidayObj: Holiday = {
      id: `holiday_${Date.now()}`,
      date: newHoliday.date,
      name: newHoliday.name || 'Holiday'
    };

    setConfig(prev => ({
      ...prev,
      holidays: [...prev.holidays, holidayObj]
    }));

    setShowAddHoliday(false);
    setNewHoliday({ date: '', name: '' });
    toast.success('Holiday added');
  };

  const removeHoliday = (holidayId: string) => {
    setConfig(prev => ({
      ...prev,
      holidays: prev.holidays.filter(h => h.id !== holidayId)
    }));
  };

  const toggleWindowExpanded = (windowId: string) => {
    setExpandedWindows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(windowId)) {
        newSet.delete(windowId);
      } else {
        newSet.add(windowId);
      }
      return newSet;
    });
  };

  const selectedDaySchedule = config.schedules[selectedDay];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600">Loading schedule...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {staffName ? `${staffName}'s Schedule` : 'Schedule Management'}
                </h1>
                <p className="text-sm text-gray-500">
                  Configure availability, breaks & service styles
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setShowBufferSettings(true)}
                className="border-gray-300"
              >
                <Settings className="w-4 h-4 mr-2" />
                Buffer Settings
              </Button>
              <Button
                onClick={saveSchedule}
                disabled={saving}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Schedule'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Day Selection */}
          <div className="lg:col-span-1 space-y-4">
            {/* Day Pills */}
            <div className="bg-white rounded-xl border p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-orange-500" />
                Days of Week
              </h3>
              <div className="space-y-2">
                {config.schedules.map((day) => (
                  <div
                    key={day.dayOfWeek}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                      selectedDay === day.dayOfWeek
                        ? 'bg-orange-50 border-2 border-orange-500'
                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                    }`}
                    onClick={() => setSelectedDay(day.dayOfWeek)}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={day.isEnabled}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleDay(day.dayOfWeek);
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      />
                      <span className={`font-medium ${day.isEnabled ? 'text-gray-900' : 'text-gray-400'}`}>
                        {day.dayName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {day.timeWindows.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {day.timeWindows.length} slot{day.timeWindows.length !== 1 ? 's' : ''}
                        </Badge>
                      )}
                      {day.breaks.length > 0 && (
                        <Coffee className="w-4 h-4 text-amber-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Holidays Section */}
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-red-500" />
                  Holidays
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddHoliday(true)}
                  className="h-8"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              {config.holidays.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No holidays added
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {config.holidays.map(holiday => (
                    <div
                      key={holiday.id}
                      className="flex items-center justify-between p-2 bg-red-50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{holiday.name}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(holiday.date).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => removeHoliday(holiday.id)}
                        className="p-1 hover:bg-red-100 rounded"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Selected Day Details */}
          <div className="lg:col-span-2 space-y-4">
            {/* Selected Day Header */}
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedDaySchedule.dayName}
                  {!selectedDaySchedule.isEnabled && (
                    <span className="text-sm font-normal text-gray-400 ml-2">(Disabled)</span>
                  )}
                </h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddBreak(true)}
                    disabled={!selectedDaySchedule.isEnabled}
                  >
                    <Coffee className="w-4 h-4 mr-1" />
                    Add Break
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddWindow(true)}
                    disabled={!selectedDaySchedule.isEnabled}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Time Window
                  </Button>
                </div>
              </div>

              {/* Breaks for this day */}
              {selectedDaySchedule.breaks.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-2">Breaks:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedDaySchedule.breaks.map(brk => (
                      <div
                        key={brk.id}
                        className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full"
                      >
                        <Coffee className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-medium text-amber-800">
                          {brk.name}: {brk.startTime} - {brk.endTime}
                        </span>
                        <button
                          onClick={() => removeBreak(selectedDay, brk.id)}
                          className="p-0.5 hover:bg-amber-100 rounded-full"
                        >
                          <X className="w-3 h-3 text-amber-600" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Time Windows */}
              {!selectedDaySchedule.isEnabled ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">This day is disabled</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => toggleDay(selectedDay)}
                  >
                    Enable {selectedDaySchedule.dayName}
                  </Button>
                </div>
              ) : selectedDaySchedule.timeWindows.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No time windows configured</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setShowAddWindow(true)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add First Time Window
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedDaySchedule.timeWindows.map((window, windowIndex) => (
                    <div
                      key={window.id}
                      className="border rounded-lg overflow-hidden"
                    >
                      {/* Window Header */}
                      <div
                        className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer"
                        onClick={() => toggleWindowExpanded(window.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Clock className="w-5 h-5 text-gray-600" />
                          <span className="font-semibold text-gray-900">
                            {window.startTime} - {window.endTime}
                          </span>
                          <div className="flex gap-1">
                            {window.serviceStyles.filter(s => s.enabled).map(style => {
                              const styleConfig = SERVICE_STYLE_CONFIG[style.style];
                              const Icon = styleConfig.icon;
                              return (
                                <Badge
                                  key={style.style}
                                  className={`${styleConfig.color} border`}
                                >
                                  <Icon className="w-3 h-3 mr-1" />
                                  {style.style === 'at_center' ? 'Clinic' : 
                                   style.style === 'at_home' ? 'Home' : 'Tele'}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeTimeWindow(selectedDay, window.id);
                            }}
                            className="p-2 hover:bg-red-100 rounded-lg text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {expandedWindows.has(window.id) ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>

                      {/* Expanded Service Style Configuration */}
                      {expandedWindows.has(window.id) && (
                        <div className="p-4 border-t bg-white space-y-4">
                          {window.serviceStyles.map((style, styleIndex) => {
                            const styleConfig = SERVICE_STYLE_CONFIG[style.style];
                            const Icon = styleConfig.icon;

                            return (
                              <div
                                key={style.style}
                                className={`p-4 rounded-lg border-2 ${
                                  style.enabled 
                                    ? styleConfig.color.replace('bg-', 'border-').split(' ')[0] + ' bg-opacity-30'
                                    : 'border-gray-200 bg-gray-50 opacity-60'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <Icon className={`w-5 h-5 ${style.enabled ? '' : 'text-gray-400'}`} />
                                    <span className="font-medium">{styleConfig.label}</span>
                                  </div>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <span className="text-sm text-gray-500">
                                      {style.enabled ? 'Enabled' : 'Disabled'}
                                    </span>
                                    <input
                                      type="checkbox"
                                      checked={style.enabled}
                                      onChange={(e) => updateWindowServiceStyle(
                                        selectedDay,
                                        window.id,
                                        styleIndex,
                                        { enabled: e.target.checked }
                                      )}
                                      className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                                    />
                                  </label>
                                </div>

                                {style.enabled && (
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    {/* Slot Duration */}
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-1">
                                        <Timer className="w-3 h-3 inline mr-1" />
                                        Slot Duration
                                      </label>
                                      <select
                                        value={style.slotDuration}
                                        onChange={(e) => updateWindowServiceStyle(
                                          selectedDay,
                                          window.id,
                                          styleIndex,
                                          { slotDuration: Number(e.target.value) }
                                        )}
                                        className="w-full px-2 py-1.5 text-sm border rounded-lg"
                                      >
                                        {SLOT_DURATIONS.map(d => (
                                          <option key={d} value={d}>
                                            {d} min
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Buffer Time */}
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-1">
                                        <Clock className="w-3 h-3 inline mr-1" />
                                        Buffer Time
                                      </label>
                                      <select
                                        value={style.bufferTime}
                                        onChange={(e) => updateWindowServiceStyle(
                                          selectedDay,
                                          window.id,
                                          styleIndex,
                                          { bufferTime: Number(e.target.value) }
                                        )}
                                        className="w-full px-2 py-1.5 text-sm border rounded-lg"
                                      >
                                        {BUFFER_TIMES.map(b => (
                                          <option key={b} value={b}>
                                            {b} min
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Max Capacity */}
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-1">
                                        Max Capacity
                                      </label>
                                      <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={style.maxCapacity}
                                        onChange={(e) => updateWindowServiceStyle(
                                          selectedDay,
                                          window.id,
                                          styleIndex,
                                          { maxCapacity: Number(e.target.value) }
                                        )}
                                        className="w-full px-2 py-1.5 text-sm border rounded-lg"
                                      />
                                    </div>

                                    {/* Service Radius (only for at_home) */}
                                    {style.style === 'at_home' && (
                                      <div>
                                        <label className="text-xs text-gray-500 block mb-1">
                                          <Route className="w-3 h-3 inline mr-1" />
                                          Radius (km)
                                        </label>
                                        <input
                                          type="number"
                                          min="1"
                                          max="50"
                                          value={style.serviceRadius || 10}
                                          onChange={(e) => updateWindowServiceStyle(
                                            selectedDay,
                                            window.id,
                                            styleIndex,
                                            { serviceRadius: Number(e.target.value) }
                                          )}
                                          className="w-full px-2 py-1.5 text-sm border rounded-lg"
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Time Window Modal */}
      {showAddWindow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Add Time Window</h3>
              <button onClick={() => setShowAddWindow(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Start Time</label>
                  <select
                    value={newWindow.startTime}
                    onChange={(e) => setNewWindow({ ...newWindow, startTime: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {TIME_OPTIONS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">End Time</label>
                  <select
                    value={newWindow.endTime}
                    onChange={(e) => setNewWindow({ ...newWindow, endTime: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {TIME_OPTIONS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                Service styles can be configured after adding the time window.
              </p>
            </div>
            <div className="p-4 border-t flex gap-3">
              <Button variant="outline" onClick={() => setShowAddWindow(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={addTimeWindow} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white">
                Add Window
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Break Modal */}
      {showAddBreak && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Add Break</h3>
              <button onClick={() => setShowAddBreak(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Break Name</label>
                <input
                  type="text"
                  value={newBreak.name}
                  onChange={(e) => setNewBreak({ ...newBreak, name: e.target.value })}
                  placeholder="e.g., Lunch Break"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Start Time</label>
                  <select
                    value={newBreak.startTime}
                    onChange={(e) => setNewBreak({ ...newBreak, startTime: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {TIME_OPTIONS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">End Time</label>
                  <select
                    value={newBreak.endTime}
                    onChange={(e) => setNewBreak({ ...newBreak, endTime: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {TIME_OPTIONS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex gap-3">
              <Button variant="outline" onClick={() => setShowAddBreak(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={addBreak} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white">
                <Coffee className="w-4 h-4 mr-2" />
                Add Break
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Holiday Modal */}
      {showAddHoliday && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Add Holiday / Day Off</h3>
              <button onClick={() => setShowAddHoliday(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Date</label>
                <input
                  type="date"
                  value={newHoliday.date}
                  onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Name (Optional)</label>
                <input
                  type="text"
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                  placeholder="e.g., Public Holiday, Personal Day"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            <div className="p-4 border-t flex gap-3">
              <Button variant="outline" onClick={() => setShowAddHoliday(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={addHoliday} className="flex-1 bg-red-500 hover:bg-red-600 text-white">
                Add Holiday
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Buffer Time Settings Modal */}
      {showBufferSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Buffer & Travel Settings</h3>
              <button onClick={() => setShowBufferSettings(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-6">
              {/* Default Buffer Times */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Default Buffer Times</h4>
                <p className="text-sm text-gray-500 mb-4">
                  Buffer time between appointments for each service style.
                </p>
                <div className="grid grid-cols-3 gap-4">
                  {(['at_center', 'at_home', 'tele'] as const).map(style => {
                    const styleConfig = SERVICE_STYLE_CONFIG[style];
                    const Icon = styleConfig.icon;
                    return (
                      <div key={style} className={`p-3 rounded-lg ${styleConfig.color}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            {style === 'at_center' ? 'Clinic' : 
                             style === 'at_home' ? 'Home' : 'Tele'}
                          </span>
                        </div>
                        <select
                          value={config.defaultBufferTimes[style]}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            defaultBufferTimes: {
                              ...prev.defaultBufferTimes,
                              [style]: Number(e.target.value)
                            }
                          }))}
                          className="w-full px-2 py-1.5 text-sm border rounded"
                        >
                          {BUFFER_TIMES.map(b => (
                            <option key={b} value={b}>{b} min</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Home Service Config */}
              {allowedServiceStyles.includes('at_home') && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-green-600" />
                    Home Service Settings
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600 block mb-1">Default Radius (km)</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={config.homeServiceConfig.defaultRadius}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          homeServiceConfig: {
                            ...prev.homeServiceConfig,
                            defaultRadius: Number(e.target.value)
                          }
                        }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 block mb-1">Commute (min/km)</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={config.homeServiceConfig.commuteAllowance}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          homeServiceConfig: {
                            ...prev.homeServiceConfig,
                            commuteAllowance: Number(e.target.value)
                          }
                        }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 block mb-1">Max Daily Travel (min)</label>
                      <input
                        type="number"
                        min="30"
                        max="480"
                        step="30"
                        value={config.homeServiceConfig.maxDailyTravelTime}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          homeServiceConfig: {
                            ...prev.homeServiceConfig,
                            maxDailyTravelTime: Number(e.target.value)
                          }
                        }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="trafficFactor"
                        checked={config.homeServiceConfig.enableTrafficFactor}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          homeServiceConfig: {
                            ...prev.homeServiceConfig,
                            enableTrafficFactor: e.target.checked
                          }
                        }))}
                        className="w-4 h-4 rounded"
                      />
                      <label htmlFor="trafficFactor" className="text-sm text-gray-600">
                        Adjust for traffic
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t">
              <Button
                onClick={() => setShowBufferSettings(false)}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdvancedScheduleManager;
