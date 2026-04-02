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

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { getVendorRoleName, isSoloVendor } from '@/lib/vendor-utils';

interface AdvancedAvailabilityManagerProps {
  vendorId: string;
  vendorData?: any;
  onBack: () => void;
}

/** Lead time (minutes) per service style: at_home = travel to customer, at_center = prep, tele = setup */
export type LeadTimeByStyle = Partial<Record<'at_center' | 'at_home' | 'tele', number>>;

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
  /** @deprecated Use leadTimeByStyle per style instead */
  bufferTime?: number;
  /** Lead time (min) per service style - e.g. at_home: 45 (travel), at_center: 15, tele: 5 */
  leadTimeByStyle?: LeadTimeByStyle;
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
  { id: 'at_center', label: 'At Center', icon: '🏥', leadLabel: 'Prep time (min)' },
  { id: 'at_home', label: 'At Home', icon: '🏠', leadLabel: 'Travel time (min)' },
  { id: 'tele', label: 'Tele/Video', icon: '📹', leadLabel: 'Setup time (min)' },
] as const;

/** Default lead times per style when creating a new slot */
const DEFAULT_LEAD_TIME_BY_STYLE: LeadTimeByStyle = {
  at_home: 45,
  at_center: 15,
  tele: 5,
};

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

/** Convert "HH:MM" to minutes since midnight for comparison */
function timeToMinutes(t: string): number {
  const [h, m] = (t || '00:00').split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** True if two time ranges overlap (boundaries inclusive: same start/end counts as overlap) */
function timeRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const aS = timeToMinutes(aStart);
  const aE = timeToMinutes(aEnd);
  const bS = timeToMinutes(bStart);
  const bE = timeToMinutes(bEnd);
  if (aS > aE || bS > bE) return true; // invalid range, treat as overlap to block
  return aS < bE && bS < aE;
}

