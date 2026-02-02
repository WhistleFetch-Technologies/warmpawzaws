'use client';

/**
 * AdvancedAvailabilityManager - Multi-slot, Multi-style Availability System
 * 
 * Features:
 * - Weekly schedule view with day tabs
 * - Multiple slots per day with add/remove
 * - Per-slot configuration (time, service styles, location for solo, buffer, capacity)
 * - Breaks section (lunch, tea, custom)
 * - Holidays and vacation management
 * - Copy schedule across days
 * - Go Offline slider (solo providers only)
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { 
  ArrowLeft, Save, Clock, Plus, X, Copy, Calendar, 
  Coffee, Pause, MapPin, Loader2, ToggleLeft, ToggleRight,
  AlertCircle, ChevronDown, ChevronUp, Trash2, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { EnhancedAddressAutocomplete, AddressComponents } from '@/components/shared/EnhancedAddressAutocomplete';
import { getVendorRoleName } from '@/lib/vendor-utils';

interface AdvancedAvailabilityManagerProps {
  vendorId: string;
  vendorData?: any;
  onBack: () => void;
}

interface TimeSlot {
  id?: string;
  startTime: string;
  endTime: string;
  serviceStyles: ('at_center' | 'at_home' | 'tele')[];
  locationData?: {
    address: string;
    lat?: number;
    lng?: number;
    placeId?: string;
  };
  bufferTime: number;
  maxCapacity: number;
  isEnabled: boolean;
}

interface DaySchedule {
  dayOfWeek: number;
  slots: TimeSlot[];
}

interface Break {
  id?: string;
  dayOfWeek?: number;
  breakDate?: string;
  startTime: string;
  endTime: string;
  breakType: 'lunch' | 'tea' | 'custom' | 'personal';
  reason?: string;
  isRecurring: boolean;
}

interface Holiday {
  id?: string;
  startDate: string;
  endDate: string;
  holidayType: 'holiday' | 'vacation' | 'closed' | 'personal' | 'sick';
  reason?: string;
  isRecurringYearly: boolean;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ALL_SERVICE_STYLES = [
  { id: 'at_center', label: 'At Center', icon: '🏥' },
  { id: 'at_home', label: 'At Home', icon: '🏠' },
  { id: 'tele', label: 'Tele/Video', icon: '📹' },
] as const;

const BREAK_TYPES = [
  { id: 'lunch', label: 'Lunch Break', icon: '🍽️' },
  { id: 'tea', label: 'Tea Break', icon: '☕' },
  { id: 'personal', label: 'Personal Break', icon: '🙋' },
  { id: 'custom', label: 'Custom', icon: '⏸️' },
] as const;

const HOLIDAY_TYPES = [
  { id: 'holiday', label: 'Public Holiday' },
  { id: 'vacation', label: 'Vacation' },
  { id: 'closed', label: 'Closed' },
  { id: 'personal', label: 'Personal Day' },
  { id: 'sick', label: 'Sick Leave' },
] as const;

// DEFAULT_SLOT will be created dynamically based on allowed service styles

export function AdvancedAvailabilityManager({ 
  vendorId, 
  vendorData, 
  onBack 
}: AdvancedAvailabilityManagerProps) {
  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDay, setSelectedDay] = useState(1); // Monday default
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [breaks, setBreaks] = useState<Break[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [allowedServiceStyles, setAllowedServiceStyles] = useState<('at_center' | 'at_home' | 'tele')[]>(['at_home', 'at_center', 'tele']);
  
  // UI state
  const [showAddBreak, setShowAddBreak] = useState(false);
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [expandedBreaks, setExpandedBreaks] = useState(true);
  const [expandedHolidays, setExpandedHolidays] = useState(true);
  
  // New break/holiday form state
  const [newBreak, setNewBreak] = useState<Partial<Break>>({
    breakType: 'lunch',
    startTime: '13:00',
    endTime: '14:00',
    isRecurring: true,
  });
  const [newHoliday, setNewHoliday] = useState<Partial<Holiday>>({
    holidayType: 'vacation',
    startDate: '',
    endDate: '',
    isRecurringYearly: false,
  });
  
  // Check if solo provider
  const isSoloProvider = vendorData?.vendorType === 'solo' || 
                         vendorData?.vendor_type === 'solo' ||
                         vendorData?.isSoloProvider === true;
  
  // Get vendor role name
  const roleName = getVendorRoleName(vendorData);
  
  // Filter service styles based on role and allowed styles
  const SERVICE_STYLES = ALL_SERVICE_STYLES.filter(style => allowedServiceStyles.includes(style.id as any));
  
  // Get default service style (first allowed style, or 'at_home' for groomer_solo)
  const getDefaultServiceStyle = useCallback((): ('at_center' | 'at_home' | 'tele')[] => {
    if (roleName?.toLowerCase() === 'groomer_solo') {
      return ['at_home'];
    }
    return allowedServiceStyles.length > 0 ? [allowedServiceStyles[0]] : ['at_home'];
  }, [roleName, allowedServiceStyles]);

  // Load allowed service styles from vendor services endpoint
  useEffect(() => {
    const loadAllowedServiceStyles = async () => {
      try {
        // Try to get from vendorData first
        if (vendorData?.allowedServiceStyles && Array.isArray(vendorData.allowedServiceStyles)) {
          setAllowedServiceStyles(vendorData.allowedServiceStyles);
          return;
        }
        
        // Fetch from vendor services endpoint
        const servicesRes = await apiClient.get(`/vendor/${vendorId}/services`) as any;
        if (servicesRes?.success && servicesRes?.allowedServiceStyles) {
          setAllowedServiceStyles(servicesRes.allowedServiceStyles);
        } else {
          // Fallback: Use role-based defaults
          const roleNameLower = roleName?.toLowerCase() || '';
          if (roleNameLower === 'groomer_solo') {
            setAllowedServiceStyles(['at_home']);
          } else {
            // Default to all styles for other roles
            setAllowedServiceStyles(['at_home', 'at_center', 'tele']);
          }
        }
      } catch (error) {
        console.warn('Failed to load allowed service styles:', error);
        // Fallback based on role
        const roleNameLower = roleName?.toLowerCase() || '';
        if (roleNameLower === 'groomer_solo') {
          setAllowedServiceStyles(['at_home']);
        } else {
          setAllowedServiceStyles(['at_home', 'at_center', 'tele']);
        }
      }
    };
    
    loadAllowedServiceStyles();
  }, [vendorId, vendorData, roleName]);

  const loadAvailabilityData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load vendor profile for online status
      try {
        const profileRes = await apiClient.get(`/vendor/${vendorId}/profile`) as any;
        if (profileRes?.vendor) {
          setIsOnline(profileRes.vendor.is_online ?? profileRes.vendor.isOnline ?? true);
        }
      } catch (e) {
        console.warn('Failed to load vendor profile:', e);
      }
      
      // Load availability slots
      try {
        const availRes = await apiClient.get(`/vendor/${vendorId}/availability`) as any;
        if (availRes?.success && availRes?.availability?.slots) {
          const loadedSchedule: DaySchedule[] = DAYS.map((_, idx) => ({
            dayOfWeek: idx,
            slots: [],
          }));
          
          // Group slots by day
          availRes.availability.slots.forEach((slot: any) => {
            const dayIdx = slot.day_of_week ?? slot.dayOfWeek;
            if (dayIdx >= 0 && dayIdx <= 6) {
              // Filter service styles to only include allowed ones
              const slotStyles = slot.service_styles || slot.serviceStyles || [];
              const filteredStyles = slotStyles.filter((s: string) => allowedServiceStyles.includes(s as any));
              const defaultStyles = filteredStyles.length > 0 ? filteredStyles : getDefaultServiceStyle();
              
              loadedSchedule[dayIdx].slots.push({
                id: slot.id,
                startTime: slot.time_window_start || slot.startTime || '09:00',
                endTime: slot.time_window_end || slot.endTime || '17:00',
                serviceStyles: defaultStyles,
                locationData: slot.location_data || slot.locationData,
                bufferTime: slot.buffer_time ?? slot.bufferTime ?? 15,
                maxCapacity: slot.max_capacity ?? slot.maxCapacity ?? 1,
                isEnabled: slot.is_enabled ?? slot.isEnabled ?? true,
              });
            }
          });
          
          setSchedule(loadedSchedule);
        }
      } catch (e) {
        console.warn('Failed to load availability:', e);
      }
      
      // Load breaks
      try {
        const breaksRes = await apiClient.get(`/vendor/${vendorId}/breaks`) as any;
        if (breaksRes?.success && breaksRes?.breaks) {
          setBreaks(breaksRes.breaks.map((b: any) => ({
            id: b.id,
            dayOfWeek: b.day_of_week ?? b.dayOfWeek,
            breakDate: b.break_date || b.breakDate,
            startTime: b.start_time || b.startTime,
            endTime: b.end_time || b.endTime,
            breakType: b.break_type || b.breakType || 'custom',
            reason: b.reason,
            isRecurring: b.is_recurring ?? b.isRecurring ?? true,
          })));
        }
      } catch (e) {
        console.warn('Failed to load breaks:', e);
      }
      
      // Load holidays
      try {
        const holidaysRes = await apiClient.get(`/vendor/${vendorId}/holidays`) as any;
        if (holidaysRes?.success && holidaysRes?.holidays) {
          setHolidays(holidaysRes.holidays.map((h: any) => ({
            id: h.id,
            startDate: h.start_date || h.startDate,
            endDate: h.end_date || h.endDate,
            holidayType: h.holiday_type || h.holidayType || 'holiday',
            reason: h.reason,
            isRecurringYearly: h.is_recurring_yearly ?? h.isRecurringYearly ?? false,
          })));
        }
      } catch (e) {
        console.warn('Failed to load holidays:', e);
      }
    } catch (error) {
      console.error('Error loading availability data:', error);
      toast.error('Failed to load availability data');
    } finally {
      setLoading(false);
    }
  }, [vendorId, allowedServiceStyles, getDefaultServiceStyle]);

  // Initialize empty schedule and load data (depends on allowedServiceStyles)
  useEffect(() => {
    const emptySchedule: DaySchedule[] = DAYS.map((_, idx) => ({
      dayOfWeek: idx,
      slots: [],
    }));
    setSchedule(emptySchedule);
    
    // ✅ DEBUG: Log vendorId to verify it's correct
    console.log('[AVAILABILITY] Component mounted with vendorId:', vendorId);
    console.log('[AVAILABILITY] vendorData:', vendorData);
    console.log('[AVAILABILITY] roleName:', roleName);
    console.log('[AVAILABILITY] allowedServiceStyles:', allowedServiceStyles);
    
    // Only load availability data after allowedServiceStyles is determined
    if (allowedServiceStyles.length > 0) {
      loadAvailabilityData();
    }
  }, [vendorId, allowedServiceStyles, loadAvailabilityData]);

  // Add slot to current day
  const addSlot = () => {
    setSchedule(prev => {
      const newSchedule = [...prev];
      const defaultServiceStyles = getDefaultServiceStyle();
      newSchedule[selectedDay].slots.push({
        startTime: '09:00',
        endTime: '17:00',
        serviceStyles: defaultServiceStyles,
        bufferTime: 15,
        maxCapacity: 1,
        isEnabled: true,
      });
      return newSchedule;
    });
  };

  // Remove slot
  const removeSlot = (slotIdx: number) => {
    setSchedule(prev => {
      const newSchedule = [...prev];
      newSchedule[selectedDay].slots = newSchedule[selectedDay].slots.filter((_, i) => i !== slotIdx);
      return newSchedule;
    });
  };

  // Update slot
  const updateSlot = (slotIdx: number, updates: Partial<TimeSlot>) => {
    setSchedule(prev => {
      const newSchedule = [...prev];
      newSchedule[selectedDay].slots[slotIdx] = {
        ...newSchedule[selectedDay].slots[slotIdx],
        ...updates,
      };
      return newSchedule;
    });
  };

  // Toggle service style for slot
  const toggleServiceStyle = (slotIdx: number, style: 'at_center' | 'at_home' | 'tele') => {
    setSchedule(prev => {
      const newSchedule = [...prev];
      const slot = newSchedule[selectedDay].slots[slotIdx];
      const styles = slot.serviceStyles.includes(style)
        ? slot.serviceStyles.filter(s => s !== style)
        : [...slot.serviceStyles, style];
      
      if (styles.length === 0) {
        toast.error('At least one service style must be selected');
        return prev;
      }
      
      slot.serviceStyles = styles;
      return newSchedule;
    });
  };

  // Copy schedule to all days
  const copyToAllDays = () => {
    const currentDaySlots = schedule[selectedDay].slots;
    if (currentDaySlots.length === 0) {
      toast.error('No slots to copy');
      return;
    }
    
    setSchedule(prev => {
      return prev.map((day, idx) => ({
        ...day,
        slots: idx === selectedDay ? day.slots : currentDaySlots.map(slot => ({ ...slot, id: undefined })),
      }));
    });
    
    toast.success(`Copied ${DAYS[selectedDay]}'s schedule to all days`);
  };

  // Copy to weekdays only
  const copyToWeekdays = () => {
    const currentDaySlots = schedule[selectedDay].slots;
    if (currentDaySlots.length === 0) {
      toast.error('No slots to copy');
      return;
    }
    
    setSchedule(prev => {
      return prev.map((day, idx) => ({
        ...day,
        slots: (idx >= 1 && idx <= 5) // Monday to Friday
          ? (idx === selectedDay ? day.slots : currentDaySlots.map(slot => ({ ...slot, id: undefined })))
          : day.slots,
      }));
    });
    
    toast.success(`Copied ${DAYS[selectedDay]}'s schedule to weekdays`);
  };

  // Copy breaks to all days
  const copyBreaksToAllDays = () => {
    const currentDayBreaks = breaks.filter(b => b.isRecurring && b.dayOfWeek === selectedDay);
    if (currentDayBreaks.length === 0) {
      toast.error('No recurring breaks to copy from ' + DAYS[selectedDay]);
      return;
    }
    
    // Remove existing breaks for other days and add copies
    const otherDayBreaks = breaks.filter(b => !b.isRecurring || b.dayOfWeek === selectedDay);
    const newBreaks: Break[] = [...otherDayBreaks];
    
    // Copy to all days
    DAYS.forEach((_, dayIdx) => {
      if (dayIdx !== selectedDay) {
        currentDayBreaks.forEach(breakItem => {
          newBreaks.push({
            ...breakItem,
            id: undefined,
            dayOfWeek: dayIdx,
          });
        });
      }
    });
    
    setBreaks(newBreaks);
    toast.success(`Copied ${DAYS[selectedDay]}'s breaks to all days`);
  };

  // Copy breaks to weekdays only
  const copyBreaksToWeekdays = () => {
    const currentDayBreaks = breaks.filter(b => b.isRecurring && b.dayOfWeek === selectedDay);
    if (currentDayBreaks.length === 0) {
      toast.error('No recurring breaks to copy from ' + DAYS[selectedDay]);
      return;
    }
    
    // Keep non-recurring breaks and current day's breaks, plus weekend breaks
    const preservedBreaks = breaks.filter(b => 
      !b.isRecurring || 
      b.dayOfWeek === selectedDay || 
      b.dayOfWeek === 0 || // Sunday
      b.dayOfWeek === 6    // Saturday
    );
    const newBreaks: Break[] = [...preservedBreaks];
    
    // Copy to weekdays (Mon-Fri, index 1-5)
    for (let dayIdx = 1; dayIdx <= 5; dayIdx++) {
      if (dayIdx !== selectedDay) {
        currentDayBreaks.forEach(breakItem => {
          newBreaks.push({
            ...breakItem,
            id: undefined,
            dayOfWeek: dayIdx,
          });
        });
      }
    }
    
    setBreaks(newBreaks);
    toast.success(`Copied ${DAYS[selectedDay]}'s breaks to weekdays`);
  };

  // Add break
  const addBreak = async () => {
    if (!newBreak.startTime || !newBreak.endTime) {
      toast.error('Start and end time are required');
      return;
    }
    
    const breakToAdd: Break = {
      ...newBreak as Break,
      dayOfWeek: newBreak.isRecurring ? selectedDay : undefined,
    };
    
    setBreaks(prev => [...prev, breakToAdd]);
    setNewBreak({
      breakType: 'lunch',
      startTime: '13:00',
      endTime: '14:00',
      isRecurring: true,
    });
    setShowAddBreak(false);
    toast.success('Break added');
  };

  // Remove break
  const removeBreak = (idx: number) => {
    setBreaks(prev => prev.filter((_, i) => i !== idx));
    toast.success('Break removed');
  };

  // Add holiday
  const addHoliday = async () => {
    if (!newHoliday.startDate || !newHoliday.endDate) {
      toast.error('Start and end date are required');
      return;
    }
    
    setHolidays(prev => [...prev, newHoliday as Holiday]);
    setNewHoliday({
      holidayType: 'vacation',
      startDate: '',
      endDate: '',
      isRecurringYearly: false,
    });
    setShowAddHoliday(false);
    toast.success('Holiday/vacation added');
  };

  // Remove holiday
  const removeHoliday = (idx: number) => {
    setHolidays(prev => prev.filter((_, i) => i !== idx));
    toast.success('Holiday removed');
  };

  // Toggle online status
  const toggleOnlineStatus = async () => {
    setTogglingOnline(true);
    try {
      const newStatus = !isOnline;
      await apiClient.post(`/vendor/${vendorId}/toggle-online`, { isOnline: newStatus });
      setIsOnline(newStatus);
      toast.success(newStatus ? 'You are now online' : 'You are now offline');
    } catch (error) {
      console.error('Error toggling online status:', error);
      toast.error('Failed to update online status');
    } finally {
      setTogglingOnline(false);
    }
  };

  // Save all changes
  const handleSave = async () => {
    // ✅ CRITICAL: Validate vendorId before saving
    if (!vendorId || vendorId === '' || vendorId === 'undefined') {
      console.error('[SAVE] Invalid vendorId:', vendorId);
      toast.error('Cannot save: Invalid vendor ID. Please refresh and try again.');
      return;
    }
    
    console.log('[SAVE] Starting save with vendorId:', vendorId);
    
    setSaving(true);
    try {
      // Save availability slots
      const slotsToSave: any[] = [];
      schedule.forEach(day => {
        day.slots.forEach(slot => {
          if (slot.isEnabled) {
            slotsToSave.push({
              id: slot.id,
              dayOfWeek: day.dayOfWeek,
              timeWindowStart: slot.startTime,
              timeWindowEnd: slot.endTime,
              serviceStyles: slot.serviceStyles,
              locationData: slot.locationData,
              bufferTime: slot.bufferTime,
              maxCapacity: slot.maxCapacity,
              isEnabled: slot.isEnabled,
            });
          }
        });
      });
      
      console.log('[SAVE] Saving slots to /vendor/' + vendorId + '/availability:', slotsToSave);
      
      // Save availability slots
      const availRes = await apiClient.post(`/vendor/${vendorId}/availability`, { slots: slotsToSave }) as any;
      console.log('[SAVE] Availability response:', availRes);
      
      if (!availRes?.success) {
        console.error('[SAVE] Save failed:', availRes);
        throw new Error(availRes?.error || availRes?.message || 'Failed to save slots');
      }
      
      // Save breaks
      console.log('[SAVE] Saving breaks:', breaks);
      const breaksRes = await apiClient.post(`/vendor/${vendorId}/breaks`, { breaks }) as any;
      console.log('[SAVE] Breaks response:', breaksRes);
      
      // Save holidays (use enhanced endpoint for full holiday support)
      console.log('[SAVE] Saving holidays:', holidays);
      const holidaysRes = await apiClient.post(`/vendor/${vendorId}/holidays-enhanced`, { holidays }) as any;
      console.log('[SAVE] Holidays response:', holidaysRes);
      
      // Show detailed success message
      const slotCount = availRes?.insertedCount || slotsToSave.length;
      const breakCount = breaksRes?.insertedCount || breaks.length;
      const holidayCount = holidaysRes?.insertedCount || holidays.length;
      
      toast.success(`Saved: ${slotCount} slots, ${breakCount} breaks, ${holidayCount} holidays`);
      
      // Reload data to confirm it persisted
      console.log('[SAVE] Reloading data to verify persistence...');
      await loadAvailabilityData();
    } catch (error: any) {
      console.error('[SAVE] Error saving availability:', error);
      toast.error(error.message || 'Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#FF8C42] mx-auto mb-3" />
          <p className="text-gray-600">Loading availability...</p>
        </div>
      </div>
    );
  }

  const currentDaySlots = schedule[selectedDay]?.slots || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-bold text-gray-900">Advanced Availability</h1>
              <p className="text-sm text-gray-600">Manage your schedule, breaks, and holidays</p>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save All
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Online Toggle - Solo providers only */}
        {isSoloProvider && (
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isOnline ? (
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                ) : (
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                )}
                <div>
                  <p className="font-semibold text-gray-900">
                    {isOnline ? 'You are Online' : 'You are Offline'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {isOnline 
                      ? 'Customers can see you and book appointments' 
                      : 'You are hidden from customers'}
                  </p>
                </div>
              </div>
              <button
                onClick={toggleOnlineStatus}
                disabled={togglingOnline}
                className={`p-2 rounded-full transition-colors ${
                  isOnline 
                    ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {togglingOnline ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : isOnline ? (
                  <ToggleRight className="w-8 h-8" />
                ) : (
                  <ToggleLeft className="w-8 h-8" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Day Tabs */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="flex border-b overflow-x-auto">
            {DAYS.map((day, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedDay(idx)}
                className={`flex-1 min-w-[80px] py-3 px-2 text-sm font-medium transition-colors ${
                  selectedDay === idx
                    ? 'bg-[#FF8C42] text-white'
                    : schedule[idx].slots.length > 0
                      ? 'bg-green-50 text-green-700 hover:bg-green-100'
                      : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {day.slice(0, 3)}
                {schedule[idx].slots.length > 0 && (
                  <span className="ml-1 text-xs">({schedule[idx].slots.length})</span>
                )}
              </button>
            ))}
          </div>

          {/* Copy Actions */}
          <div className="flex gap-2 p-3 bg-gray-50 border-b">
            <Button size="sm" variant="outline" onClick={copyToAllDays}>
              <Copy className="w-4 h-4 mr-1" />
              Copy to All
            </Button>
            <Button size="sm" variant="outline" onClick={copyToWeekdays}>
              <Copy className="w-4 h-4 mr-1" />
              Copy to Weekdays
            </Button>
          </div>

          {/* Slots for Selected Day */}
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">{DAYS[selectedDay]} Slots</h3>
              <Button size="sm" onClick={addSlot} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
                <Plus className="w-4 h-4 mr-1" />
                Add Slot
              </Button>
            </div>

            {currentDaySlots.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Clock className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>No slots configured for {DAYS[selectedDay]}</p>
                <p className="text-sm">Click "Add Slot" to create one</p>
              </div>
            ) : (
              <div className="space-y-4">
                {currentDaySlots.map((slot, slotIdx) => (
                  <div key={slotIdx} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-sm font-medium text-gray-500">Slot {slotIdx + 1}</span>
                      <button
                        onClick={() => removeSlot(slotIdx)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Time Range */}
                    <div className="flex items-center gap-2 mb-4">
                      <input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => updateSlot(slotIdx, { startTime: e.target.value })}
                        className="px-3 py-2 border rounded-lg text-sm"
                      />
                      <span className="text-gray-500">to</span>
                      <input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => updateSlot(slotIdx, { endTime: e.target.value })}
                        className="px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>

                    {/* Service Styles - Only show allowed styles */}
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">Service Styles</p>
                      <div className="flex flex-wrap gap-2">
                        {SERVICE_STYLES.length > 0 ? (
                          SERVICE_STYLES.map(style => (
                            <button
                              key={style.id}
                              onClick={() => toggleServiceStyle(slotIdx, style.id as any)}
                              className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 transition-colors ${
                                slot.serviceStyles.includes(style.id as any)
                                  ? 'bg-[#FF8C42] text-white'
                                  : 'bg-white border text-gray-600 hover:border-[#FF8C42]'
                              }`}
                            >
                              <span>{style.icon}</span>
                              {style.label}
                            </button>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500">No service styles available for this role</p>
                        )}
                      </div>
                    </div>

                    {/* Location for Solo (at_home only) */}
                    {isSoloProvider && slot.serviceStyles.includes('at_home') && (
                      <div className="mb-4">
                        <p className="text-sm text-gray-600 mb-2 flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          Service Location
                        </p>
                        <EnhancedAddressAutocomplete
                          value={slot.locationData?.address || ''}
                          onChange={(address, components) => {
                            updateSlot(slotIdx, {
                              locationData: {
                                address,
                                lat: components?.lat,
                                lng: components?.lng,
                                placeId: components?.placeId,
                              },
                            });
                          }}
                          placeholder="Search for your service location..."
                        />
                      </div>
                    )}

                    {/* Buffer & Capacity */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Buffer (min)</p>
                        <Input
                          type="number"
                          min={0}
                          max={60}
                          value={slot.bufferTime}
                          onChange={(e) => updateSlot(slotIdx, { bufferTime: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Max Capacity</p>
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          value={slot.maxCapacity}
                          onChange={(e) => updateSlot(slotIdx, { maxCapacity: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Breaks Section */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <button
            onClick={() => setExpandedBreaks(!expandedBreaks)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
          >
            <div className="flex items-center gap-2">
              <Coffee className="w-5 h-5 text-[#FF8C42]" />
              <span className="font-semibold text-gray-900">Breaks</span>
              <Badge variant="secondary">{breaks.length}</Badge>
            </div>
            {expandedBreaks ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>

          {expandedBreaks && (
            <div className="border-t">
              {/* Copy Actions for Breaks */}
              <div className="flex gap-2 p-3 bg-gray-50 border-b">
                <Button size="sm" variant="outline" onClick={copyBreaksToAllDays}>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy to All Days
                </Button>
                <Button size="sm" variant="outline" onClick={copyBreaksToWeekdays}>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy to Weekdays
                </Button>
              </div>
              
              <div className="p-4">
              {/* Current Day's Breaks */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <span className="bg-[#FF8C42] text-white text-xs px-2 py-0.5 rounded">{DAYS[selectedDay]}</span>
                  Breaks
                </h4>
                {breaks.filter(b => b.isRecurring && b.dayOfWeek === selectedDay).length === 0 ? (
                  <p className="text-center text-gray-500 py-4 bg-gray-50 rounded-lg">
                    No breaks configured for {DAYS[selectedDay]}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {breaks.map((breakItem, idx) => {
                      // Only show breaks for the selected day
                      if (!breakItem.isRecurring || breakItem.dayOfWeek !== selectedDay) return null;
                      return (
                        <div key={idx} className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">
                              {BREAK_TYPES.find(t => t.id === breakItem.breakType)?.icon || '⏸️'}
                            </span>
                            <div>
                              <p className="font-medium text-gray-900">
                                {breakItem.startTime} - {breakItem.endTime}
                              </p>
                              <p className="text-sm text-gray-600">
                                {BREAK_TYPES.find(t => t.id === breakItem.breakType)?.label || 'Break'}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => removeBreak(idx)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Other Days' Breaks (collapsed view) */}
              {breaks.filter(b => b.isRecurring && b.dayOfWeek !== selectedDay).length > 0 && (
                <div className="mb-4">
                  <details className="group">
                    <summary className="text-sm font-medium text-gray-500 cursor-pointer hover:text-gray-700 mb-2">
                      Other days' breaks ({breaks.filter(b => b.isRecurring && b.dayOfWeek !== selectedDay).length})
                    </summary>
                    <div className="space-y-2 mt-2">
                      {breaks.map((breakItem, idx) => {
                        if (!breakItem.isRecurring || breakItem.dayOfWeek === selectedDay) return null;
                        return (
                          <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <span className="text-lg">
                                {BREAK_TYPES.find(t => t.id === breakItem.breakType)?.icon || '⏸️'}
                              </span>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {breakItem.startTime} - {breakItem.endTime}
                                </p>
                                <p className="text-sm text-gray-600">
                                  Every {DAYS[breakItem.dayOfWeek || 0]}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => removeBreak(idx)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </div>
              )}

              {/* One-time breaks */}
              {breaks.filter(b => !b.isRecurring).length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">One-time breaks</h4>
                  <div className="space-y-2">
                    {breaks.map((breakItem, idx) => {
                      if (breakItem.isRecurring) return null;
                      return (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">
                              {BREAK_TYPES.find(t => t.id === breakItem.breakType)?.icon || '⏸️'}
                            </span>
                            <div>
                              <p className="font-medium text-gray-900">
                                {breakItem.startTime} - {breakItem.endTime}
                              </p>
                              <p className="text-sm text-gray-600">
                                {breakItem.breakDate || 'One-time'}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => removeBreak(idx)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {showAddBreak ? (
                <div className="p-4 border rounded-lg bg-blue-50 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Type</p>
                      <select
                        value={newBreak.breakType}
                        onChange={(e) => setNewBreak(prev => ({ ...prev, breakType: e.target.value as any }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        {BREAK_TYPES.map(t => (
                          <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Recurring?</p>
                      <select
                        value={newBreak.isRecurring ? 'yes' : 'no'}
                        onChange={(e) => setNewBreak(prev => ({ ...prev, isRecurring: e.target.value === 'yes' }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="yes">Every {DAYS[selectedDay]}</option>
                        <option value="no">One-time</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Start</p>
                      <input
                        type="time"
                        value={newBreak.startTime}
                        onChange={(e) => setNewBreak(prev => ({ ...prev, startTime: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">End</p>
                      <input
                        type="time"
                        value={newBreak.endTime}
                        onChange={(e) => setNewBreak(prev => ({ ...prev, endTime: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={addBreak} className="bg-[#FF8C42]">
                      <Check className="w-4 h-4 mr-1" />
                      Add Break
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowAddBreak(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setShowAddBreak(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Break
                </Button>
              )}
              </div>
            </div>
          )}
        </div>

        {/* Holidays Section */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <button
            onClick={() => setExpandedHolidays(!expandedHolidays)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#FF8C42]" />
              <span className="font-semibold text-gray-900">Holidays & Vacation</span>
              <Badge variant="secondary">{holidays.length}</Badge>
            </div>
            {expandedHolidays ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>

          {expandedHolidays && (
            <div className="p-4 border-t">
              {holidays.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No holidays or vacations scheduled</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {holidays.map((holiday, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">
                          {holiday.startDate === holiday.endDate 
                            ? holiday.startDate 
                            : `${holiday.startDate} - ${holiday.endDate}`}
                        </p>
                        <p className="text-sm text-gray-600">
                          {HOLIDAY_TYPES.find(t => t.id === holiday.holidayType)?.label}
                          {holiday.reason && ` - ${holiday.reason}`}
                          {holiday.isRecurringYearly && ' (Recurring yearly)'}
                        </p>
                      </div>
                      <button
                        onClick={() => removeHoliday(idx)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {showAddHoliday ? (
                <div className="p-4 border rounded-lg bg-blue-50 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Type</p>
                      <select
                        value={newHoliday.holidayType}
                        onChange={(e) => setNewHoliday(prev => ({ ...prev, holidayType: e.target.value as any }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        {HOLIDAY_TYPES.map(t => (
                          <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Recurring Yearly?</p>
                      <select
                        value={newHoliday.isRecurringYearly ? 'yes' : 'no'}
                        onChange={(e) => setNewHoliday(prev => ({ ...prev, isRecurringYearly: e.target.value === 'yes' }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Start Date</p>
                      <input
                        type="date"
                        value={newHoliday.startDate}
                        onChange={(e) => setNewHoliday(prev => ({ ...prev, startDate: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">End Date</p>
                      <input
                        type="date"
                        value={newHoliday.endDate}
                        onChange={(e) => setNewHoliday(prev => ({ ...prev, endDate: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Reason (optional)</p>
                    <Input
                      value={newHoliday.reason || ''}
                      onChange={(e) => setNewHoliday(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder="e.g., Annual vacation, Diwali"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={addHoliday} className="bg-[#FF8C42]">
                      <Check className="w-4 h-4 mr-1" />
                      Add Holiday
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowAddHoliday(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setShowAddHoliday(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Holiday/Vacation
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
