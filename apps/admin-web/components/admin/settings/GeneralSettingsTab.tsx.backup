'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Save, Loader2 } from 'lucide-react';

export function GeneralSettingsTab() {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    platformName: '',
    timezone: '',
    dateFormat: '',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await apiClient.get<any>('/admin/settings/general');
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
      await apiClient.post('/admin/settings/general', { settings });
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Platform Name</label>
          <input
            type="text"
            value={settings.platformName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings(prev => ({ ...prev, platformName: e.target.value }))}
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
          <input
            type="text"
            value={settings.timezone}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings(prev => ({ ...prev, timezone: e.target.value }))}
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
            placeholder="UTC"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date Format</label>
          <input
            type="text"
            value={settings.dateFormat}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings(prev => ({ ...prev, dateFormat: e.target.value }))}
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
            placeholder="DD/MM/YYYY"
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

