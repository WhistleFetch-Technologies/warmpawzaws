'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Bell, Shield, Database, Globe, CreditCard, Users, Mail, Save, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface AdminSettingsProps {
  onBack?: () => void;
}

interface SettingsState {
  platformName: string;
  supportEmail: string;
  supportPhone: string;
  commissionRate: number;
  minPayout: number;
  payoutHoldDays: number;
  enableNotifications: boolean;
  enableSMS: boolean;
  enableEmail: boolean;
  maintenanceMode: boolean;
  allowNewRegistrations: boolean;
  requireKYC: boolean;
  autoApproveVendors: boolean;
}

export function AdminSettings({ onBack }: AdminSettingsProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'notifications' | 'payments' | 'security'>('general');
  const [settings, setSettings] = useState<SettingsState>({
    platformName: 'Warmpawz',
    supportEmail: 'support@warmpawz.com',
    supportPhone: '+91 9876543210',
    commissionRate: 15,
    minPayout: 500,
    payoutHoldDays: 7,
    enableNotifications: true,
    enableSMS: true,
    enableEmail: true,
    maintenanceMode: false,
    allowNewRegistrations: true,
    requireKYC: true,
    autoApproveVendors: false,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>('/admin/settings');
      if (response.settings) {
        setSettings({ ...settings, ...response.settings });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      await apiClient.put<any>('/admin/settings', settings);
      toast.success('Settings saved successfully!');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { key: 'general', label: 'General', icon: Globe },
    { key: 'notifications', label: 'Notifications', icon: Bell },
    { key: 'payments', label: 'Payments', icon: CreditCard },
    { key: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {onBack && (
            <button onClick={onBack} className="mb-2 text-gray-600 hover:text-gray-900 flex items-center gap-2 text-sm">
              ← Back to Dashboard
            </button>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Settings className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Platform Settings</h1>
                <p className="text-sm text-gray-500">Configure platform preferences</p>
              </div>
            </div>
            <button
              onClick={saveSettings}
              disabled={saving}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-orange-500" />
            <p className="mt-2 text-gray-500">Loading settings...</p>
          </div>
        ) : (
          <>
            {/* General Settings */}
            {activeTab === 'general' && (
              <div className="bg-white rounded-xl p-6 space-y-6">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-gray-500" />
                  General Settings
                </h2>
                
                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Platform Name</label>
                    <input
                      type="text"
                      value={settings.platformName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, platformName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Support Email</label>
                    <input
                      type="email"
                      value={settings.supportEmail}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, supportEmail: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Support Phone</label>
                    <input
                      type="tel"
                      value={settings.supportPhone}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, supportPhone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                    />
                  </div>
                  <div className="flex items-center justify-between py-3 border-t">
                    <div>
                      <p className="font-medium text-gray-900">Maintenance Mode</p>
                      <p className="text-sm text-gray-500">Temporarily disable platform access</p>
                    </div>
                    <button
                      onClick={() => setSettings({ ...settings, maintenanceMode: !settings.maintenanceMode })}
                      className={`w-12 h-6 rounded-full transition-colors ${settings.maintenanceMode ? 'bg-red-500' : 'bg-gray-200'}`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.maintenanceMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Notification Settings */}
            {activeTab === 'notifications' && (
              <div className="bg-white rounded-xl p-6 space-y-6">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-gray-500" />
                  Notification Settings
                </h2>
                
                <div className="space-y-4">
                  {[
                    { key: 'enableNotifications', label: 'Push Notifications', desc: 'Send push notifications to users' },
                    { key: 'enableSMS', label: 'SMS Notifications', desc: 'Send SMS for bookings and updates' },
                    { key: 'enableEmail', label: 'Email Notifications', desc: 'Send email notifications' },
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between py-3 border-b last:border-0">
                      <div>
                        <p className="font-medium text-gray-900">{item.label}</p>
                        <p className="text-sm text-gray-500">{item.desc}</p>
                      </div>
                      <button
                        onClick={() => setSettings({ ...settings, [item.key]: !(settings as any)[item.key] })}
                        className={`w-12 h-6 rounded-full transition-colors ${(settings as any)[item.key] ? 'bg-green-500' : 'bg-gray-200'}`}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${(settings as any)[item.key] ? 'translate-x-6' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payment Settings */}
            {activeTab === 'payments' && (
              <div className="bg-white rounded-xl p-6 space-y-6">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-gray-500" />
                  Payment Settings
                </h2>
                
                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Platform Commission (%)</label>
                    <input
                      type="number"
                      value={settings.commissionRate}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, commissionRate: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Commission deducted from vendor earnings</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Payout Amount (₹)</label>
                    <input
                      type="number"
                      value={settings.minPayout}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, minPayout: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payout Hold Period (Days)</label>
                    <input
                      type="number"
                      value={settings.payoutHoldDays}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, payoutHoldDays: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-200 focus:border-orange-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Days to hold earnings before payout</p>
                  </div>
                </div>
              </div>
            )}

            {/* Security Settings */}
            {activeTab === 'security' && (
              <div className="bg-white rounded-xl p-6 space-y-6">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-gray-500" />
                  Security Settings
                </h2>
                
                <div className="space-y-4">
                  {[
                    { key: 'allowNewRegistrations', label: 'Allow New Registrations', desc: 'Allow new users to register' },
                    { key: 'requireKYC', label: 'Require KYC Verification', desc: 'Vendors must complete KYC before activation' },
                    { key: 'autoApproveVendors', label: 'Auto-Approve Vendors', desc: 'Automatically approve new vendor registrations' },
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between py-3 border-b last:border-0">
                      <div>
                        <p className="font-medium text-gray-900">{item.label}</p>
                        <p className="text-sm text-gray-500">{item.desc}</p>
                      </div>
                      <button
                        onClick={() => setSettings({ ...settings, [item.key]: !(settings as any)[item.key] })}
                        className={`w-12 h-6 rounded-full transition-colors ${(settings as any)[item.key] ? 'bg-green-500' : 'bg-gray-200'}`}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${(settings as any)[item.key] ? 'translate-x-6' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
