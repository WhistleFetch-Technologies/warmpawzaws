'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Bell, Save, Loader2 } from 'lucide-react';

export function NotificationSettingsTab() {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await apiClient.get<any>('/admin/settings/notifications');
      if (response.success && response.settings) {
        setSettings(response.settings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await apiClient.post('/admin/settings/notifications', { settings });
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error saving settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border-2 border-gray-200 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-orange-600" />
            <span className="font-medium text-gray-900">Email Notifications</span>
          </div>
          <input
            type="checkbox"
            checked={settings.emailNotifications}
            onChange={(e) => setSettings(prev => ({ ...prev, emailNotifications: e.target.checked }))}
            className="w-4 h-4 text-orange-600 rounded"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-900">Push Notifications</span>
          <input
            type="checkbox"
            checked={settings.pushNotifications}
            onChange={(e) => setSettings(prev => ({ ...prev, pushNotifications: e.target.checked }))}
            className="w-4 h-4 text-orange-600 rounded"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-900">SMS Notifications</span>
          <input
            type="checkbox"
            checked={settings.smsNotifications}
            onChange={(e) => setSettings(prev => ({ ...prev, smsNotifications: e.target.checked }))}
            className="w-4 h-4 text-orange-600 rounded"
          />
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="w-5 h-5" />
            Save Settings
          </>
        )}
      </button>
    </div>
  );
}

