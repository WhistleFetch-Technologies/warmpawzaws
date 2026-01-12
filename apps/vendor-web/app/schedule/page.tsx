'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface TimeSlot {
  day: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface ScheduleConfig {
  id: string;
  vendor_id: string;
  staff_id?: string;
  staff_name?: string;
  schedule_type: 'vendor' | 'staff';
  time_slots: TimeSlot[];
  break_time_start?: string;
  break_time_end?: string;
  slot_duration_minutes: number;
  buffer_minutes: number;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function SchedulePage() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<ScheduleConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleConfig | null>(null);

  useEffect(() => {
    const vendorId = localStorage.getItem('vendorId');
    if (!vendorId) {
      router.push('/onboarding');
      return;
    }
    loadSchedules();
  }, [router]);

  const loadSchedules = async () => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      if (vendorId) {
        // ✅ FIX: Use correct endpoint - GET /vendor/:vendorId/schedule (singular, not plural)
        const response = await apiClient.get<{ schedule: any; totalSlots: number }>(
          `/vendor/${vendorId}/schedule`
        );
        // Convert schedule format (grouped by day_of_week) to ScheduleConfig format
        if (response.schedule && typeof response.schedule === 'object') {
          const scheduleByDay = response.schedule;
          const schedules: ScheduleConfig[] = DAYS.map((day, idx) => ({
            id: `schedule-${idx}`,
            vendor_id: vendorId,
            schedule_type: 'vendor',
            day_of_week: idx,
            time_slots: (scheduleByDay[idx] || []).map((slot: any) => ({
              day: day,
              start_time: slot.time_window_start,
              end_time: slot.time_window_end,
              is_available: slot.is_enabled !== false,
            })),
            slot_duration_minutes: (scheduleByDay[idx]?.[0]?.slot_duration_minutes) || 30,
            buffer_minutes: 10,
          }));
          setSchedules(schedules);
        } else {
          setSchedules([]);
        }
      }
    } catch (err) {
      console.error('Error loading schedules:', err);
      // Set default vendor schedule if none exists
      const vendorId = localStorage.getItem('vendorId');
      setSchedules([{
        id: 'default',
        vendor_id: vendorId || '',
        schedule_type: 'vendor',
        time_slots: DAYS.map(day => ({
          day,
          start_time: '09:00',
          end_time: '18:00',
          is_available: day !== 'Sunday',
        })),
        slot_duration_minutes: 30,
        buffer_minutes: 10,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const saveSchedule = async (schedule: ScheduleConfig) => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      await apiClient.put(`/vendor-schedule/${vendorId}`, {
        scheduleId: schedule.id,
        timeSlots: schedule.time_slots,
        slotDuration: schedule.slot_duration_minutes,
        bufferMinutes: schedule.buffer_minutes,
        breakTimeStart: schedule.break_time_start,
        breakTimeEnd: schedule.break_time_end,
      });
      setEditingSchedule(null);
      loadSchedules();
    } catch (err) {
      console.error('Error saving schedule:', err);
    }
  };

  const updateTimeSlot = (dayIndex: number, field: string, value: any) => {
    if (!editingSchedule) return;
    
    const newSlots = [...editingSchedule.time_slots];
    newSlots[dayIndex] = { ...newSlots[dayIndex], [field]: value };
    setEditingSchedule({ ...editingSchedule, time_slots: newSlots });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header - Match consistency pattern: max-w-7xl mx-auto px-6 py-4 */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-orange-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              {/* ✅ FIX: Match consistency - text-2xl font-bold */}
              <h1 className="text-2xl font-bold text-gray-800">Schedule Management</h1>
              <p className="text-sm text-gray-500 mt-1">Configure your availability and working hours</p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition"
            >
              ← Back
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Match consistency pattern: max-w-7xl mx-auto p-6 or p-8 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">

        {schedules.map((schedule) => (
          <div key={schedule.id} className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  {schedule.schedule_type === 'vendor' ? 'Centre Schedule' : schedule.staff_name}
                </h2>
                <p className="text-sm text-gray-500">
                  {schedule.slot_duration_minutes} min slots • {schedule.buffer_minutes} min buffer
                </p>
              </div>
              <button
                onClick={() => setEditingSchedule(schedule)}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                Edit
              </button>
            </div>

            <div className="space-y-2">
              {schedule.time_slots.map((slot, index) => (
                <div
                  key={slot.day}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    slot.is_available ? 'bg-green-50' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${
                      slot.is_available ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                    <span className="font-medium text-gray-800 w-24">{slot.day}</span>
                  </div>
                  {slot.is_available ? (
                    <span className="text-gray-600">
                      {slot.start_time} - {slot.end_time}
                    </span>
                  ) : (
                    <span className="text-gray-400">Closed</span>
                  )}
                </div>
              ))}
            </div>

            {schedule.break_time_start && (
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-700">
                  ☕ Break: {schedule.break_time_start} - {schedule.break_time_end}
                </p>
              </div>
            )}
          </div>
        ))}
        </div>
      </div>

      {/* Modals - Outside main content wrapper */}
      {/* Edit Modal */}
      {editingSchedule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-semibold mb-4">Edit Schedule</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Slot Duration (mins)</label>
                  <input
                    type="number"
                    value={editingSchedule.slot_duration_minutes}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingSchedule({
                      ...editingSchedule,
                      slot_duration_minutes: parseInt(e.target.value)
                    })}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Buffer (mins)</label>
                  <input
                    type="number"
                    value={editingSchedule.buffer_minutes}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingSchedule({
                      ...editingSchedule,
                      buffer_minutes: parseInt(e.target.value)
                    })}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {editingSchedule.time_slots.map((slot, index) => (
                  <div key={slot.day} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <label className="flex items-center gap-2 w-32">
                      <input
                        type="checkbox"
                        checked={slot.is_available}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateTimeSlot(index, 'is_available', e.target.checked)}
                        className="w-4 h-4 text-orange-500"
                      />
                      <span className="font-medium">{slot.day}</span>
                    </label>
                    <input
                      type="time"
                      value={slot.start_time}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateTimeSlot(index, 'start_time', e.target.value)}
                      disabled={!slot.is_available}
                      className="p-2 border rounded-lg disabled:bg-gray-100"
                    />
                    <span>to</span>
                    <input
                      type="time"
                      value={slot.end_time}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateTimeSlot(index, 'end_time', e.target.value)}
                      disabled={!slot.is_available}
                      className="p-2 border rounded-lg disabled:bg-gray-100"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Break Start</label>
                  <input
                    type="time"
                    value={editingSchedule.break_time_start || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingSchedule({
                      ...editingSchedule,
                      break_time_start: e.target.value
                    })}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Break End</label>
                  <input
                    type="time"
                    value={editingSchedule.break_time_end || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingSchedule({
                      ...editingSchedule,
                      break_time_end: e.target.value
                    })}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setEditingSchedule(null)}
                  className="flex-1 p-3 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => saveSchedule(editingSchedule)}
                  className="flex-1 p-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

