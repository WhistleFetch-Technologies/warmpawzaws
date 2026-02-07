'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Save, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface ScheduleSettings {
  slotDuration: number;
  breakDuration: number;
  bufferTime: number;
  maxSlotsPerDay: number;
  allowOverlapping: boolean;
  autoConfirmBookings: boolean;
  defaultWorkingHours: {
    start: string;
    end: string;
  };
}

export function ScheduleSettingsManagement() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ScheduleSettings>({
    slotDuration: 60,
    breakDuration: 15,
    bufferTime: 10,
    maxSlotsPerDay: 10,
    allowOverlapping: false,
    autoConfirmBookings: false,
    defaultWorkingHours: {
      start: '09:00',
      end: '18:00',
    },
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/settings/schedule');
      if (data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Error loading schedule settings:', error);
      alert('Failed to load schedule settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const data = await apiClient.put<any>('/admin/settings/schedule', { settings });
      
      if (data.success) {
        alert('Schedule settings saved successfully');
      } else {
        alert(data.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-0 bg-purple-100 rounded-xl">
            <Clock className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Schedule Settings</h1>
            <p className="text-sm text-gray-600">Configure scheduling parameters</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-3 px-4 py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </button>
      </div>

      <div className="bg-white rounded-xl border-2 border-gray-200 p-0 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">Slot Duration (minutes)</label>
            <input
              type="number"
              min="15"
              step="15"
              value={settings.slotDuration}
              onChange={(e) => setSettings(prev => ({ ...prev, slotDuration: parseInt(e.target.value) }))}
              className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">Break Duration (minutes)</label>
            <input
              type="number"
              min="0"
              value={settings.breakDuration}
              onChange={(e) => setSettings(prev => ({ ...prev, breakDuration: parseInt(e.target.value) }))}
              className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">Buffer Time (minutes)</label>
            <input
              type="number"
              min="0"
              value={settings.bufferTime}
              onChange={(e) => setSettings(prev => ({ ...prev, bufferTime: parseInt(e.target.value) }))}
              className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">Max Slots Per Day</label>
            <input
              type="number"
              min="1"
              value={settings.maxSlotsPerDay}
              onChange={(e) => setSettings(prev => ({ ...prev, maxSlotsPerDay: parseInt(e.target.value) }))}
              className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="font-medium text-gray-900 mb-0">Default Working Hours</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">Start Time</label>
              <input
                type="time"
                value={settings.defaultWorkingHours.start}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  defaultWorkingHours: { ...prev.defaultWorkingHours, start: e.target.value }
                }))}
                className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">End Time</label>
              <input
                type="time"
                value={settings.defaultWorkingHours.end}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  defaultWorkingHours: { ...prev.defaultWorkingHours, end: e.target.value }
                }))}
                className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-4 space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.allowOverlapping}
              onChange={(e) => setSettings(prev => ({ ...prev, allowOverlapping: e.target.checked }))}
              className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
            />
            <span className="text-sm font-medium text-gray-700">Allow Overlapping Bookings</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.autoConfirmBookings}
              onChange={(e) => setSettings(prev => ({ ...prev, autoConfirmBookings: e.target.checked }))}
              className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
            />
            <span className="text-sm font-medium text-gray-700">Auto-confirm Bookings</span>
          </label>
        </div>
      </div>
    </div>
  );
}