/** Returns first overlapping day name if schedule + breaks have any slot/slot, slot/break, or break/break overlap */
function getOverlapDay(
  schedule: DaySchedule[],
  breaks: Break[]
): string | null {
  for (let dayIdx = 0; dayIdx < (schedule?.length ?? 0); dayIdx++) {
    const daySlots = schedule[dayIdx]?.slots ?? [];
    const dayBreaks = breaks.filter(b => b.isRecurring && b.dayOfWeek === dayIdx);
    for (let i = 0; i < daySlots.length; i++) {
      for (let j = i + 1; j < daySlots.length; j++) {
        if (timeRangesOverlap(daySlots[i].startTime, daySlots[i].endTime, daySlots[j].startTime, daySlots[j].endTime)) {
          return DAYS[dayIdx];
        }
      }
      for (const b of dayBreaks) {
        if (timeRangesOverlap(daySlots[i].startTime, daySlots[i].endTime, b.startTime, b.endTime)) {
          return DAYS[dayIdx];
        }
      }
    }
    for (let i = 0; i < dayBreaks.length; i++) {
      for (let j = i + 1; j < dayBreaks.length; j++) {
        if (timeRangesOverlap(dayBreaks[i].startTime, dayBreaks[i].endTime, dayBreaks[j].startTime, dayBreaks[j].endTime)) {
          return DAYS[dayIdx];
        }
      }
    }
  }
  return null;
}

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
        let styles: string[] = [];
        
        // ✅ Priority 1: Check vendorData.serviceStyles.selected (what vendor has actually configured)
        // This is the most important - shows only what the vendor has selected/enabled
        if (vendorData?.serviceStyles?.selected && Array.isArray(vendorData.serviceStyles.selected) && vendorData.serviceStyles.selected.length > 0) {
          // Map role config style names to database style names
          const styleMap: Record<string, string> = {
            'at_home': 'at_home',
            'home_visit': 'at_home',
            'tele': 'tele',
            'video_consultation': 'tele',
            'at_center': 'at_center',
            'at_clinic': 'at_center',
          };
          styles = vendorData.serviceStyles.selected
            .map((s: string) => styleMap[s.toLowerCase()] || s)
            .filter((s: string) => ['at_home', 'at_center', 'tele'].includes(s));
          console.log('[AVAILABILITY] Using serviceStyles.selected from vendorData:', styles);
        }
        // ✅ Priority 2: Check vendorData.allowedServiceStyles (direct array)
        else if (vendorData?.allowedServiceStyles && Array.isArray(vendorData.allowedServiceStyles)) {
          styles = vendorData.allowedServiceStyles;
          console.log('[AVAILABILITY] Using allowedServiceStyles from vendorData:', styles);
        }
        // ✅ Priority 3: Fetch from vendor services endpoint
        else {
          const servicesRes = await apiClient.get(`/vendor/${vendorId}/services`) as any;
          if (servicesRes?.success && servicesRes?.allowedServiceStyles) {
            styles = servicesRes.allowedServiceStyles;
            console.log('[AVAILABILITY] Using allowedServiceStyles from services endpoint:', styles);
          } else {
            // Fallback: Use role-based defaults
            const roleNameLower = roleName?.toLowerCase() || '';
            if (roleNameLower === 'groomer_solo') {
              styles = ['at_home'];
            } else {
              // Default to all styles for other roles
              styles = ['at_home', 'at_center', 'tele'];
            }
          }
        }
        
        // ✅ CRITICAL: Filter out 'at_center' for ALL solo vendors (vet_solo, groomer_solo, etc.)
        // Solo vendors don't have a physical center/clinic location
        if (isSoloVendor(vendorData)) {
          styles = styles.filter(s => s !== 'at_center');
          console.log('[AVAILABILITY] Filtered out at_center for solo vendor. Final styles:', styles);
        }
        
        // ✅ CRITICAL: Filter out 'tele' for walker roles (walkers don't provide tele services)
        const roleNameLower = roleName?.toLowerCase() || '';
        const isWalker = roleNameLower.includes('walker') || roleNameLower.includes('dog_walker') || roleNameLower === 'pet_walker';
        if (isWalker) {
          styles = styles.filter(s => s !== 'tele');
          console.log('[AVAILABILITY] Filtered out tele for walker role. Final styles:', styles);
        }
        
        // ✅ CRITICAL: Filter out 'tele' for groomer_solo (groomers don't provide tele services)
        if (roleNameLower === 'groomer_solo' || roleNameLower === 'pet_groomer') {
          styles = styles.filter(s => s !== 'tele');
          console.log('[AVAILABILITY] Filtered out tele for groomer role. Final styles:', styles);
        }
        
        // ✅ CRITICAL: Filter out 'tele' for trainer_solo (trainer solo only provides at_home services, no tele)
        const isTrainerSolo = roleNameLower === 'trainer_solo' || 
                             roleNameLower === 'training_solo' ||
                             (roleNameLower.includes('trainer') && (isSoloVendor(vendorData) || isSoloProvider));
        if (isTrainerSolo) {
          styles = styles.filter(s => s !== 'tele');
          console.log('[AVAILABILITY] Filtered out tele for trainer solo role. Final styles:', styles);
        }
        
        // Ensure we have at least one style
        if (styles.length === 0) {
          styles = ['at_home'];
          console.log('[AVAILABILITY] No styles found, defaulting to at_home');
        }
        // Only update state if content changed (avoids re-triggering init effect and flicker)
        setAllowedServiceStyles(prev => {
          const same = prev.length === styles.length && styles.every((s, i) => prev[i] === s);
          return same ? prev : (styles as ('at_center' | 'at_home' | 'tele')[]);
        });
      } catch (error) {
        console.warn('Failed to load allowed service styles:', error);
        // Fallback based on role
        const roleNameLower = roleName?.toLowerCase() || '';
        let fallbackStyles: string[] = [];
        if (roleNameLower === 'groomer_solo' || roleNameLower.includes('walker')) {
          fallbackStyles = ['at_home'];
        } else {
          fallbackStyles = ['at_home', 'at_center', 'tele'];
        }
        setAllowedServiceStyles(prev => {
          const same = prev.length === fallbackStyles.length && fallbackStyles.every((s, i) => prev[i] === s);
          return same ? prev : (fallbackStyles as ('at_center' | 'at_home' | 'tele')[]);
        });
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
        if (availRes?.success) {
          // Do NOT set allowedServiceStyles from API here — it causes a dependency loop:
          // setAllowedServiceStyles → effect re-runs → setSchedule(empty) → load again → flicker.
          // Allowed styles are already set by loadAllowedServiceStyles effect (vendorData / services).
          if (availRes?.availability?.slots) {
            const loadedSchedule: DaySchedule[] = DAYS.map((_, idx) => ({
              dayOfWeek: idx,
              slots: [],
            }));

            availRes.availability.slots.forEach((slot: any) => {
              const dayIdx = slot.day_of_week ?? slot.dayOfWeek;
              if (dayIdx >= 0 && dayIdx <= 6) {
                const slotStyles = slot.service_styles || slot.serviceStyles || [];
                let filteredStyles = slotStyles.filter((s: string) => allowedServiceStyles.includes(s as any));
                if (isSoloVendor(vendorData)) {
                  filteredStyles = filteredStyles.filter((s: string) => s !== 'at_center');
                }
                const defaultStyles = filteredStyles.length > 0 ? filteredStyles : getDefaultServiceStyle();
                const leadTimeByStyle = slot.leadTimeByStyle || slot.lead_time_by_style || undefined;
                loadedSchedule[dayIdx].slots.push({
                  id: slot.id,
                  startTime: slot.time_window_start || slot.startTime || '09:00',
                  endTime: slot.time_window_end || slot.endTime || '17:00',
                  serviceStyles: defaultStyles,
                  locationData: slot.location_data || slot.locationData,
                  bufferTime: leadTimeByStyle ? undefined : (slot.buffer_time ?? slot.bufferTime ?? 15),
                  leadTimeByStyle: leadTimeByStyle || undefined,
                  maxCapacity: slot.max_capacity ?? slot.maxCapacity ?? 1,
                  isEnabled: slot.is_enabled ?? slot.isEnabled ?? true,
                });
              }
            });

            setSchedule(loadedSchedule);
          }
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
      
      // Load holidays (same endpoint as save so data persists correctly)
      try {
        const holidaysRes = await apiClient.get(`/vendor/${vendorId}/holidays-enhanced`) as any;
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

  // Track vendorId so we only clear schedule when vendor changes (prevents flicker on re-run)
  const lastVendorIdRef = useRef<string | null>(null);

  // Initialize empty schedule and load data (depends on allowedServiceStyles)
  useEffect(() => {
    const emptySchedule: DaySchedule[] = DAYS.map((_, idx) => ({
      dayOfWeek: idx,
      slots: [],
    }));
    // Only clear schedule when vendorId actually changed; otherwise we get flicker when
    // effect re-runs due to allowedServiceStyles or loadAvailabilityData identity change
    if (lastVendorIdRef.current !== vendorId) {
      lastVendorIdRef.current = vendorId;
      setSchedule(emptySchedule);
    }

    if (allowedServiceStyles.length > 0) {
      loadAvailabilityData();
    }
  }, [vendorId, allowedServiceStyles, loadAvailabilityData]);

  // Add slot to current day; warn if default 09:00-17:00 overlaps (user must set non-overlapping times)
  const addSlot = () => {
    const defaultStart = '09:00';
    const defaultEnd = '17:00';
    const daySlots = schedule[selectedDay]?.slots ?? [];
    const dayBreaks = breaks.filter(b => b.isRecurring && b.dayOfWeek === selectedDay);
    let overlaps = false;
    for (const slot of daySlots) {
      if (timeRangesOverlap(defaultStart, defaultEnd, slot.startTime, slot.endTime)) {
        overlaps = true;
        break;
      }
    }
    if (!overlaps) {
      for (const b of dayBreaks) {
        if (timeRangesOverlap(defaultStart, defaultEnd, b.startTime, b.endTime)) {
          overlaps = true;
          break;
        }
      }
    }
    if (overlaps) {
      toast.warning('Default times overlap existing slots or breaks. Set non-overlapping times for this slot.');
    }

    setSchedule(prev => {
      const newSchedule = [...prev];
      const defaultServiceStyles = getDefaultServiceStyle();
      // ✅ Initialize locationData for solo providers (needed for at_home/tele services)
      const initialLocationData = isSoloProvider && vendorData?.address ? {
        address: vendorData.address || '',
        lat: vendorData.latitude,
        lng: vendorData.longitude,
      } : undefined;
      newSchedule[selectedDay].slots.push({
        startTime: defaultStart,
        endTime: defaultEnd,
        serviceStyles: defaultServiceStyles,
        locationData: initialLocationData,
        leadTimeByStyle: { ...DEFAULT_LEAD_TIME_BY_STYLE },
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

  // Update slot — overlap with other slots/breaks is allowed while editing; handleSave blocks invalid saves.
  const updateSlot = (slotIdx: number, updates: Partial<TimeSlot>) => {
    const hasTimeChange = 'startTime' in updates || 'endTime' in updates;

    setSchedule(prev => {
      const daySlots = prev[selectedDay]?.slots ?? [];
      const merged = { ...daySlots[slotIdx], ...updates };
      const start = merged.startTime ?? '';
      const end = merged.endTime ?? '';

      if (hasTimeChange && start && end) {
        if (timeToMinutes(end) <= timeToMinutes(start)) {
          toast.error('End time must be after start time');
          return prev;
        }
      }

      return prev.map((day, idx) =>
        idx === selectedDay
          ? { ...day, slots: day.slots.map((s, i) => (i === slotIdx ? merged : s)) }
          : day
      );
    });
  };

  // Toggle service style for slot
  // ✅ FIX: Allow multiple service styles to be selected (at_home + tele for vet_solo, etc.)
  const toggleServiceStyle = (slotIdx: number, style: 'at_center' | 'at_home' | 'tele') => {
    console.log('[TOGGLE] Toggling service style:', { slotIdx, style, selectedDay });
    
    setSchedule(prev => {
      // ✅ FIX: Prevent selecting at_center for solo vendors
      if (style === 'at_center' && isSoloVendor(vendorData)) {
        toast.error('Solo providers cannot offer services at a center/clinic');
        return prev;
      }
      
      // ✅ FIX: Create a deep copy to avoid mutation issues
      const newSchedule = prev.map((day, dayIdx) => {
        if (dayIdx === selectedDay) {
          // For the selected day, update the specific slot
          return {
            ...day,
            slots: day.slots.map((slot, idx) => {
              if (idx === slotIdx) {
                // Get current styles
                const currentStyles = [...slot.serviceStyles];
                
                // Toggle the style: if already selected, remove it; otherwise add it
                const newStyles = currentStyles.includes(style)
                  ? currentStyles.filter(s => s !== style)
                  : [...currentStyles, style];
                
                // Ensure at least one style is selected
                if (newStyles.length === 0) {
                  toast.error('At least one service style must be selected');
                  return slot; // Return unchanged slot
                }
                
                // ✅ FIX: Filter out any at_center styles that might have been in existing slots
                const filteredStyles = isSoloVendor(vendorData)
                  ? newStyles.filter(s => s !== 'at_center')
                  : newStyles;
                
                console.log('[TOGGLE] Updating slot styles:', { 
                  current: currentStyles, 
                  new: newStyles, 
                  filtered: filteredStyles 
                });
                
                // Create a new slot object with updated serviceStyles
                return {
                  ...slot,
                  serviceStyles: filteredStyles
                };
              }
              return slot;
            })
          };
        }
        return day;
      });
      
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
    const overlapDay = getOverlapDay(schedule, newBreaks);
    if (overlapDay) {
      toast.warning(`Some copied breaks overlap slots or other breaks (e.g. ${overlapDay}). Fix before saving.`);
    } else {
      toast.success(`Copied ${DAYS[selectedDay]}'s breaks to all days`);
    }
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
    const overlapDay = getOverlapDay(schedule, newBreaks);
    if (overlapDay) {
      toast.warning(`Some copied breaks overlap slots or other breaks (e.g. ${overlapDay}). Fix before saving.`);
    } else {
      toast.success(`Copied ${DAYS[selectedDay]}'s breaks to weekdays`);
    }
  };

  // Add break (with overlap validation: no overlap with slots or other breaks on same day)
  const addBreak = async () => {
    if (!newBreak.startTime || !newBreak.endTime) {
      toast.error('Start and end time are required');
      return;
    }
    if (timeToMinutes(newBreak.endTime) <= timeToMinutes(newBreak.startTime)) {
      toast.error('End time must be after start time');
      return;
    }

    const daySlots = schedule[selectedDay]?.slots ?? [];
    const dayBreaks = breaks.filter(b => b.isRecurring && b.dayOfWeek === selectedDay);
    for (const slot of daySlots) {
      if (timeRangesOverlap(newBreak.startTime, newBreak.endTime, slot.startTime, slot.endTime)) {
        toast.error('This break overlaps an existing time slot. Please choose a different time.');
        return;
      }
    }
    for (const b of dayBreaks) {
      if (timeRangesOverlap(newBreak.startTime, newBreak.endTime, b.startTime, b.endTime)) {
        toast.error('This break overlaps another break. Please choose a different time.');
        return;
      }
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

    // Overlap validation: no slot/slot, slot/break, or break/break overlap per day
    for (let dayIdx = 0; dayIdx < schedule.length; dayIdx++) {
      const daySlots = schedule[dayIdx]?.slots ?? [];
      const dayBreaks = breaks.filter(b => b.isRecurring && b.dayOfWeek === dayIdx);
      for (let i = 0; i < daySlots.length; i++) {
        for (let j = i + 1; j < daySlots.length; j++) {
          if (timeRangesOverlap(daySlots[i].startTime, daySlots[i].endTime, daySlots[j].startTime, daySlots[j].endTime)) {
            toast.error(`${DAYS[dayIdx]}: Two slots overlap. Please set non-overlapping times before saving.`);
            return;
          }
        }
        for (const b of dayBreaks) {
          if (timeRangesOverlap(daySlots[i].startTime, daySlots[i].endTime, b.startTime, b.endTime)) {
            toast.error(`${DAYS[dayIdx]}: A slot overlaps a break. Please fix before saving.`);
            return;
          }
        }
      }
      for (let i = 0; i < dayBreaks.length; i++) {
        for (let j = i + 1; j < dayBreaks.length; j++) {
          if (timeRangesOverlap(dayBreaks[i].startTime, dayBreaks[i].endTime, dayBreaks[j].startTime, dayBreaks[j].endTime)) {
            toast.error(`${DAYS[dayIdx]}: Two breaks overlap. Please fix before saving.`);
            return;
          }
        }
      }
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
              leadTimeByStyle: slot.leadTimeByStyle || undefined,
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

      if (!breaksRes?.success) {
        const msg = breaksRes?.insertErrors?.length
          ? breaksRes.insertErrors.join('; ')
          : (breaksRes?.message || 'Failed to save breaks');
        throw new Error(msg);
      }

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
      <div className="bg-white border-b">
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
                  <div key={slot.id || `slot-${selectedDay}-${slotIdx}`} className="border rounded-lg p-4 bg-gray-50">
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

                    {/* Service Styles - Only role-allowed styles (solo vs business) */}
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-1">Service styles for this slot</p>
                      <p className="text-xs text-gray-500 mb-2">Only your role&apos;s allowed styles are shown</p>
                      <div className="flex flex-wrap gap-2">
                        {SERVICE_STYLES.length > 0 ? (
                          SERVICE_STYLES.map(style => (
                            <button
                              key={`${slotIdx}-${style.id}`}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleServiceStyle(slotIdx, style.id as any);
                              }}
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

                    {/* Location for Solo (at_home only) - Hidden for walker solo */}
                    {isSoloProvider && 
                     slot.serviceStyles.includes('at_home') && 
                     !roleName?.toLowerCase().includes('walker') && (
                      <div className="mb-4 space-y-3">
                        <div>
                          <p className="text-sm text-gray-600 mb-2 flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            Service Location
                          </p>
                          <EnhancedAddressAutocomplete
                            value={slot.locationData?.address || ''}
                            onChange={(address, components) => {
                              updateSlot(slotIdx, {
                                locationData: {
                                  ...slot.locationData,
                                  address,
                                  lat: components?.lat ?? components?.coordinates?.lat,
                                  lng: components?.lng ?? components?.coordinates?.lng,
                                  placeId: components?.placeId,
                                },
                              });
                            }}
                            placeholder="Search for your service location..."
                            className="w-full"
                          />
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Service radius (km) — max distance you travel</p>
                          <Input
                            type="number"
                            min={1}
                            max={50}
                            value={(slot.locationData as any)?.serviceRadiusKm ?? 7}
                            onChange={(e) => updateSlot(slotIdx, {
                              locationData: { ...slot.locationData, serviceRadiusKm: parseInt(e.target.value, 10) || 7 },
                            })}
                            className="h-9 w-24"
                          />
                        </div>
                      </div>
                    )}

                    {/* Lead time (min) per service style - only for styles allowed in this slot */}
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">Lead time (min) per style</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {SERVICE_STYLES.filter(style => slot.serviceStyles.includes(style.id as any)).map(style => (
                          <div key={style.id}>
                            <label className="text-xs text-gray-500 block mb-1">
                              {style.icon} {style.label} — {style.leadLabel}
                            </label>
                            <Input
                              type="number"
                              min={0}
                              max={120}
                              value={slot.leadTimeByStyle?.[style.id as keyof LeadTimeByStyle] ?? DEFAULT_LEAD_TIME_BY_STYLE[style.id as keyof LeadTimeByStyle] ?? 15}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (isNaN(val)) return;
                                updateSlot(slotIdx, {
                                  leadTimeByStyle: {
                                    ...(slot.leadTimeByStyle || {}),
                                    [style.id]: val,
                                  },
                                });
                              }}
                              className="h-9"
                            />
                          </div>
                        ))}
                        {slot.serviceStyles.length === 0 && (
                          <p className="text-sm text-gray-500 col-span-2">Select at least one service style above to set lead time.</p>
                        )}
                      </div>
                    </div>

                    {/* Max Capacity */}
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
