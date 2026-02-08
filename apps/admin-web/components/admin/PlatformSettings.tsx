'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Save, Loader2, Globe, Shield, Bell, IndianRupee, Clock, MapPin } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface PlatformConfig {
  general: {
    platformName: string;
    supportEmail: string;
    supportPhone: string;
    maintenanceMode: boolean;
    maintenanceMessage: string;
  };
  business: {
    defaultCurrency: string;
    defaultTimezone: string;
    defaultLanguage: string;
    taxEnabled: boolean;
    defaultTaxRate: number;
    commissionRate: number;
  };
  booking: {
    maxAdvanceBookingDays: number;
    minAdvanceBookingHours: number;
    cancellationWindowHours: number;
    autoConfirmBookings: boolean;
    allowGuestBooking: boolean;
  };
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
    whatsappEnabled: boolean;
  };
  security: {
    sessionTimeoutMinutes: number;
    maxLoginAttempts: number;
    passwordMinLength: number;
    requireMFA: boolean;
    allowedDomains: string[];
  };
  features: {
    multiRegionEnabled: boolean;
    subscriptionsEnabled: boolean;
    insuranceEnabled: boolean;
    counselingEnabled: boolean;
    adoptionEnabled: boolean;
  };
}

export function PlatformSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'business' | 'booking' | 'notifications' | 'security' | 'features'>('general');
  const [config, setConfig] = useState<PlatformConfig>({
    general: {
      platformName: 'WarmPawz',
      supportEmail: 'support@warmpawz.com',
      supportPhone: '+91-1800-XXX-XXXX',
      maintenanceMode: false,
      maintenanceMessage: '',
    },
    business: {
      defaultCurrency: 'INR',
      defaultTimezone: 'Asia/Kolkata',
      defaultLanguage: 'en',
      taxEnabled: true,
      defaultTaxRate: 18,
      commissionRate: 15,
    },
    booking: {
      maxAdvanceBookingDays: 90,
      minAdvanceBookingHours: 2,
      cancellationWindowHours: 24,
      autoConfirmBookings: false,
      allowGuestBooking: false,
    },
    notifications: {
      emailEnabled: true,
      smsEnabled: true,
      pushEnabled: true,
      whatsappEnabled: false,
    },
    security: {
      sessionTimeoutMinutes: 30,
      maxLoginAttempts: 5,
      passwordMinLength: 8,
      requireMFA: false,
      allowedDomains: [],
    },
    features: {
      multiRegionEnabled: true,
      subscriptionsEnabled: true,
      insuranceEnabled: true,
      counselingEnabled: true,
      adoptionEnabled: true,
    },
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/platform/settings');
      if (data.success && data.config) {
        setConfig(data.config);
      }
    } catch (error) {
      console.error('Error loading platform settings:', error);
      alert('Failed to load platform settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const data = await apiClient.put<any>('/admin/platform/settings', { config });
      
      if (data.success) {
        alert('Platform settings saved successfully');
      } else {
        alert(data.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('An error occurred while saving settings');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (section: keyof PlatformConfig, field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'business', label: 'Business', icon: IndianRupee },
    { id: 'booking', label: 'Booking', icon: Clock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'features', label: 'Features', icon: Settings },
  ] as const;

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
          <div className="p-0 bg-orange-100 rounded-xl">
            <Settings className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
            <p className="text-sm text-gray-600">Configure global platform settings</p>
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

      <div className="bg-white rounded-xl border-2 border-gray-200">
        <div className="border-b border-gray-200 overflow-x-auto">
          <div className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-0 py-4 border-b-2 font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-orange-600 text-orange-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-0">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">Platform Name</label>
                <input
                  type="text"
                  value={config.general.platformName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('general', 'platformName', e.target.value)}
                  className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Support Email</label>
                  <input
                    type="email"
                    value={config.general.supportEmail}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('general', 'supportEmail', e.target.value)}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Support Phone</label>
                  <input
                    type="tel"
                    value={config.general.supportPhone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('general', 'supportPhone', e.target.value)}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.general.maintenanceMode}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('general', 'maintenanceMode', e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Maintenance Mode</span>
                </label>
              </div>

              {config.general.maintenanceMode && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Maintenance Message</label>
                  <textarea
                    value={config.general.maintenanceMessage}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateConfig('general', 'maintenanceMessage', e.target.value)}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    rows={3}
                    placeholder="Platform is under maintenance. We'll be back soon!"
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'business' && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Default Currency</label>
                  <select
                    value={config.business.defaultCurrency}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateConfig('business', 'defaultCurrency', e.target.value)}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Default Timezone</label>
                  <select
                    value={config.business.defaultTimezone}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateConfig('business', 'defaultTimezone', e.target.value)}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Default Language</label>
                  <select
                    value={config.business.defaultLanguage}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateConfig('business', 'defaultLanguage', e.target.value)}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="es">Spanish</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.business.taxEnabled}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('business', 'taxEnabled', e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Enable Tax Calculation</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Default Tax Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={config.business.defaultTaxRate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('business', 'defaultTaxRate', parseFloat(e.target.value))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Platform Commission (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={config.business.commissionRate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('business', 'commissionRate', parseFloat(e.target.value))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'booking' && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Max Advance Booking (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={config.booking.maxAdvanceBookingDays}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('booking', 'maxAdvanceBookingDays', parseInt(e.target.value))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Min Advance Booking (Hours)</label>
                  <input
                    type="number"
                    min="0"
                    value={config.booking.minAdvanceBookingHours}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('booking', 'minAdvanceBookingHours', parseInt(e.target.value))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Cancellation Window (Hours)</label>
                  <input
                    type="number"
                    min="0"
                    value={config.booking.cancellationWindowHours}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('booking', 'cancellationWindowHours', parseInt(e.target.value))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.booking.autoConfirmBookings}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('booking', 'autoConfirmBookings', e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Auto-confirm Bookings</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.booking.allowGuestBooking}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('booking', 'allowGuestBooking', e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Allow Guest Booking (No Login)</span>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">Email Notifications</p>
                    <p className="text-sm text-gray-600">Send notifications via email</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.notifications.emailEnabled}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('notifications', 'emailEnabled', e.target.checked)}
                  className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">SMS Notifications</p>
                    <p className="text-sm text-gray-600">Send notifications via SMS</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.notifications.smsEnabled}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('notifications', 'smsEnabled', e.target.checked)}
                  className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">Push Notifications</p>
                    <p className="text-sm text-gray-600">Send push notifications to mobile apps</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.notifications.pushEnabled}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('notifications', 'pushEnabled', e.target.checked)}
                  className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">WhatsApp Notifications</p>
                    <p className="text-sm text-gray-600">Send notifications via WhatsApp Business</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.notifications.whatsappEnabled}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('notifications', 'whatsappEnabled', e.target.checked)}
                  className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                />
              </label>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Session Timeout (Minutes)</label>
                  <input
                    type="number"
                    min="5"
                    value={config.security.sessionTimeoutMinutes}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('security', 'sessionTimeoutMinutes', parseInt(e.target.value))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Max Login Attempts</label>
                  <input
                    type="number"
                    min="1"
                    value={config.security.maxLoginAttempts}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('security', 'maxLoginAttempts', parseInt(e.target.value))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Min Password Length</label>
                  <input
                    type="number"
                    min="6"
                    value={config.security.passwordMinLength}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('security', 'passwordMinLength', parseInt(e.target.value))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.security.requireMFA}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('security', 'requireMFA', e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Require Multi-Factor Authentication (MFA)</span>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'features' && (
            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Multi-Region Support</p>
                  <p className="text-sm text-gray-600">Enable multiple regional operations</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.features.multiRegionEnabled}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('features', 'multiRegionEnabled', e.target.checked)}
                  className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Subscriptions</p>
                  <p className="text-sm text-gray-600">Enable subscription packages</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.features.subscriptionsEnabled}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('features', 'subscriptionsEnabled', e.target.checked)}
                  className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Pet Insurance</p>
                  <p className="text-sm text-gray-600">Enable insurance services</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.features.insuranceEnabled}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('features', 'insuranceEnabled', e.target.checked)}
                  className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Pet Counseling</p>
                  <p className="text-sm text-gray-600">Enable counseling services</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.features.counselingEnabled}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('features', 'counselingEnabled', e.target.checked)}
                  className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Pet Adoption</p>
                  <p className="text-sm text-gray-600">Enable adoption services</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.features.adoptionEnabled}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('features', 'adoptionEnabled', e.target.checked)}
                  className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
