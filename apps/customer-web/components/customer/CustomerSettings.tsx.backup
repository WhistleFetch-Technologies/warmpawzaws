'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface NotificationSettings {
  push_enabled: boolean;
  booking_reminders: boolean;
  promotional: boolean;
  order_updates: boolean;
  chat_messages: boolean;
}

interface CustomerSettingsProps {
  customerPhone: string;
}

export function CustomerSettings({ customerPhone }: CustomerSettingsProps) {
  const [notifications, setNotifications] = useState<NotificationSettings>({
    push_enabled: true,
    booking_reminders: true,
    promotional: true,
    order_updates: true,
    chat_messages: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    requestNotificationPermission();
  }, [customerPhone]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/customer/settings?phone=${encodeURIComponent(customerPhone)}`);
      if (response.notifications) {
        setNotifications(response.notifications);
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        // In a real app, you'd get the FCM token here
        // For now, we'll simulate it
        setFcmToken('simulated-fcm-token');
      }
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
      await apiClient.put('/customer/settings/notifications', {
        phone: customerPhone,
        [key]: newValue,
        ...(key === 'push_enabled' && !newValue
          ? {
              booking_reminders: false,
              promotional: false,
              order_updates: false,
              chat_messages: false,
            }
          : {}),
      });
    } catch (err) {
      console.error('Error saving settings:', err);
      // Revert on error
      setNotifications((prev) => ({ ...prev, [key]: !newValue }));
    }
  };

  const handleRegisterDevice = async () => {
    if (!fcmToken) {
      alert('Notification permission not granted');
      return;
    }

    setSaving(true);
    try {
      await apiClient.post('/push/register-device', {
        phone: customerPhone,
        fcm_token: fcmToken,
        platform: 'web',
      });
      alert('Device registered for push notifications');
    } catch (err) {
      console.error('Error registering device:', err);
      alert('Failed to register device');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <a href="/" className="text-2xl">←</a>
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Notification Settings */}
        <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold flex items-center gap-2">
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
          {notifications.push_enabled && (
            <div className="p-4 bg-gray-50">
              <button
                onClick={handleRegisterDevice}
                disabled={saving}
                className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {saving ? 'Registering...' : '📱 Enable Push on This Device'}
              </button>
            </div>
          )}
        </section>

        {/* Account Settings */}
        <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="text-2xl">👤</span> Account
            </h2>
          </div>
          <div className="divide-y">
            <a href="/profile" className="flex items-center justify-between p-4 hover:bg-gray-50">
              <span>Edit Profile</span>
              <span className="text-gray-400">→</span>
            </a>
            <a href="/addresses" className="flex items-center justify-between p-4 hover:bg-gray-50">
              <span>Saved Addresses</span>
              <span className="text-gray-400">→</span>
            </a>
            <a href="/pets" className="flex items-center justify-between p-4 hover:bg-gray-50">
              <span>My Pets</span>
              <span className="text-gray-400">→</span>
            </a>
          </div>
        </section>

        {/* Support */}
        <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="text-2xl">❓</span> Support
            </h2>
          </div>
          <div className="divide-y">
            <a href="/help" className="flex items-center justify-between p-4 hover:bg-gray-50">
              <span>Help Center</span>
              <span className="text-gray-400">→</span>
            </a>
            <a href="/privacy" className="flex items-center justify-between p-4 hover:bg-gray-50">
              <span>Privacy Policy</span>
              <span className="text-gray-400">→</span>
            </a>
            <a href="/terms" className="flex items-center justify-between p-4 hover:bg-gray-50">
              <span>Terms of Service</span>
              <span className="text-gray-400">→</span>
            </a>
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
    </div>
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
        className={`w-12 h-7 rounded-full p-1 transition ${
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

