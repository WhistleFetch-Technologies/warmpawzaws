/**
 * ========================================
 * STAFF SCHEDULE MANAGEMENT
 * ========================================
 * 
 * Comprehensive scheduling UI for staff/doctors to manage:
 * - Break times (Task 2.1)
 * - Buffer time between appointments (Task 2.2)
 * - Holidays and leave calendar (Task 2.3)
 * 
 * Staff-level only (not clinic-wide)
 * 
 * Created: November 20, 2025
 * Part of: Practo Parity Implementation - Tasks 2.1, 2.2, 2.3
 */

import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit,
  Edit2,
  X,
  Coffee,
  Sun,
  Moon,
  AlertCircle,
  Check,
  Settings,
  Timer,
  Palmtree,
  Save
} from 'lucide-react';
// ✅ FIX: Removed Supabase imports - using API Gateway now
import { toast } from 'sonner';

interface StaffScheduleManagementProps {
  staffId: string;
  staffName: string;
  vendorId: string;
  onClose: () => void;
}

interface Break {
  id: string;
  start: string;
  end: string;
  type: 'lunch' | 'tea' | 'personal' | 'emergency';
  label: string;
  isRecurring: boolean;
  recurringDay?: number; // 0-6 for Sunday-Saturday, undefined for daily
}

interface Holiday {
  id: string;
  date: string;
  type: 'full_day' | 'half_day';
  reason: string;
  isRecurring: boolean;
  recurringDay?: number;
}

interface Preferences {
  slotDuration: number;
  bufferMinutes: number;
  advanceBookingDays: number;
  sameDayBookingCutoff: string;
}

type TabType = 'breaks' | 'buffer' | 'holidays';

