'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Save, Loader2, CheckCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface VendorSettings {
  onboarding: {
    autoApprove: boolean;
    requireDocuments: boolean;
    requireBankDetails: boolean;
    verificationRequired: boolean;
    minRating: number;
  };
  operations: {
    allowMultipleServices: boolean;
    requireServiceArea: boolean;
    maxServiceRadius: number;
    allowHomeServices: boolean;
    allowClinicServices: boolean;
  };
  financial: {
    defaultCommission: number;
    paymentCycle: 'weekly' | 'biweekly' | 'monthly';
    minPayoutAmount: number;
    holdPeriodDays: number;
  };
  compliance: {
    requireInsurance: boolean;
    requireLicense: boolean;
    licenseRenewalDays: number;
    backgroundCheckRequired: boolean;
  };
  notifications: {
    newBookingNotification: boolean;
    cancellationNotification: boolean;
    paymentNotification: boolean;
    reviewNotification: boolean;
  };
}

export function VendorSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<VendorSettings>({
    onboarding: {
      autoApprove: false,
      requireDocuments: true,
      requireBankDetails: true,
      verificationRequired: true,
      minRating: 4.0,
    },
    operations: {
      allowMultipleServices: true,
      requireServiceArea: true,
      maxServiceRadius: 50,
      allowHomeServices: true,
      allowClinicServices: true,
    },
    financial: {
      defaultCommission: 15,
      paymentCycle: 'monthly',
      minPayoutAmount: 1000,
      holdPeriodDays: 7,
    },
    compliance: {
      requireInsurance: true,
      requireLicense: true,
      licenseRenewalDays: 30,
      backgroundCheckRequired: true,
    },
    notifications: {
      newBookingNotification: true,
      cancellationNotification: true,
      paymentNotification: true,
      reviewNotification: true,
    },
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/vendor-settings');
      if (data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Error loading vendor settings:', error);
      alert('Failed to load vendor settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const data = await apiClient.put<any>('/admin/vendor-settings', { settings });
      
      if (data.success) {
        alert('Vendor settings saved successfully');
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

  const updateSetting = (section: keyof VendorSettings, field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
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
          <div className="p-0 bg-green-100 rounded-xl">
            <Settings className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Vendor Settings</h2>
            <p className="text-sm text-gray-600">Configure vendor-specific settings</p>
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

      <div className="space-y-6">
        <div className="bg-white rounded-xl border-2 border-gray-200 p-0">
          <h3 className="font-semibold text-gray-900 mb-4">Onboarding Settings</h3>
          <div className="space-y-4">
            <label className="flex items-center justify-between p-0 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Auto-approve Applications</p>
                <p className="text-sm text-gray-600">Automatically approve vendor applications</p>
              </div>
              <input
                type="checkbox"
                checked={settings.onboarding.autoApprove}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('onboarding', 'autoApprove', e.target.checked)}
                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
              />
            </label>

            <label className="flex items-center justify-between p-0 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Require Documents</p>
                <p className="text-sm text-gray-600">Vendors must upload required documents</p>
              </div>
              <input
                type="checkbox"
                checked={settings.onboarding.requireDocuments}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('onboarding', 'requireDocuments', e.target.checked)}
                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
              />
            </label>

            <label className="flex items-center justify-between p-0 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Require Bank Details</p>
                <p className="text-sm text-gray-600">Vendors must provide banking information</p>
              </div>
              <input
                type="checkbox"
                checked={settings.onboarding.requireBankDetails}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('onboarding', 'requireBankDetails', e.target.checked)}
                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
              />
            </label>

            <label className="flex items-center justify-between p-0 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Verification Required</p>
                <p className="text-sm text-gray-600">Manual verification before activation</p>
              </div>
              <input
                type="checkbox"
                checked={settings.onboarding.verificationRequired}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('onboarding', 'verificationRequired', e.target.checked)}
                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
              />
            </label>

            <div className="p-0 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-0">Minimum Rating</label>
              <input
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={settings.onboarding.minRating}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('onboarding', 'minRating', parseFloat(e.target.value))}
                className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border-2 border-gray-200 p-0">
          <h3 className="font-semibold text-gray-900 mb-4">Operations Settings</h3>
          <div className="space-y-4">
            <label className="flex items-center justify-between p-0 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Allow Multiple Services</p>
                <p className="text-sm text-gray-600">Vendors can offer multiple service types</p>
              </div>
              <input
                type="checkbox"
                checked={settings.operations.allowMultipleServices}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('operations', 'allowMultipleServices', e.target.checked)}
                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
              />
            </label>

            <label className="flex items-center justify-between p-0 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Require Service Area</p>
                <p className="text-sm text-gray-600">Vendors must define service coverage area</p>
              </div>
              <input
                type="checkbox"
                checked={settings.operations.requireServiceArea}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('operations', 'requireServiceArea', e.target.checked)}
                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
              />
            </label>

            <div className="p-0 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-0">Max Service Radius (km)</label>
              <input
                type="number"
                min="1"
                value={settings.operations.maxServiceRadius}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('operations', 'maxServiceRadius', parseInt(e.target.value))}
                className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <label className="flex items-center justify-between p-0 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Allow Home Services</p>
                <p className="text-sm text-gray-600">Enable at-home service delivery</p>
              </div>
              <input
                type="checkbox"
                checked={settings.operations.allowHomeServices}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('operations', 'allowHomeServices', e.target.checked)}
                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
              />
            </label>

            <label className="flex items-center justify-between p-0 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Allow Clinic Services</p>
                <p className="text-sm text-gray-600">Enable clinic-based services</p>
              </div>
              <input
                type="checkbox"
                checked={settings.operations.allowClinicServices}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('operations', 'allowClinicServices', e.target.checked)}
                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
              />
            </label>
          </div>
        </div>

        <div className="bg-white rounded-xl border-2 border-gray-200 p-0">
          <h3 className="font-semibold text-gray-900 mb-4">Financial Settings</h3>
          <div className="space-y-4">
            <div className="p-0 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-0">Default Commission (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={settings.financial.defaultCommission}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('financial', 'defaultCommission', parseFloat(e.target.value))}
                className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="p-0 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-0">Payment Cycle</label>
              <select
                value={settings.financial.paymentCycle}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateSetting('financial', 'paymentCycle', e.target.value)}
                className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div className="p-0 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-0">Min Payout Amount (₹)</label>
              <input
                type="number"
                min="0"
                value={settings.financial.minPayoutAmount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('financial', 'minPayoutAmount', parseInt(e.target.value))}
                className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="p-0 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-0">Payment Hold Period (Days)</label>
              <input
                type="number"
                min="0"
                value={settings.financial.holdPeriodDays}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('financial', 'holdPeriodDays', parseInt(e.target.value))}
                className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border-2 border-gray-200 p-0">
          <h3 className="font-semibold text-gray-900 mb-4">Compliance Settings</h3>
          <div className="space-y-4">
            <label className="flex items-center justify-between p-0 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Require Insurance</p>
                <p className="text-sm text-gray-600">Vendors must have valid insurance</p>
              </div>
              <input
                type="checkbox"
                checked={settings.compliance.requireInsurance}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('compliance', 'requireInsurance', e.target.checked)}
                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
              />
            </label>

            <label className="flex items-center justify-between p-0 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Require License</p>
                <p className="text-sm text-gray-600">Vendors must have valid business license</p>
              </div>
              <input
                type="checkbox"
                checked={settings.compliance.requireLicense}
                onChange={(e) => updateSetting('compliance', 'requireLicense', e.target.checked)}
                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
              />
            </label>

            <div className="p-0 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-0">License Renewal Reminder (Days)</label>
              <input
                type="number"
                min="1"
                value={settings.compliance.licenseRenewalDays}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('compliance', 'licenseRenewalDays', parseInt(e.target.value))}
                className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <label className="flex items-center justify-between p-0 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Background Check Required</p>
                <p className="text-sm text-gray-600">Vendors must pass background verification</p>
              </div>
              <input
                type="checkbox"
                checked={settings.compliance.backgroundCheckRequired}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('compliance', 'backgroundCheckRequired', e.target.checked)}
                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
              />
            </label>
          </div>
        </div>

        <div className="bg-white rounded-xl border-2 border-gray-200 p-0">
          <h3 className="font-semibold text-gray-900 mb-4">Notification Settings</h3>
          <div className="space-y-4">
            <label className="flex items-center justify-between p-0 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">New Booking Notification</p>
                <p className="text-sm text-gray-600">Notify vendors of new bookings</p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifications.newBookingNotification}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('notifications', 'newBookingNotification', e.target.checked)}
                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
              />
            </label>

            <label className="flex items-center justify-between p-0 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Cancellation Notification</p>
                <p className="text-sm text-gray-600">Notify vendors of cancellations</p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifications.cancellationNotification}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('notifications', 'cancellationNotification', e.target.checked)}
                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
              />
            </label>

            <label className="flex items-center justify-between p-0 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Payment Notification</p>
                <p className="text-sm text-gray-600">Notify vendors of payments</p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifications.paymentNotification}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('notifications', 'paymentNotification', e.target.checked)}
                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
              />
            </label>

            <label className="flex items-center justify-between p-0 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Review Notification</p>
                <p className="text-sm text-gray-600">Notify vendors of new reviews</p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifications.reviewNotification}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('notifications', 'reviewNotification', e.target.checked)}
                className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
