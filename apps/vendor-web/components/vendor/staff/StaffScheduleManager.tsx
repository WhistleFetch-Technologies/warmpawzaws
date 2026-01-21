'use client';

/**
 * STAFF SCHEDULE MANAGER
 * 
 * Allows businesses to manage individual staff schedules with:
 * - Multi-service style support per staff member
 * - Breaks and holidays
 * - Buffer times
 * - Service radius for home services
 * - Integration with business operating hours
 */

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Plus,
  User,
  Building,
  Home,
  Video,
  Coffee,
  Settings,
  Save,
  Trash2,
  X,
  ChevronRight,
  AlertCircle,
  Briefcase,
  MapPin
} from 'lucide-react';

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  roleId: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  isActive: boolean;
  serviceStyles: string[];
  services: StaffService[];
}

interface StaffService {
  serviceId: string;
  serviceName: string;
  serviceStyle: string;
  duration: number;
  enabled: boolean;
}

interface StaffSchedule {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  serviceStyles: {
    style: string;
    slotDuration: number;
    bufferTime: number;
    radiusKm?: number;
  }[];
  isAvailable: boolean;
}

interface StaffBreak {
  id: string;
  startTime: string;
  endTime: string;
  name: string;
  dayOfWeek?: number;
  breakDate?: string;
}

interface StaffHoliday {
  id: string;
  date: string;
  name: string;
}