const BREAK_TYPES = [
  { value: 'lunch', label: 'Lunch Break', icon: Coffee, color: 'bg-orange-100 text-orange-600' },
  { value: 'tea', label: 'Tea Break', icon: Coffee, color: 'bg-green-100 text-green-600' },
  { value: 'personal', label: 'Personal', icon: Sun, color: 'bg-blue-100 text-blue-600' },
  { value: 'emergency', label: 'Emergency', icon: AlertCircle, color: 'bg-red-100 text-red-600' }
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function StaffScheduleManagement({ staffId, staffName, vendorId, onClose }: StaffScheduleManagementProps) {
  const [activeTab, setActiveTab] = useState<TabType>('breaks');
  const [loading, setLoading] = useState(true);
  
  // Break Management State
  const [breaks, setBreaks] = useState<Break[]>([]);
  const [showAddBreakDialog, setShowAddBreakDialog] = useState(false);
  const [editingBreak, setEditingBreak] = useState<Break | null>(null);
  
  // Buffer & Preferences State
  const [preferences, setPreferences] = useState<Preferences>({
    slotDuration: 30,
    bufferMinutes: 5,
    advanceBookingDays: 30,
    sameDayBookingCutoff: '18:00'
  });
  const [preferencesChanged, setPreferencesChanged] = useState(false);
  
  // Holiday Management State
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [showAddHolidayDialog, setShowAddHolidayDialog] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);

  // ✅ FIX: Use API Gateway URL instead of Supabase
  const getApiBase = () => {
    const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
    if (!API_GATEWAY_URL) {
      throw new Error('API Gateway URL not configured');
    }
    return `${API_GATEWAY_URL}/make-server-3dd53475`;
  };

  useEffect(() => {
    loadScheduleData();
  }, [staffId]);

  const loadScheduleData = async () => {
    try {
      setLoading(true);
      
      const { apiCallJson } = await import('@warmpawz/api-client/http');
      const API_BASE = getApiBase();
      
      // Load breaks
      try {
        const breaksData = await apiCallJson<any>(`${API_BASE}/staff/${staffId}/breaks`);
        if (breaksData.success) {
          setBreaks(breaksData.breaks || []);
        }
      } catch (err) {
        console.warn('[SCHEDULE-MGMT] Failed to load breaks:', err);
      }
      
      // Load preferences
      try {
        const prefsData = await apiCallJson<any>(`${API_BASE}/staff/${staffId}/preferences`);
        if (prefsData.success && prefsData.preferences) {
          setPreferences(prefsData.preferences);
        }
      } catch (err) {
        console.warn('[SCHEDULE-MGMT] Failed to load preferences:', err);
      }
      
      // Load holidays
      try {
        const holidaysData = await apiCallJson<any>(`${API_BASE}/staff/${staffId}/holidays`);
        if (holidaysData.success) {
          setHolidays(holidaysData.holidays || []);
        }
      } catch (err) {
        console.warn('[SCHEDULE-MGMT] Failed to load holidays:', err);
      }
      
    } catch (error) {
      console.error('[SCHEDULE-MGMT] Error loading schedule data:', error);
      toast.error('Failed to load schedule data');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // BREAK MANAGEMENT
  // ============================================

  const handleAddBreak = async (breakData: Partial<Break>) => {
    try {
      const newBreak: Break = {
        id: `break_${Date.now()}`,
        start: breakData.start || '13:00',
        end: breakData.end || '14:00',
        type: breakData.type || 'lunch',
        label: breakData.label || 'Lunch Break',
        isRecurring: breakData.isRecurring || true,
        recurringDay: breakData.recurringDay
      };

      const { apiCallJson } = await import('@warmpawz/api-client/http');
      const API_BASE = getApiBase();
      
      const data = await apiCallJson<any>(
        `${API_BASE}/staff/${staffId}/breaks`,
        {
          method: 'POST',
          body: JSON.stringify({ break: newBreak })
        }
      );

      if (data.success) {
        setBreaks(data.breaks || [...breaks, newBreak]);
        setShowAddBreakDialog(false);
        toast.success('Break added successfully');
      } else {
        toast.error(data.error || data.message || 'Failed to add break');
      }
    } catch (error) {
      console.error('[SCHEDULE-MGMT] Error adding break:', error);
      toast.error('An error occurred');
    }
  };

  const handleUpdateBreak = async (breakId: string, breakData: Partial<Break>) => {
    try {
      const { apiCallJson } = await import('@warmpawz/api-client/http');
      const API_BASE = getApiBase();
      
      const data = await apiCallJson<any>(
        `${API_BASE}/staff/${staffId}/breaks/${breakId}`,
        {
          method: 'PUT',
          body: JSON.stringify({ break: breakData })
        }
      );

      if (data.success) {
        setBreaks(data.breaks || breaks.map(b => b.id === breakId ? { ...b, ...breakData } : b));
        setEditingBreak(null);
        toast.success('Break updated successfully');
      } else {
        toast.error(data.error || data.message || 'Failed to update break');
      }
    } catch (error) {
      console.error('[SCHEDULE-MGMT] Error updating break:', error);
      toast.error('An error occurred');
    }
  };

  const handleDeleteBreak = async (breakId: string) => {
    if (!confirm('Are you sure you want to delete this break?')) return;

    try {
      const { apiCallJson } = await import('@warmpawz/api-client/http');
      const API_BASE = getApiBase();
      
      const data = await apiCallJson<any>(
        `${API_BASE}/staff/${staffId}/breaks/${breakId}`,
        {
          method: 'DELETE'
        }
      );

      if (data.success) {
        setBreaks(data.breaks || breaks.filter(b => b.id !== breakId));
        toast.success('Break deleted successfully');
      } else {
        toast.error(data.error || data.message || 'Failed to delete break');
      }
    } catch (error) {
      console.error('[SCHEDULE-MGMT] Error deleting break:', error);
      toast.error('An error occurred');
    }
  };

  // ============================================
  // BUFFER & PREFERENCES MANAGEMENT
  // ============================================

  const handleSavePreferences = async () => {
    try {
      const { apiCallJson } = await import('@warmpawz/api-client/http');
      const API_BASE = getApiBase();
      
      const data = await apiCallJson<any>(
        `${API_BASE}/staff/${staffId}/preferences`,
        {
          method: 'PUT',
          body: JSON.stringify({ preferences })
        }
      );

      if (data.success) {
        setPreferencesChanged(false);
        toast.success('Preferences saved successfully');
      } else {
        toast.error(data.error || data.message || 'Failed to save preferences');
      }
    } catch (error) {
      console.error('[SCHEDULE-MGMT] Error saving preferences:', error);
      toast.error('An error occurred');
    }
  };

  // ============================================
  // HOLIDAY MANAGEMENT
  // ============================================

  const handleAddHoliday = async (holidayData: Partial<Holiday>) => {
    try {
      const newHoliday: Holiday = {
        id: `holiday_${Date.now()}`,
        date: holidayData.date || new Date().toISOString().split('T')[0],
        type: holidayData.type || 'full_day',
        reason: holidayData.reason || 'Personal leave',
        isRecurring: holidayData.isRecurring || false,
        recurringDay: holidayData.recurringDay
      };

      const { apiCallJson } = await import('@warmpawz/api-client/http');
      const API_BASE = getApiBase();
      
      const data = await apiCallJson<any>(
        `${API_BASE}/staff/${staffId}/holidays`,
        {
          method: 'POST',
          body: JSON.stringify({ holiday: newHoliday })
        }
      );

      if (data.success) {
        setHolidays(data.holidays || [...holidays, newHoliday]);
        setShowAddHolidayDialog(false);
        toast.success('Holiday added successfully');
      } else {
        toast.error(data.error || data.message || 'Failed to add holiday');
      }
    } catch (error) {
      console.error('[SCHEDULE-MGMT] Error adding holiday:', error);
      toast.error('An error occurred');
    }
  };

  const handleDeleteHoliday = async (holidayId: string) => {
    if (!confirm('Are you sure you want to delete this holiday?')) return;

    try {
      const { apiCallJson } = await import('@warmpawz/api-client/http');
      const API_BASE = getApiBase();
      
      const data = await apiCallJson<any>(
        `${API_BASE}/staff/${staffId}/holidays/${holidayId}`,
        {
          method: 'DELETE'
        }
      );

      if (data.success) {
        setHolidays(data.holidays || holidays.filter(h => h.id !== holidayId));
        toast.success('Holiday deleted successfully');
      } else {
        toast.error(data.error || data.message || 'Failed to delete holiday');
      }
    } catch (error) {
      console.error('[SCHEDULE-MGMT] Error deleting holiday:', error);
      toast.error('An error occurred');
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-[430px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#FF8C42] text-white p-4 rounded-t-lg flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Settings className="w-6 h-6" />
              <h2 className="text-xl font-bold">Schedule Management</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-white/90">Dr. {staffName}</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            onClick={() => setActiveTab('breaks')}
            className={`flex-1 py-3 px-4 font-medium transition-colors ${
              activeTab === 'breaks'
                ? 'bg-white text-[#FF8C42] border-b-2 border-[#FF8C42]'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Coffee className="w-4 h-4 inline mr-2" />
            Breaks
          </button>
          <button
            onClick={() => setActiveTab('buffer')}
            className={`flex-1 py-3 px-4 font-medium transition-colors ${
              activeTab === 'buffer'
                ? 'bg-white text-[#FF8C42] border-b-2 border-[#FF8C42]'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Timer className="w-4 h-4 inline mr-2" />
            Buffer Time
          </button>
          <button
            onClick={() => setActiveTab('holidays')}
            className={`flex-1 py-3 px-4 font-medium transition-colors ${
              activeTab === 'holidays'
                ? 'bg-white text-[#FF8C42] border-b-2 border-[#FF8C42]'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Palmtree className="w-4 h-4 inline mr-2" />
            Holidays
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42]"></div>
            </div>
          ) : (
            <>
              {/* BREAKS TAB */}
              {activeTab === 'breaks' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold">Break Times</h3>
                      <p className="text-sm text-gray-600">Manage your daily breaks and time-offs</p>
                    </div>
                    <Button
                      onClick={() => setShowAddBreakDialog(true)}
                      className="bg-[#FF8C42] hover:bg-[#FF7A29] text-white"
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Break
                    </Button>
                  </div>

                  {breaks.length === 0 ? (
                    <Card className="p-8 text-center border-2 border-dashed">
                      <Coffee className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-600 mb-2">No breaks configured</p>
                      <p className="text-sm text-gray-500">Add break times to manage your schedule better</p>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {breaks.map(breakItem => {
                        const breakType = BREAK_TYPES.find(t => t.value === breakItem.type) || BREAK_TYPES[0];
                        const BreakIcon = breakType.icon;
                        
                        return (
                          <Card key={breakItem.id} className="p-4 border-2 hover:border-[#FF8C42] transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${breakType.color}`}>
                                    <BreakIcon className="w-3 h-3" />
                                    {breakType.label}
                                  </span>
                                  {breakItem.isRecurring && (
                                    <Badge variant="outline" className="text-xs">
                                      {breakItem.recurringDay !== undefined
                                        ? DAY_NAMES[breakItem.recurringDay]
                                        : 'Daily'}
                                    </Badge>
                                  )}
                                </div>
                                <p className="font-medium">{breakItem.label}</p>
                                <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                                  <Clock className="w-4 h-4" />
                                  <span>{breakItem.start} - {breakItem.end}</span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setEditingBreak(breakItem)}
                                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                                >
                                  <Edit2 className="w-4 h-4 text-gray-600" />
                                </button>
                                <button
                                  onClick={() => handleDeleteBreak(breakItem.id)}
                                  className="p-2 hover:bg-red-50 rounded transition-colors"
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </button>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* BUFFER TAB */}
              {activeTab === 'buffer' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold mb-1">Appointment Preferences</h3>
                    <p className="text-sm text-gray-600">Configure slot duration, buffer time, and booking settings</p>
                  </div>

                  <Card className="p-4 border-2">
                    <div className="space-y-4">
                      {/* Slot Duration */}
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          <Clock className="w-4 h-4 inline mr-1" />
                          Slot Duration (minutes)
                        </label>
                        <Input
                          type="number"
                          value={preferences.slotDuration}
                          onChange={(e) => {
                            setPreferences({ ...preferences, slotDuration: parseInt(e.target.value) || 30 });
                            setPreferencesChanged(true);
                          }}
                          min={15}
                          max={120}
                          step={15}
                          className="w-full"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Duration of each appointment slot
                        </p>
                      </div>

                      {/* Buffer Time */}
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          <Timer className="w-4 h-4 inline mr-1" />
                          Buffer Time Between Appointments (minutes)
                        </label>
                        <Input
                          type="number"
                          value={preferences.bufferMinutes}
                          onChange={(e) => {
                            setPreferences({ ...preferences, bufferMinutes: parseInt(e.target.value) || 0 });
                            setPreferencesChanged(true);
                          }}
                          min={0}
                          max={30}
                          step={5}
                          className="w-full"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Time gap between consecutive appointments for preparation
                        </p>
                      </div>

                      {/* Advance Booking Days */}
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          <Calendar className="w-4 h-4 inline mr-1" />
                          Advance Booking Window (days)
                        </label>
                        <Input
                          type="number"
                          value={preferences.advanceBookingDays}
                          onChange={(e) => {
                            setPreferences({ ...preferences, advanceBookingDays: parseInt(e.target.value) || 30 });
                            setPreferencesChanged(true);
                          }}
                          min={7}
                          max={90}
                          step={7}
                          className="w-full"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          How far in advance customers can book
                        </p>
                      </div>

                      {/* Same-day Cutoff */}
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          <Moon className="w-4 h-4 inline mr-1" />
                          Same-day Booking Cutoff Time
                        </label>
                        <Input
                          type="time"
                          value={preferences.sameDayBookingCutoff}
                          onChange={(e) => {
                            setPreferences({ ...preferences, sameDayBookingCutoff: e.target.value });
                            setPreferencesChanged(true);
                          }}
                          className="w-full"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Last time customers can book for same day
                        </p>
                      </div>
                    </div>
                  </Card>

                  {preferencesChanged && (
                    <Button
                      onClick={handleSavePreferences}
                      className="w-full bg-[#FF8C42] hover:bg-[#FF7A29] text-white"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Preferences
                    </Button>
                  )}

                  {/* Info Card */}
                  <Card className="p-4 bg-blue-50 border-blue-200">
                    <div className="flex gap-3">
                      <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">How buffer time works:</p>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                          <li>Buffer time is added after each appointment</li>
                          <li>Gives you time to prepare for the next patient</li>
                          <li>Prevents back-to-back appointments</li>
                          <li>Example: 30min slot + 5min buffer = 35min total</li>
                        </ul>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* HOLIDAYS TAB */}
              {activeTab === 'holidays' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold">Holidays & Leave</h3>
                      <p className="text-sm text-gray-600">Mark days when you're unavailable</p>
                    </div>
                    <Button
                      onClick={() => setShowAddHolidayDialog(true)}
                      className="bg-[#FF8C42] hover:bg-[#FF7A29] text-white"
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Holiday
                    </Button>
                  </div>

                  {holidays.length === 0 ? (
                    <Card className="p-8 text-center border-2 border-dashed">
                      <Palmtree className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-600 mb-2">No holidays configured</p>
                      <p className="text-sm text-gray-500">Add holidays to block off unavailable dates</p>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {holidays.sort((a, b) => a.date.localeCompare(b.date)).map(holiday => (
                        <Card key={holiday.id} className="p-4 border-2 hover:border-[#FF8C42] transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                                  holiday.type === 'full_day'
                                    ? 'bg-red-100 text-red-600'
                                    : 'bg-yellow-100 text-yellow-600'
                                }`}>
                                  <Palmtree className="w-3 h-3" />
                                  {holiday.type === 'full_day' ? 'Full Day' : 'Half Day'}
                                </span>
                                {holiday.isRecurring && (
                                  <Badge variant="outline" className="text-xs">
                                    {holiday.recurringDay !== undefined
                                      ? `Every ${DAY_NAMES[holiday.recurringDay]}`
                                      : 'Recurring'}
                                  </Badge>
                                )}
                              </div>
                              <p className="font-medium">{holiday.reason}</p>
                              <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                                <Calendar className="w-4 h-4" />
                                <span>
                                  {holiday.isRecurring
                                    ? `Every ${DAY_NAMES[holiday.recurringDay || 0]}`
                                    : new Date(holiday.date).toLocaleDateString('en-IN', {
                                        weekday: 'short',
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric'
                                      })}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteHoliday(holiday.id)}
                              className="p-2 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Add Break Dialog */}
        <AddBreakDialog
          open={showAddBreakDialog}
          onClose={() => setShowAddBreakDialog(false)}
          onAdd={handleAddBreak}
        />

        {/* Edit Break Dialog */}
        {editingBreak && (
          <EditBreakDialog
            break={editingBreak}
            onClose={() => setEditingBreak(null)}
            onUpdate={(data) => handleUpdateBreak(editingBreak.id, data)}
          />
        )}

        {/* Add Holiday Dialog */}
        <AddHolidayDialog
          open={showAddHolidayDialog}
          onClose={() => setShowAddHolidayDialog(false)}
          onAdd={handleAddHoliday}
        />
      </div>
    </div>
  );
}

// ============================================
// ADD BREAK DIALOG
// ============================================

interface AddBreakDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (breakData: Partial<Break>) => void;
}

function AddBreakDialog({ open, onClose, onAdd }: AddBreakDialogProps) {
  const [formData, setFormData] = useState<Partial<Break>>({
    type: 'lunch',
    label: 'Lunch Break',
    start: '13:00',
    end: '14:00',
    isRecurring: true,
    recurringDay: undefined
  });

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Add Break Time</DialogTitle>
          <DialogDescription>Configure a new break period in your schedule</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="block text-sm font-medium mb-2">Break Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as Break['type'] })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              {BREAK_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Label</label>
            <Input
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="e.g., Lunch Break"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-2">Start Time</label>
              <Input
                type="time"
                value={formData.start}
                onChange={(e) => setFormData({ ...formData, start: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">End Time</label>
              <Input
                type="time"
                value={formData.end}
                onChange={(e) => setFormData({ ...formData, end: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isRecurring}
                onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                className="accent-[#FF8C42]"
              />
              <span className="text-sm">Recurring break</span>
            </label>
          </div>

          {formData.isRecurring && (
            <div>
              <label className="block text-sm font-medium mb-2">Recurrence</label>
              <select
                value={formData.recurringDay ?? ''}
                onChange={(e) => setFormData({
                  ...formData,
                  recurringDay: e.target.value === '' ? undefined : parseInt(e.target.value)
                })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="">Every Day</option>
                {DAY_NAMES.map((day, index) => (
                  <option key={index} value={index}>Every {day}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onAdd(formData)}
            className="bg-[#FF8C42] hover:bg-[#FF7A29] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Break
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// EDIT BREAK DIALOG
// ============================================

interface EditBreakDialogProps {
  break: Break;
  onClose: () => void;
  onUpdate: (breakData: Partial<Break>) => void;
}

function EditBreakDialog({ break: breakItem, onClose, onUpdate }: EditBreakDialogProps) {
  const [formData, setFormData] = useState<Partial<Break>>({ ...breakItem });

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Edit Break Time</DialogTitle>
          <DialogDescription>Update break period details</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="block text-sm font-medium mb-2">Break Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as Break['type'] })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              {BREAK_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Label</label>
            <Input
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-2">Start Time</label>
              <Input
                type="time"
                value={formData.start}
                onChange={(e) => setFormData({ ...formData, start: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">End Time</label>
              <Input
                type="time"
                value={formData.end}
                onChange={(e) => setFormData({ ...formData, end: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isRecurring}
                onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                className="accent-[#FF8C42]"
              />
              <span className="text-sm">Recurring break</span>
            </label>
          </div>

          {formData.isRecurring && (
            <div>
              <label className="block text-sm font-medium mb-2">Recurrence</label>
              <select
                value={formData.recurringDay ?? ''}
                onChange={(e) => setFormData({
                  ...formData,
                  recurringDay: e.target.value === '' ? undefined : parseInt(e.target.value)
                })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="">Every Day</option>
                {DAY_NAMES.map((day, index) => (
                  <option key={index} value={index}>Every {day}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onUpdate(formData)}
            className="bg-[#FF8C42] hover:bg-[#FF7A29] text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// ADD HOLIDAY DIALOG
// ============================================

interface AddHolidayDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (holidayData: Partial<Holiday>) => void;
}

function AddHolidayDialog({ open, onClose, onAdd }: AddHolidayDialogProps) {
  const [formData, setFormData] = useState<Partial<Holiday>>({
    date: new Date().toISOString().split('T')[0],
    type: 'full_day',
    reason: '',
    isRecurring: false,
    recurringDay: undefined
  });

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Add Holiday/Leave</DialogTitle>
          <DialogDescription>Mark a day when you'll be unavailable</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="block text-sm font-medium mb-2">Date</label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as Holiday['type'] })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="full_day">Full Day</option>
              <option value="half_day">Half Day</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Reason</label>
            <Input
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="e.g., Personal leave, Conference, Vacation"
            />
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isRecurring}
                onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                className="accent-[#FF8C42]"
              />
              <span className="text-sm">Recurring holiday (e.g., every Sunday)</span>
            </label>
          </div>

          {formData.isRecurring && (
            <div>
              <label className="block text-sm font-medium mb-2">Recurrence</label>
              <select
                value={formData.recurringDay ?? ''}
                onChange={(e) => setFormData({
                  ...formData,
                  recurringDay: e.target.value === '' ? undefined : parseInt(e.target.value)
                })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="">Select Day</option>
                {DAY_NAMES.map((day, index) => (
                  <option key={index} value={index}>Every {day}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onAdd(formData)}
            className="bg-[#FF8C42] hover:bg-[#FF7A29] text-white"
            disabled={!formData.reason}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Holiday
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}