/**
 * Logistics Integration Settings (Shiprocket, Delhivery, BlueDart)
 * Admin component for configuring logistics provider credentials
 */

import React, { useState, useEffect } from 'react';
import { Save, Check, AlertCircle, Truck, MapPin } from 'lucide-react';

interface LogisticsSettings {
  shiprocket: {
    enabled: boolean;
    email: string;
    password: string;
    auto_awb: boolean;
    auto_pickup: boolean;
    test_mode: boolean;
  };
  delhivery: {
    enabled: boolean;
    api_key: string;
    test_mode: boolean;
  };
  bluedart: {
    enabled: boolean;
    username: string;
    password: string;
    test_mode: boolean;
  };
  default_provider: string;
  warehouse_address: {
    name?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    phone?: string;
  };
}

export default function LogisticsIntegration() {
  const [settings, setSettings] = useState<LogisticsSettings>({
    shiprocket: {
      enabled: false,
      email: '',
      password: '',
      auto_awb: true,
      auto_pickup: true,
      test_mode: true
    },
    delhivery: {
      enabled: false,
      api_key: '',
      test_mode: true
    },
    bluedart: {
      enabled: false,
      username: '',
      password: '',
      test_mode: true
    },
    default_provider: 'shiprocket',
    warehouse_address: {}
  });

  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState<'shiprocket' | 'delhivery' | 'bluedart'>('shiprocket');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        'https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/admin/settings/logistics',
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('supabase_token')}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaveStatus('saving');
      
      const response = await fetch(
        'https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/admin/settings/logistics',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('supabase_token')}`
          },
          body: JSON.stringify(settings)
        }
      );

      if (response.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveStatus('error');
    }
  };

  const updateShiprocket = (key: string, value: any) => {
    setSettings({
      ...settings,
      shiprocket: {
        ...settings.shiprocket,
        [key]: value
      }
    });
  };

  const updateDelhivery = (key: string, value: any) => {
    setSettings({
      ...settings,
      delhivery: {
        ...settings.delhivery,
        [key]: value
      }
    });
  };

  const updateBluedart = (key: string, value: any) => {
    setSettings({
      ...settings,
      bluedart: {
        ...settings.bluedart,
        [key]: value
      }
    });
  };

  const updateWarehouse = (key: string, value: string) => {
    setSettings({
      ...settings,
      warehouse_address: {
        ...settings.warehouse_address,
        [key]: value
      }
    });
  };

  if (loading) {
    return <div className="p-8 text-center">Loading settings...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <Truck className="w-6 h-6 text-green-600" />
          <h2 className="text-2xl font-bold">Logistics Integration</h2>
        </div>
        <p className="text-gray-600">
          Configure your logistics providers for order fulfillment and delivery tracking.
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <div className="flex gap-4 px-6">
            <button
              onClick={() => setActiveTab('shiprocket')}
              className={`py-4 px-4 border-b-2 transition-colors ${
                activeTab === 'shiprocket'
                  ? 'border-green-600 text-green-600 font-medium'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Shiprocket
              {settings.shiprocket.enabled && (
                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('delhivery')}
              className={`py-4 px-4 border-b-2 transition-colors ${
                activeTab === 'delhivery'
                  ? 'border-green-600 text-green-600 font-medium'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Delhivery
              {settings.delhivery.enabled && (
                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('bluedart')}
              className={`py-4 px-4 border-b-2 transition-colors ${
                activeTab === 'bluedart'
                  ? 'border-green-600 text-green-600 font-medium'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              BlueDart
              {settings.bluedart.enabled && (
                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Shiprocket Settings */}
          {activeTab === 'shiprocket' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <div>
                  <h3 className="font-medium text-green-900">Shiprocket Integration</h3>
                  <p className="text-sm text-green-700">
                    Login to{' '}
                    <a
                      href="https://app.shiprocket.in/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Shiprocket Dashboard
                    </a>
                    {' '}to get your credentials
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.shiprocket.enabled}
                    onChange={(e) => updateShiprocket('enabled', e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <span className="font-medium">Enable</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={settings.shiprocket.email}
                  onChange={(e) => updateShiprocket('email', e.target.value)}
                  placeholder="your-email@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={settings.shiprocket.password}
                  onChange={(e) => updateShiprocket('password', e.target.value)}
                  placeholder="Your Shiprocket password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.shiprocket.auto_awb}
                    onChange={(e) => updateShiprocket('auto_awb', e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm">Auto-generate AWB</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.shiprocket.auto_pickup}
                    onChange={(e) => updateShiprocket('auto_pickup', e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm">Auto-schedule pickup</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.shiprocket.test_mode}
                    onChange={(e) => updateShiprocket('test_mode', e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm">Test mode</span>
                </label>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Webhook URL:</strong> https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/logistics/shiprocket/webhook
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Configure this in Shiprocket Settings → Webhooks
                </p>
              </div>
            </div>
          )}

          {/* Delhivery Settings */}
          {activeTab === 'delhivery' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                <div>
                  <h3 className="font-medium text-red-900">Delhivery Integration</h3>
                  <p className="text-sm text-red-700">
                    Get your API key from Delhivery Dashboard
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.delhivery.enabled}
                    onChange={(e) => updateDelhivery('enabled', e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <span className="font-medium">Enable</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={settings.delhivery.api_key}
                  onChange={(e) => updateDelhivery('api_key', e.target.value)}
                  placeholder="Your Delhivery API key"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.delhivery.test_mode}
                  onChange={(e) => updateDelhivery('test_mode', e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm">Test mode</span>
              </label>
            </div>
          )}

          {/* BlueDart Settings */}
          {activeTab === 'bluedart' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div>
                  <h3 className="font-medium text-blue-900">BlueDart Integration</h3>
                  <p className="text-sm text-blue-700">
                    Get your credentials from BlueDart portal
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.bluedart.enabled}
                    onChange={(e) => updateBluedart('enabled', e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <span className="font-medium">Enable</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={settings.bluedart.username}
                  onChange={(e) => updateBluedart('username', e.target.value)}
                  placeholder="Your BlueDart username"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={settings.bluedart.password}
                  onChange={(e) => updateBluedart('password', e.target.value)}
                  placeholder="Your BlueDart password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.bluedart.test_mode}
                  onChange={(e) => updateBluedart('test_mode', e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm">Test mode</span>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Warehouse Address */}
      <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-bold">Warehouse Address</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Warehouse Name
            </label>
            <input
              type="text"
              value={settings.warehouse_address.name || ''}
              onChange={(e) => updateWarehouse('name', e.target.value)}
              placeholder="Main Warehouse"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address
            </label>
            <input
              type="text"
              value={settings.warehouse_address.address || ''}
              onChange={(e) => updateWarehouse('address', e.target.value)}
              placeholder="123 Industrial Area"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              City
            </label>
            <input
              type="text"
              value={settings.warehouse_address.city || ''}
              onChange={(e) => updateWarehouse('city', e.target.value)}
              placeholder="Bangalore"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              State
            </label>
            <input
              type="text"
              value={settings.warehouse_address.state || ''}
              onChange={(e) => updateWarehouse('state', e.target.value)}
              placeholder="Karnataka"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pincode
            </label>
            <input
              type="text"
              value={settings.warehouse_address.pincode || ''}
              onChange={(e) => updateWarehouse('pincode', e.target.value)}
              placeholder="560001"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone
            </label>
            <input
              type="tel"
              value={settings.warehouse_address.phone || ''}
              onChange={(e) => updateWarehouse('phone', e.target.value)}
              placeholder="9876543210"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
      </div>

      {/* General Settings */}
      <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
        <h3 className="text-lg font-bold mb-4">General Settings</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Default Logistics Provider
          </label>
          <select
            value={settings.default_provider}
            onChange={(e) => setSettings({ ...settings, default_provider: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          >
            <option value="shiprocket">Shiprocket</option>
            <option value="delhivery">Delhivery</option>
            <option value="bluedart">BlueDart</option>
          </select>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-4">
        {saveStatus === 'success' && (
          <div className="flex items-center gap-2 text-green-600">
            <Check className="w-5 h-5" />
            <span>Settings saved successfully!</span>
          </div>
        )}
        {saveStatus === 'error' && (
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-5 h-5" />
            <span>Failed to save settings</span>
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-300 transition-colors"
        >
          <Save className="w-5 h-5" />
          {saveStatus === 'saving' ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
