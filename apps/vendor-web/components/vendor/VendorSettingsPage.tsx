'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface VendorProfile {
  id: string;
  business_name: string;
  owner_name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  gst_number?: string;
  pan_number?: string;
  operating_hours?: string;
  description?: string;
  logo_url?: string;
}

interface BankDetails {
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  bank_name: string;
  is_verified: boolean;
}

interface VendorSettingsPageProps {
  vendorId: string;
}

export function VendorSettingsPage({ vendorId }: VendorSettingsPageProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'bank' | 'schedule' | 'notifications'>('profile');
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [vendorId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [profileRes, bankRes] = await Promise.all([
        apiClient.get<any>(`/vendor/${vendorId}/profile`),
        apiClient.get<any>(`/vendor/${vendorId}/bank-details`),
      ]);
      if (profileRes.success) setProfile(profileRes.vendor);
      if (bankRes.success) setBankDetails(bankRes.bankDetails);
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await apiClient.put(`/vendor/${vendorId}/profile`, profile);
      alert('Profile saved successfully');
    } catch (err) {
      console.error('Error saving profile:', err);
      alert('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBankDetails = async () => {
    if (!bankDetails) return;
    setSaving(true);
    try {
      await apiClient.put(`/vendor/${vendorId}/bank-details`, bankDetails);
      alert('Bank details saved successfully');
      loadData();
    } catch (err) {
      console.error('Error saving bank details:', err);
      alert('Failed to save bank details');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex bg-white rounded-lg p-0 shadow-sm mb-0 w-fit">
        {[
          { id: 'profile', label: 'Profile', icon: '👤' },
          { id: 'bank', label: 'Bank Account', icon: '🏦' },
          { id: 'schedule', label: 'Schedule', icon: '📅' },
          { id: 'notifications', label: 'Notifications', icon: '🔔' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-0 rounded-lg text-sm font-medium transition flex items-center gap-0 ${
              activeTab === tab.id
                ? 'bg-orange-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && profile && (
        <div className="bg-white rounded-2xl p-0 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Business Profile</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">Business Name</label>
              <input
                type="text"
                value={profile.business_name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfile({ ...profile, business_name: e.target.value })}
                className="w-full px-0 py-0 border rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">Owner Name</label>
              <input
                type="text"
                value={profile.owner_name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfile({ ...profile, owner_name: e.target.value })}
                className="w-full px-0 py-0 border rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">Phone</label>
              <input
                type="tel"
                value={profile.phone}
                disabled
                className="w-full px-0 py-0 border rounded-lg bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">Email</label>
              <input
                type="email"
                value={profile.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfile({ ...profile, email: e.target.value })}
                className="w-full px-0 py-0 border rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-0">Address</label>
              <input
                type="text"
                value={profile.address}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfile({ ...profile, address: e.target.value })}
                className="w-full px-0 py-0 border rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">City</label>
              <input
                type="text"
                value={profile.city}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfile({ ...profile, city: e.target.value })}
                className="w-full px-0 py-0 border rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">State</label>
              <input
                type="text"
                value={profile.state}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfile({ ...profile, state: e.target.value })}
                className="w-full px-0 py-0 border rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">Pincode</label>
              <input
                type="text"
                value={profile.pincode}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfile({ ...profile, pincode: e.target.value })}
                className="w-full px-0 py-0 border rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">GST Number</label>
              <input
                type="text"
                value={profile.gst_number || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfile({ ...profile, gst_number: e.target.value })}
                className="w-full px-0 py-0 border rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">PAN Number</label>
              <input
                type="text"
                value={profile.pan_number || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfile({ ...profile, pan_number: e.target.value })}
                className="w-full px-0 py-0 border rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">Operating Hours</label>
              <input
                type="text"
                value={profile.operating_hours || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfile({ ...profile, operating_hours: e.target.value })}
                placeholder="e.g., Mon-Sat 9:00 AM - 8:00 PM"
                className="w-full px-0 py-0 border rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-0">Description</label>
              <textarea
                value={profile.description || ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setProfile({ ...profile, description: e.target.value })}
                rows={3}
                className="w-full px-0 py-0 border rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="mt-0 px-0 py-0 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      )}

      {/* Bank Account Tab */}
      {activeTab === 'bank' && (
        <div className="bg-white rounded-2xl p-0 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Bank Account Details</h2>
            {bankDetails?.is_verified && (
              <span className="px-0 py-0 bg-green-100 text-green-700 rounded-full text-sm flex items-center gap-0">
                ✓ Verified
              </span>
            )}
          </div>
          
          {!bankDetails?.is_verified && (
            <div className="mb-4 p-0 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
              ⚠️ Bank account verification is required to receive payouts
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">Account Holder Name</label>
              <input
                type="text"
                value={bankDetails?.account_holder_name || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBankDetails({ ...bankDetails!, account_holder_name: e.target.value })}
                className="w-full px-0 py-0 border rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">Account Number</label>
              <input
                type="text"
                value={bankDetails?.account_number || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBankDetails({ ...bankDetails!, account_number: e.target.value })}
                className="w-full px-0 py-0 border rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">IFSC Code</label>
              <input
                type="text"
                value={bankDetails?.ifsc_code || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBankDetails({ ...bankDetails!, ifsc_code: e.target.value.toUpperCase() })}
                className="w-full px-0 py-0 border rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">Bank Name</label>
              <input
                type="text"
                value={bankDetails?.bank_name || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBankDetails({ ...bankDetails!, bank_name: e.target.value })}
                className="w-full px-0 py-0 border rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
          <button
            onClick={handleSaveBankDetails}
            disabled={saving}
            className="mt-0 px-0 py-0 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
          >
            {saving ? 'Saving...' : bankDetails?.is_verified ? 'Update & Re-verify' : 'Save & Verify'}
          </button>
        </div>
      )}

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <div className="bg-white rounded-2xl p-0 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Working Schedule</h2>
          <ScheduleManager vendorId={vendorId} />
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-2xl p-0 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Notification Preferences</h2>
          <NotificationPreferences vendorId={vendorId} />
        </div>
      )}
    </div>
  );
}

