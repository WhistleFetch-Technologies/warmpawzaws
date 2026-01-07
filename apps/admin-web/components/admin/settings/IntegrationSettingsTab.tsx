'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Plug, Save, Loader2 } from 'lucide-react';

export function IntegrationSettingsTab() {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    apiKey: '',
    webhookUrl: '',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await apiClient.get<any>('/admin/settings/integrations');
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
      await apiClient.post('/admin/settings/integrations', { settings });
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
        <div className="flex items-center gap-0 mb-4">
          <Plug className="w-5 h-5 text-orange-600" />
          <h3 className="font-semibold text-gray-900">Integration Settings</h3>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-0">API Key</label>
          <input
            type="password"
            value={settings.apiKey}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
            className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
            placeholder="Enter API key"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-0">Webhook URL</label>
          <input
            type="url"
            value={settings.webhookUrl}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings(prev => ({ ...prev, webhookUrl: e.target.value }))}
            className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
            placeholder="https://example.com/webhook"
          />
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center justify-center gap-0 disabled:opacity-50"
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