interface StaffScheduleManagerProps {
  vendorId: string;
  onBack: () => void;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function StaffScheduleManager({ vendorId, onBack }: StaffScheduleManagerProps) {
  const [loading, setLoading] = useState(true);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [schedules, setSchedules] = useState<StaffSchedule[]>([]);
  const [breaks, setBreaks] = useState<StaffBreak[]>([]);
  const [holidays, setHolidays] = useState<StaffHoliday[]>([]);
  const [saving, setSaving] = useState(false);
  
  // Modal states
  const [showAddBreak, setShowAddBreak] = useState(false);
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  
  // Form states
  const [newBreak, setNewBreak] = useState({ startTime: '13:00', endTime: '14:00', name: 'Lunch Break' });
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' });

  useEffect(() => {
    loadStaffMembers();
  }, [vendorId]);

  useEffect(() => {
    if (selectedStaff) {
      loadStaffSchedule(selectedStaff.id);
    }
  }, [selectedStaff?.id]);

  const loadStaffMembers = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get(`/vendor/${vendorId}/staff`) as any;
      
      if (data && data.staff) {
        setStaffMembers(data.staff.map((s: any) => ({
          id: s.id,
          firstName: s.first_name || s.firstName,
          lastName: s.last_name || s.lastName,
          role: s.role || s.role_name,
          roleId: s.role_id || s.roleId,
          email: s.email,
          phone: s.phone,
          avatarUrl: s.avatar_url,
          isActive: s.is_active !== false,
          serviceStyles: s.service_styles || [],
          services: s.services || []
        })));
      }
    } catch (error) {
      console.error('Error loading staff:', error);
      toast.error('Failed to load staff members');
    } finally {
      setLoading(false);
    }
  };

  const loadStaffSchedule = async (staffId: string) => {
    try {
      const data = await apiClient.get(`/staff/${staffId}/schedule`) as any;
      
      if (data && data.success) {
        // Convert schedule format
        const scheduleByDay: StaffSchedule[] = DAY_NAMES.map((_, index) => {
          const daySlots = data.schedule?.[index] || [];
          
          if (daySlots.length === 0) {
            return {
              dayOfWeek: index,
              startTime: '09:00',
              endTime: '18:00',
              serviceStyles: [],
              isAvailable: false
            };
          }
          
          // Group by time window and extract service styles
          const firstSlot = daySlots[0];
          const lastSlot = daySlots[daySlots.length - 1];
          
          const styleConfigs = daySlots.reduce((acc: any[], slot: any) => {
            const existing = acc.find(s => s.style === slot.service_style);
            if (!existing) {
              acc.push({
                style: slot.service_style || 'at_center',
                slotDuration: slot.slot_duration_minutes || 30,
                bufferTime: slot.buffer_time_minutes || 15,
                radiusKm: slot.radius_km
              });
            }
            return acc;
          }, []);
          
          return {
            dayOfWeek: index,
            startTime: firstSlot.start_time || '09:00',
            endTime: lastSlot.end_time || '18:00',
            serviceStyles: styleConfigs,
            isAvailable: true
          };
        });
        
        setSchedules(scheduleByDay);
        setBreaks(data.breaks || []);
        setHolidays(data.holidays || []);
      }
    } catch (error) {
      console.error('Error loading staff schedule:', error);
      // Initialize empty schedule
      setSchedules(DAY_NAMES.map((_, index) => ({
        dayOfWeek: index,
        startTime: '09:00',
        endTime: '18:00',
        serviceStyles: [],
        isAvailable: index >= 1 && index <= 5 // Mon-Fri
      })));
    }
  };

  const saveSchedule = async () => {
    if (!selectedStaff) return;
    
    try {
      setSaving(true);
      
      // Convert to backend format
      const slots: any[] = [];
      
      schedules.forEach(day => {
        if (!day.isAvailable || day.serviceStyles.length === 0) return;
        
        day.serviceStyles.forEach(styleConfig => {
          slots.push({
            day_of_week: day.dayOfWeek,
            start_time: day.startTime,
            end_time: day.endTime,
            service_style: styleConfig.style,
            slot_duration_minutes: styleConfig.slotDuration,
            buffer_time_minutes: styleConfig.bufferTime,
            radius_km: styleConfig.radiusKm,
            is_available: true
          });
        });
      });
      
      const result = await apiClient.post(`/staff/${selectedStaff.id}/schedule`, {
        slots,
        breaks: breaks.map(b => ({
          start_time: b.startTime,
          end_time: b.endTime,
          break_type: b.name,
          day_of_week: b.dayOfWeek,
          break_date: b.breakDate
        })),
        holidays: holidays.map(h => ({
          holiday_date: h.date,
          holiday_name: h.name
        }))
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

  const toggleDayAvailability = (dayIndex: number) => {
    setSchedules(prev => prev.map((s, i) => 
      i === dayIndex ? { ...s, isAvailable: !s.isAvailable } : s
    ));
  };

  const updateDayTime = (dayIndex: number, field: 'startTime' | 'endTime', value: string) => {
    setSchedules(prev => prev.map((s, i) => 
      i === dayIndex ? { ...s, [field]: value } : s
    ));
  };

  const toggleServiceStyle = (dayIndex: number, style: string) => {
    setSchedules(prev => prev.map((s, i) => {
      if (i !== dayIndex) return s;
      
      const existing = s.serviceStyles.find(ss => ss.style === style);
      if (existing) {
        return { ...s, serviceStyles: s.serviceStyles.filter(ss => ss.style !== style) };
      } else {
        return {
          ...s,
          serviceStyles: [...s.serviceStyles, {
            style,
            slotDuration: 30,
            bufferTime: style === 'at_home' ? 30 : style === 'tele' ? 5 : 15,
            radiusKm: style === 'at_home' ? 10 : undefined
          }]
        };
      }
    }));
  };

  const addBreak = () => {
    if (!newBreak.startTime || !newBreak.endTime) {
      toast.error('Please set break times');
      return;
    }
    
    const breakItem: StaffBreak = {
      id: `break_${Date.now()}`,
      startTime: newBreak.startTime,
      endTime: newBreak.endTime,
      name: newBreak.name || 'Break',
      dayOfWeek: selectedDay !== null ? selectedDay : undefined
    };
    
    setBreaks(prev => [...prev, breakItem]);
    setShowAddBreak(false);
    setNewBreak({ startTime: '13:00', endTime: '14:00', name: 'Lunch Break' });
    setSelectedDay(null);
    toast.success('Break added');
  };

  const removeBreak = (breakId: string) => {
    setBreaks(prev => prev.filter(b => b.id !== breakId));
  };

  const addHoliday = () => {
    if (!newHoliday.date) {
      toast.error('Please select a date');
      return;
    }
    
    const holidayItem: StaffHoliday = {
      id: `holiday_${Date.now()}`,
      date: newHoliday.date,
      name: newHoliday.name || 'Day Off'
    };
    
    setHolidays(prev => [...prev, holidayItem]);
    setShowAddHoliday(false);
    setNewHoliday({ date: '', name: '' });
    toast.success('Holiday added');
  };

  const removeHoliday = (holidayId: string) => {
    setHolidays(prev => prev.filter(h => h.id !== holidayId));
  };

  const getServiceStyleIcon = (style: string) => {
    switch (style) {
      case 'at_center': return Building;
      case 'at_home': return Home;
      case 'tele': return Video;
      default: return Briefcase;
    }
  };

  const getServiceStyleLabel = (style: string) => {
    switch (style) {
      case 'at_center': return 'Clinic';
      case 'at_home': return 'Home';
      case 'tele': return 'Tele';
      default: return style;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600">Loading staff...</p>
        </div>
      </div>
    );
  }

  // Staff List View
  if (!selectedStaff) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b sticky top-0 z-20">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Staff Schedules</h1>
                <p className="text-sm text-gray-500">
                  Manage schedules for your team members
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6">
          {staffMembers.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center">
              <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">No Staff Members</h3>
              <p className="text-gray-500 mb-4">
                Add staff members first to manage their schedules.
              </p>
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Staff Member
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {staffMembers.map(staff => (
                <div
                  key={staff.id}
                  className="bg-white rounded-xl border p-4 hover:border-orange-300 cursor-pointer transition-all"
                  onClick={() => setSelectedStaff(staff)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                        {staff.avatarUrl ? (
                          <img
                            src={staff.avatarUrl}
                            alt={`${staff.firstName} ${staff.lastName}`}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <User className="w-6 h-6 text-orange-600" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {staff.firstName} {staff.lastName}
                        </h3>
                        <p className="text-sm text-gray-500">{staff.role}</p>
                        <div className="flex gap-1 mt-1">
                          {staff.serviceStyles.map(style => {
                            const Icon = getServiceStyleIcon(style);
                            return (
                              <Badge key={style} variant="secondary" className="text-xs">
                                <Icon className="w-3 h-3 mr-1" />
                                {getServiceStyleLabel(style)}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {!staff.isActive && (
                        <Badge variant="outline" className="text-red-600 border-red-200">
                          Inactive
                        </Badge>
                      )}
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Schedule Edit View
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => setSelectedStaff(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    {selectedStaff.firstName} {selectedStaff.lastName}
                  </h1>
                  <p className="text-sm text-gray-500">{selectedStaff.role}</p>
                </div>
              </div>
            </div>
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

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Weekly Schedule */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-orange-500" />
              Weekly Schedule
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                setSelectedDay(null);
                setShowAddBreak(true);
              }}>
                <Coffee className="w-4 h-4 mr-1" />
                Add Break
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowAddHoliday(true)}>
                <Calendar className="w-4 h-4 mr-1" />
                Add Holiday
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {schedules.map((schedule, dayIndex) => (
              <div
                key={dayIndex}
                className={`border rounded-lg p-4 ${
                  schedule.isAvailable ? 'bg-white' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Day Toggle */}
                  <div className="flex items-center gap-3 min-w-[120px]">
                    <input
                      type="checkbox"
                      checked={schedule.isAvailable}
                      onChange={() => toggleDayAvailability(dayIndex)}
                      className="w-4 h-4 rounded border-gray-300 text-orange-500"
                    />
                    <span className={`font-medium ${schedule.isAvailable ? 'text-gray-900' : 'text-gray-400'}`}>
                      {DAY_NAMES[dayIndex]}
                    </span>
                  </div>

                  {schedule.isAvailable && (
                    <>
                      {/* Time Range */}
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={schedule.startTime}
                          onChange={(e) => updateDayTime(dayIndex, 'startTime', e.target.value)}
                          className="px-2 py-1 text-sm border rounded"
                        />
                        <span className="text-gray-400">to</span>
                        <input
                          type="time"
                          value={schedule.endTime}
                          onChange={(e) => updateDayTime(dayIndex, 'endTime', e.target.value)}
                          className="px-2 py-1 text-sm border rounded"
                        />
                      </div>

                      {/* Service Styles */}
                      <div className="flex items-center gap-2 flex-1">
                        {(['at_center', 'at_home', 'tele'] as const).map(style => {
                          const Icon = getServiceStyleIcon(style);
                          const isEnabled = schedule.serviceStyles.some(s => s.style === style);
                          return (
                            <button
                              key={style}
                              onClick={() => toggleServiceStyle(dayIndex, style)}
                              className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 text-sm font-medium transition-all ${
                                isEnabled
                                  ? style === 'at_center' 
                                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                    : style === 'at_home'
                                    ? 'bg-green-100 text-green-700 border border-green-300'
                                    : 'bg-purple-100 text-purple-700 border border-purple-300'
                                  : 'bg-gray-100 text-gray-400 border border-gray-200'
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                              {getServiceStyleLabel(style)}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* Breaks for this day */}
                {schedule.isAvailable && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {breaks
                      .filter(b => b.dayOfWeek === dayIndex)
                      .map(brk => (
                        <div
                          key={brk.id}
                          className="flex items-center gap-2 px-2 py-1 bg-amber-50 border border-amber-200 rounded-full text-sm"
                        >
                          <Coffee className="w-3 h-3 text-amber-600" />
                          <span className="text-amber-800">
                            {brk.name}: {brk.startTime} - {brk.endTime}
                          </span>
                          <button
                            onClick={() => removeBreak(brk.id)}
                            className="p-0.5 hover:bg-amber-100 rounded-full"
                          >
                            <X className="w-3 h-3 text-amber-600" />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Holidays */}
        {holidays.length > 0 && (
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-red-500" />
              Holidays & Days Off
            </h2>
            <div className="space-y-2">
              {holidays.map(holiday => (
                <div
                  key={holiday.id}
                  className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{holiday.name}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(holiday.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => removeHoliday(holiday.id)}
                    className="p-2 hover:bg-red-100 rounded-lg text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Apply to Day</label>
                <select
                  value={selectedDay ?? ''}
                  onChange={(e) => setSelectedDay(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">All Days</option>
                  {DAY_NAMES.map((day, i) => (
                    <option key={i} value={i}>{day}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Start Time</label>
                  <input
                    type="time"
                    value={newBreak.startTime}
                    onChange={(e) => setNewBreak({ ...newBreak, startTime: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">End Time</label>
                  <input
                    type="time"
                    value={newBreak.endTime}
                    onChange={(e) => setNewBreak({ ...newBreak, endTime: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
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
                  placeholder="e.g., Personal Day, Public Holiday"
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
    </div>
  );
}

export default StaffScheduleManager;