function ScheduleManager({ vendorId }: { vendorId: string }) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchedule();
  }, [vendorId]);

  const loadSchedule = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/schedule`);
      if (response.success && response.schedule) {
        setSchedule(response.schedule);
      } else {
        // Default schedule
        setSchedule(days.map((_, idx) => ({
          day_of_week: idx,
          is_open: idx !== 0, // Closed on Sunday
          open_time: '09:00',
          close_time: '18:00',
        })));
      }
    } catch (err) {
      console.error('Error loading schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await apiClient.put(`/vendor/${vendorId}/schedule`, { schedule });
      alert('Schedule saved successfully');
    } catch (err) {
      alert('Failed to save schedule');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-3">
      {schedule.map((day, idx) => (
        <div key={idx} className="flex items-center gap-4 py-0 border-b">
          <div className="w-28">
            <span className="font-medium text-gray-700">{days[day.day_of_week]}</span>
          </div>
          <label className="flex items-center gap-0 cursor-pointer">
            <input
              type="checkbox"
              checked={day.is_open}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const newSchedule = [...schedule];
                newSchedule[idx].is_open = e.target.checked;
                setSchedule(newSchedule);
              }}
              className="w-4 h-4 accent-orange-500"
            />
            <span className="text-sm text-gray-500">Open</span>
          </label>
          {day.is_open && (
            <>
              <input
                type="time"
                value={day.open_time}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const newSchedule = [...schedule];
                  newSchedule[idx].open_time = e.target.value;
                  setSchedule(newSchedule);
                }}
                className="px-0 py-0 border rounded"
              />
              <span className="text-gray-400">to</span>
              <input
                type="time"
                value={day.close_time}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const newSchedule = [...schedule];
                  newSchedule[idx].close_time = e.target.value;
                  setSchedule(newSchedule);
                }}
                className="px-0 py-0 border rounded"
              />
            </>
          )}
          {!day.is_open && (
            <span className="text-sm text-gray-400 italic">Closed</span>
          )}
        </div>
      ))}
      <button
        onClick={handleSave}
        className="mt-4 px-0 py-0 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
      >
        Save Schedule
      </button>
    </div>
  );
}

function NotificationPreferences({ vendorId }: { vendorId: string }) {
  const [prefs, setPrefs] = useState({
    newBooking: true,
    bookingReminder: true,
    cancellations: true,
    payments: true,
    promotions: false,
    smsEnabled: true,
    emailEnabled: true,
    pushEnabled: true,
  });

  const handleSave = async () => {
    try {
      await apiClient.put(`/vendor/${vendorId}/notification-preferences`, prefs);
      alert('Notification preferences saved');
    } catch (err) {
      alert('Failed to save preferences');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium text-gray-900 mb-0">Notification Types</h3>
        <div className="space-y-3">
          {[
            { key: 'newBooking', label: 'New Bookings', desc: 'Get notified when a new booking is made' },
            { key: 'bookingReminder', label: 'Booking Reminders', desc: 'Reminders for upcoming bookings' },
            { key: 'cancellations', label: 'Cancellations', desc: 'Alerts when bookings are cancelled' },
            { key: 'payments', label: 'Payments & Settlements', desc: 'Payment received and payout updates' },
            { key: 'promotions', label: 'Platform Updates', desc: 'Tips, news, and promotional updates' },
          ].map((item) => (
            <label key={item.key} className="flex items-center justify-between p-0 bg-gray-50 rounded-lg cursor-pointer">
              <div>
                <span className="font-medium text-gray-700">{item.label}</span>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
              <input
                type="checkbox"
                checked={(prefs as any)[item.key]}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrefs({ ...prefs, [item.key]: e.target.checked })}
                className="w-5 h-5 accent-orange-500"
              />
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-medium text-gray-900 mb-0">Channels</h3>
        <div className="flex gap-4">
          {[
            { key: 'smsEnabled', label: 'SMS', icon: '📱' },
            { key: 'emailEnabled', label: 'Email', icon: '✉️' },
            { key: 'pushEnabled', label: 'Push', icon: '🔔' },
          ].map((channel) => (
            <label
              key={channel.key}
              className={`flex-1 flex items-center justify-center gap-0 p-0 rounded-lg cursor-pointer border-2 transition ${
                (prefs as any)[channel.key] ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
              }`}
            >
              <input
                type="checkbox"
                checked={(prefs as any)[channel.key]}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrefs({ ...prefs, [channel.key]: e.target.checked })}
                className="hidden"
              />
              <span>{channel.icon}</span>
              <span className="font-medium">{channel.label}</span>
            </label>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        className="px-0 py-0 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
      >
        Save Preferences
      </button>
    </div>
  );
}

