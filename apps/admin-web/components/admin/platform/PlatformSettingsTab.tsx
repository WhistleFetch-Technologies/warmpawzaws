'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Cloud, MapPin, CreditCard, Truck, Save, Loader2 } from 'lucide-react';

interface PlatformSettings {
  aws: {
    s3Bucket: string;
    s3Region: string;
    sqsQueueUrl: string;
    googleMapsApiKey: string;
  };
  payments: {
    razorpayKeyId: string;
    razorpayKeySecret: string;
    stripePublishableKey: string;
    stripeSecretKey: string;
    paytmMerchantId: string;
    paytmMerchantKey: string;
  };
  logistics: {
    shiprocketApiKey: string;
    shiprocketApiSecret: string;
    delhiveryApiKey: string;
    blueDartApiKey: string;
  };
}

export function PlatformSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PlatformSettings>({
    aws: {
      s3Bucket: '',
      s3Region: '',
      sqsQueueUrl: '',
      googleMapsApiKey: '',
    },
    payments: {
      razorpayKeyId: '',
      razorpayKeySecret: '',
      stripePublishableKey: '',
      stripeSecretKey: '',
      paytmMerchantId: '',
      paytmMerchantKey: '',
    },
    logistics: {
      shiprocketApiKey: '',
      shiprocketApiSecret: '',
      delhiveryApiKey: '',
      blueDartApiKey: '',
    },
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>('/admin/platform/settings');
      if (response.success && response.settings) {
        setSettings(response.settings);
      }
    } catch (error) {
      console.error('Error loading platform settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await apiClient.post<any>('/admin/platform/settings', { settings });
      if (response.success) {
        alert('Settings saved successfully!');
      } else {
        alert('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (section: keyof PlatformSettings, field: string, value: string) => {
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* AWS & Cloud Settings */}
      <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
        <div className="flex items-center gap-0 mb-4">
          <Cloud className="w-5 h-5 text-orange-600" />
          <h2 className="text-lg font-semibold text-gray-900">Cloud & Maps</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">S3 Bucket</label>
            <input
              type="text"
              value={settings.aws.s3Bucket}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('aws', 's3Bucket', e.target.value)}
              className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="my-bucket-name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">S3 Region</label>
            <input
              type="text"
              value={settings.aws.s3Region}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('aws', 's3Region', e.target.value)}
              className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="us-east-1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">SQS Queue URL</label>
            <input
              type="text"
              value={settings.aws.sqsQueueUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('aws', 'sqsQueueUrl', e.target.value)}
              className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="https://sqs.region.amazonaws.com/account/queue"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">Google Maps API Key</label>
            <input
              type="text"
              value={settings.aws.googleMapsApiKey}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('aws', 'googleMapsApiKey', e.target.value)}
              className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="AIza..."
            />
          </div>
        </div>
      </div>

      {/* Payment Gateway Settings */}
      <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
        <div className="flex items-center gap-0 mb-4">
          <CreditCard className="w-5 h-5 text-orange-600" />
          <h2 className="text-lg font-semibold text-gray-900">Payment Gateway</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">Razorpay Key ID</label>
            <input
              type="text"
              value={settings.payments.razorpayKeyId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('payments', 'razorpayKeyId', e.target.value)}
              className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="rzp_live_..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">Razorpay Key Secret</label>
            <input
              type="password"
              value={settings.payments.razorpayKeySecret}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('payments', 'razorpayKeySecret', e.target.value)}
              className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">Stripe Publishable Key</label>
            <input
              type="text"
              value={settings.payments.stripePublishableKey}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('payments', 'stripePublishableKey', e.target.value)}
              className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="pk_live_..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">Stripe Secret Key</label>
            <input
              type="password"
              value={settings.payments.stripeSecretKey}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('payments', 'stripeSecretKey', e.target.value)}
              className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="sk_live_..."
            />
          </div>
        </div>
      </div>

      {/* Logistics Settings */}
      <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
        <div className="flex items-center gap-0 mb-4">
          <Truck className="w-5 h-5 text-orange-600" />
          <h2 className="text-lg font-semibold text-gray-900">Logistics Integration</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">Shiprocket API Key</label>
            <input
              type="text"
              value={settings.logistics.shiprocketApiKey}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('logistics', 'shiprocketApiKey', e.target.value)}
              className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="API key"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">Shiprocket API Secret</label>
            <input
              type="password"
              value={settings.logistics.shiprocketApiSecret}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSetting('logistics', 'shiprocketApiSecret', e.target.value)}
              className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="••••••••"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center justify-center gap-0 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? (
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

