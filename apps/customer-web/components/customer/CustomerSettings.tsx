'use client';

import React, { useState, useEffect } from 'react';
import {
  bootstrapPushNotifications,
  ensureCapacitorPushRegistrationPipeline,
  getCapacitorPushPermissionStatus,
  openAppNotificationSettings,
  teardownPushNotifications,
  type PushPermissionReceive,
} from '@/lib/push-bootstrap';
import { apiClient } from '@/lib/api-client';
import { getResolvedCustomerId, isCustomerDatabaseUuid } from '@/lib/customer-id-storage';
import {
  PlatformLegalPolicyDialog,
  type PlatformPolicyType,
} from '@/components/legal/PlatformLegalPolicyDialog';

interface NotificationSettings {
  push_enabled: boolean;
  booking_reminders: boolean;
  promotional: boolean;
  order_updates: boolean;
  chat_messages: boolean;
}

interface CustomerSettingsProps {
  customerPhone: string;
  onBack?: () => void;
  onNavigate?: (screen: string) => void;
}

export function CustomerSettings({ customerPhone, onBack, onNavigate }: CustomerSettingsProps) {
  const [notifications, setNotifications] = useState<NotificationSettings>({
    push_enabled: true,
    booking_reminders: true,
    promotional: true,
    order_updates: true,
    chat_messages: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalType, setLegalType] = useState<PlatformPolicyType | null>(null);
  const [pushPermission, setPushPermission] = useState<PushPermissionReceive>('unknown');
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    void refreshPushPermissionStatus();
  }, [customerPhone]);

  const refreshPushPermissionStatus = async () => {
    const status = await getCapacitorPushPermissionStatus();
    setPushPermission(status);
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      // First get customer ID from phone
      const customerRes = await apiClient.get<any>(`/customer/by-phone?phone=${encodeURIComponent(customerPhone)}`);
      const customerId = customerRes?.customer?.id || customerRes?.id;
      
      if (customerId) {
        const response = await apiClient.get<any>(`/customer/${customerId}/preferences`);
        if (response.preferences?.notifications) {
          setNotifications(response.preferences.notifications);
        }
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: keyof NotificationSettings) => {
    const newValue = !notifications[key];
    setNotifications((prev) => ({ ...prev, [key]: newValue }));

    // If disabling push entirely, also disable all subtypes
    if (key === 'push_enabled' && !newValue) {
      setNotifications((prev) => ({
        ...prev,
        push_enabled: false,
        booking_reminders: false,
        promotional: false,
        order_updates: false,
        chat_messages: false,
      }));
    }

    try {
      // Get customer ID from phone
      const customerRes = await apiClient.get<any>(`/customer/by-phone?phone=${encodeURIComponent(customerPhone)}`);
      const customerId = customerRes?.customer?.id || customerRes?.id;
      
      if (customerId) {
        await apiClient.put(`/customer/${customerId}/preferences`, {
          notifications: {
            [key]: newValue,
            ...(key === 'push_enabled' && !newValue
              ? {
                  booking_reminders: false,
                  promotional: false,
                  order_updates: false,
                  chat_messages: false,
                }
              : {}),
          }
        });
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      // Revert on error
      setNotifications((prev) => ({ ...prev, [key]: !newValue }));
    }
  };

  const handleRegisterDevice = async () => {
    setSaving(true);
    setPushMessage(null);
    try {
      let userId = getResolvedCustomerId();
      if (!userId) {
        const customerRes = await apiClient.get<any>(
          `/customer/by-phone?phone=${encodeURIComponent(customerPhone)}`
        );
        userId = customerRes?.customer?.id || customerRes?.id;
      }
      if (!userId || !isCustomerDatabaseUuid(userId)) {
        setPushMessage('Could not resolve customer account. Please try again.');
        return;
      }
      const pushOpts = {
        userId,
        userType: 'customer' as const,
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        apiClient,
        forcePermissionRequest: true,
      };
      await ensureCapacitorPushRegistrationPipeline(pushOpts);
      const result = await bootstrapPushNotifications(pushOpts);
      await refreshPushPermissionStatus();
      if (result.ok) {
        setPushMessage(
          `Push enabled on this device. Device id: ${result.deviceId.slice(0, 8)}…`
        );
        return;
      }
      if (result.reason === 'permission_denied') {
        setPushMessage(
          'Notifications are blocked for Warmpawz. Tap "Open notification settings", turn notifications ON, then tap Enable again.'
        );
        return;
      }
      setPushMessage(
        'Could not get FCM token. Force-close the app, reopen, allow notifications when asked, then try again.'
      );
    } catch (err) {
      console.error('[CustomerSettings] Device registration error:', err);
      setPushMessage('Failed to register device. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    const userId = localStorage.getItem('customerId') || '';
    await teardownPushNotifications({
      userId,
      userType: 'customer',
    });
    localStorage.removeItem('customerPhone');
    localStorage.removeItem('authToken');
    window.location.href = '/auth';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <>
      {/* Header is provided by renderScreenWithLayout wrapper (StandardizedHeader) */}
      
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Notification Settings */}
        <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold flex items-center gap-3">
              <span className="text-2xl">🔔</span> Notifications
            </h2>
          </div>
          <div className="divide-y">
            <SettingToggle
              label="Push Notifications"
              description="Receive push notifications on this device"
              enabled={notifications.push_enabled}
              onToggle={() => handleToggle('push_enabled')}
            />
            {notifications.push_enabled && (
              <>
                <SettingToggle
                  label="Booking Reminders"
                  description="Get reminded about upcoming appointments"
                  enabled={notifications.booking_reminders}
                  onToggle={() => handleToggle('booking_reminders')}
                  indent
                />
                <SettingToggle
                  label="Order Updates"
                  description="Track your orders and deliveries"
                  enabled={notifications.order_updates}
                  onToggle={() => handleToggle('order_updates')}
                  indent
                />
                <SettingToggle
                  label="Chat Messages"
                  description="Get notified about new messages"
                  enabled={notifications.chat_messages}
                  onToggle={() => handleToggle('chat_messages')}
                  indent
                />
                <SettingToggle
                  label="Promotions & Offers"
                  description="Receive exclusive deals and offers"
                  enabled={notifications.promotional}
                  onToggle={() => handleToggle('promotional')}
                  indent
                />
              </>
            )}
          </div>
          <div className="p-4 bg-gray-50 space-y-3">
            <p className="text-xs text-gray-600">
              System permission:{' '}
              <span className="font-medium text-gray-900">{pushPermission}</span>
              {pushPermission === 'denied' && ' — enable in Android settings below'}
            </p>
            {pushMessage && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                {pushMessage}
              </p>
            )}
            <button
              type="button"
              onClick={handleRegisterDevice}
              disabled={saving}
              className="w-full py-3 bg-orange-500 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {saving ? 'Registering…' : 'Enable push on this device'}
            </button>
            {pushPermission === 'denied' && (
              <button
                type="button"
                onClick={() => openAppNotificationSettings()}
                className="w-full py-2 border border-gray-300 rounded-lg text-sm text-gray-800"
              >
                Open notification settings
              </button>
            )}
          </div>
        </section>

        {/* Account Settings */}
        <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold flex items-center gap-3">
              <span className="text-2xl">👤</span> Account
            </h2>
          </div>
          <div className="divide-y">
            <button 
              onClick={() => onNavigate?.('profile')} 
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left"
            >
              <span>Edit Profile</span>
              <span className="text-gray-400">→</span>
            </button>
            <button 
              onClick={() => onNavigate?.('addresses')} 
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left"
            >
              <span>Saved Addresses</span>
              <span className="text-gray-400">→</span>
            </button>
            <button 
              onClick={() => onNavigate?.('pets')} 
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left"
            >
              <span>My Pets</span>
              <span className="text-gray-400">→</span>
            </button>
          </div>
        </section>

        {/* Support */}
        <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold flex items-center gap-3">
              <span className="text-2xl">❓</span> Support
            </h2>
          </div>
          <div className="divide-y">
            <button 
              onClick={() => onNavigate?.('help')} 
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left"
            >
              <span>Help Center</span>
              <span className="text-gray-400">→</span>
            </button>
            <button 
              onClick={() => {
                if (onNavigate) onNavigate('privacy');
                else {
                  setLegalType('privacy_policy');
                  setLegalOpen(true);
                }
              }} 
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left"
            >
              <span>Privacy Policy</span>
              <span className="text-gray-400">→</span>
            </button>
            <button 
              onClick={() => {
                if (onNavigate) onNavigate('terms');
                else {
                  setLegalType('customer_terms_of_service');
                  setLegalOpen(true);
                }
              }} 
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left"
            >
              <span>Terms of Service</span>
              <span className="text-gray-400">→</span>
            </button>
          </div>
        </section>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-medium hover:bg-red-100"
        >
          Log Out
        </button>
      </main>

      <PlatformLegalPolicyDialog
        open={legalOpen}
        onOpenChange={(o) => {
          setLegalOpen(o);
          if (!o) setLegalType(null);
        }}
        policyType={legalType}
      />
    </>
  );
}

function SettingToggle({
  label,
  description,
  enabled,
  onToggle,
  indent = false,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  indent?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 ${indent ? 'pl-12' : ''}`}
    >
      <div className="text-left">
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <div
        className={`w-12 h-7 rounded-full p-0 transition ${
          enabled ? 'bg-orange-500' : 'bg-gray-200'
        }`}
      >
        <div
          className={`w-5 h-5 rounded-full bg-white shadow transition transform ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </div>
    </button>
  );
}

