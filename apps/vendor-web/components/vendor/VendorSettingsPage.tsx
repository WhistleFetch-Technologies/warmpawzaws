'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, Settings, User, Building2, CreditCard, Bell, Power } from 'lucide-react';

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
  is_active?: boolean;
  status?: string;
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
  onBack?: () => void;
}

export function VendorSettingsPage({ vendorId, onBack }: VendorSettingsPageProps) {
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get('tab');
  const initialTab = (['golive', 'profile', 'bank', 'schedule', 'notifications'].includes(tabParam || '') ? tabParam : 'golive') as 'golive' | 'profile' | 'bank' | 'schedule' | 'notifications';
  const [activeTab, setActiveTab] = useState<'golive' | 'profile' | 'bank' | 'schedule' | 'notifications'>(initialTab);

  useEffect(() => {
    if (tabParam && ['golive', 'profile', 'bank', 'schedule', 'notifications'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [tabParam]);
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [goLiveLoading, setGoLiveLoading] = useState(false);

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
      if (profileRes.success) {
        setProfile(profileRes.vendor);
        setIsLive(profileRes.vendor?.is_active || false);
      }
      if (bankRes.success) setBankDetails(bankRes.bankDetails);
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoLiveToggle = async () => {
    setGoLiveLoading(true);
    try {
      const newStatus = !isLive;
      await apiClient.put(`/vendor/${vendorId}/profile`, { is_active: newStatus });
      setIsLive(newStatus);
      alert(newStatus ? 'Your services are now LIVE! Customers can discover and book your services.' : 'Your services are now OFFLINE. Customers cannot discover or book your services.');
    } catch (err) {
      console.error('Error updating go-live status:', err);
      alert('Failed to update status. Please try again.');
    } finally {
      setGoLiveLoading(false);
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Loading settings...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'golive', label: 'Go Live', icon: Power },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'bank', label: 'Bank', icon: CreditCard },
    { id: 'notifications', label: 'Alerts', icon: Bell },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="vendor-app-column bg-white min-h-screen pb-4">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white border-b">
          <div className="p-4 flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="w-11 h-11 flex items-center justify-center -ml-2 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </button>
            )}
            <div className="flex-1">
              <h1 className="font-semibold text-gray-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-orange-500" />
                Settings
              </h1>
              <p className="text-xs text-gray-500">Manage your account</p>
            </div>
          </div>
          
          {/* Tab Bar - Horizontal scrollable */}
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex px-2 pb-2 gap-1 min-w-max">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Go Live Tab */}
          {activeTab === 'golive' && (
            <div className="space-y-4">
              {/* Live Status Card */}
              <div className={`rounded-2xl p-5 ${isLive ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-gray-400 to-gray-500'}`}>
                <div className="flex items-center justify-between">
                  <div className="text-white">
                    <h3 className="text-lg font-bold">
                      {isLive ? '✅ You\'re LIVE' : '⏸️ Offline'}
                    </h3>
                    <p className="text-sm text-white/80 mt-1">
                      {isLive 
                        ? 'Customers can book your services' 
                        : 'Hidden from customers'}
                    </p>
                  </div>
                  <button
                    onClick={handleGoLiveToggle}
                    disabled={goLiveLoading}
                    className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${
                      isLive ? 'bg-white/30' : 'bg-white/20'
                    } ${goLiveLoading ? 'opacity-50' : ''}`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ${
                        isLive ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Checklist */}
              <div className="bg-white rounded-xl border p-4">
                <h3 className="font-semibold text-gray-800 mb-3 text-sm">Checklist</h3>
                <div className="space-y-2.5">
                  <ChecklistItem 
                    label="Business Profile" 
                    done={!!profile?.business_name}
                    hint="Name & contact"
                  />
                  <ChecklistItem 
                    label="Bank Account" 
                    done={!!bankDetails?.account_number}
                    hint="For payments"
                  />
                  <ChecklistItem 
                    label="Operating Hours" 
                    done={!!profile?.operating_hours}
                    hint="Your schedule"
                  />
                </div>
              </div>

              {/* Tip */}
              <div className="bg-orange-50 rounded-xl p-3 border border-orange-200">
                <p className="text-xs text-orange-800">
                  <strong>💡 Tip:</strong> Toggle anytime. Existing bookings stay active when offline.
                </p>
              </div>
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && profile && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border p-4">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-orange-500" />
                  Business Info
                </h3>
                
                <div className="space-y-4">
                  <FormField 
                    label="Business Name"
                    value={profile.business_name}
                    onChange={(v) => setProfile({ ...profile, business_name: v })}
                  />
                  <FormField 
                    label="Owner Name"
                    value={profile.owner_name}
                    onChange={(v) => setProfile({ ...profile, owner_name: v })}
                  />
                  <FormField 
                    label="Phone"
                    value={profile.phone}
                    disabled
                  />
                  <FormField 
                    label="Email"
                    value={profile.email}
                    type="email"
                    onChange={(v) => setProfile({ ...profile, email: v })}
                  />
                  <FormField 
                    label="Address"
                    value={profile.address}
                    onChange={(v) => setProfile({ ...profile, address: v })}
                    multiline
                  />
                  
                  <div className="grid grid-cols-2 gap-3">
                    <FormField 
                      label="City"
                      value={profile.city}
                      onChange={(v) => setProfile({ ...profile, city: v })}
                    />
                    <FormField 
                      label="State"
                      value={profile.state}
                      onChange={(v) => setProfile({ ...profile, state: v })}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <FormField 
                      label="Pincode"
                      value={profile.pincode}
                      onChange={(v) => setProfile({ ...profile, pincode: v })}
                    />
                    <FormField 
                      label="GST Number"
                      value={profile.gst_number || ''}
                      onChange={(v) => setProfile({ ...profile, gst_number: v })}
                      placeholder="Optional"
                    />
                  </div>
                  
                  <FormField 
                    label="PAN Number"
                    value={profile.pan_number || ''}
                    onChange={(v) => setProfile({ ...profile, pan_number: v })}
                    placeholder="Optional"
                  />
                  
                  <FormField 
                    label="Operating Hours"
                    value={profile.operating_hours || ''}
                    onChange={(v) => setProfile({ ...profile, operating_hours: v })}
                    placeholder="e.g., Mon-Sat 9AM - 6PM"
                  />
                  
                  <FormField 
                    label="Description"
                    value={profile.description || ''}
                    onChange={(v) => setProfile({ ...profile, description: v })}
                    placeholder="Tell customers about your business..."
                    multiline
                  />
                </div>
              </div>

              <div className="sticky bottom-0 bg-white pt-3 pb-[env(safe-area-inset-bottom,0.5rem)]">
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="w-full py-3.5 min-h-[48px] bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </div>
          )}

          {/* Bank Tab */}
          {activeTab === 'bank' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-orange-500" />
                    Bank Account
                  </h3>
                  {bankDetails?.is_verified && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      ✓ Verified
                    </span>
                  )}
                </div>
                
                {!bankDetails?.is_verified && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
                    ⚠️ Bank verification required for payouts
                  </div>
                )}

                <div className="space-y-4">
                  <FormField 
                    label="Account Holder Name"
                    value={bankDetails?.account_holder_name || ''}
                    onChange={(v) => setBankDetails({ ...bankDetails!, account_holder_name: v })}
                  />
                  <FormField 
                    label="Account Number"
                    value={bankDetails?.account_number || ''}
                    onChange={(v) => setBankDetails({ ...bankDetails!, account_number: v })}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField 
                      label="IFSC Code"
                      value={bankDetails?.ifsc_code || ''}
                      onChange={(v) => setBankDetails({ ...bankDetails!, ifsc_code: v.toUpperCase() })}
                    />
                    <FormField 
                      label="Bank Name"
                      value={bankDetails?.bank_name || ''}
                      onChange={(v) => setBankDetails({ ...bankDetails!, bank_name: v })}
                    />
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 bg-white pt-3 pb-[env(safe-area-inset-bottom,0.5rem)]">
                <button
                  onClick={handleSaveBankDetails}
                  disabled={saving}
                  className="w-full py-3.5 min-h-[48px] bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : bankDetails?.is_verified ? 'Update & Re-verify' : 'Save & Verify'}
                </button>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="bg-white rounded-xl border p-4">
              <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Bell className="w-4 h-4 text-orange-500" />
                Notification Preferences
              </h3>
              <NotificationPreferences vendorId={vendorId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Reusable Form Field Component
function FormField({ 
  label, 
  value, 
  onChange, 
  type = 'text',
  disabled = false,
  placeholder,
  multiline = false
}: { 
  label: string;
  value: string;
  onChange?: (value: string) => void;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
  multiline?: boolean;
}) {
  const baseClasses = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors";
  const disabledClasses = disabled ? "bg-gray-50 text-gray-500" : "bg-white";
  
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          rows={3}
          className={`${baseClasses} ${disabledClasses} resize-none`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className={`${baseClasses} ${disabledClasses}`}
        />
      )}
    </div>
  );
}

// Checklist Item Component
function ChecklistItem({ label, done, hint }: { label: string; done: boolean; hint: string }) {
  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg ${done ? 'bg-green-50' : 'bg-gray-50'}`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
        done ? 'bg-green-500 text-white' : 'bg-gray-300 text-white'
      }`}>
        {done ? '✓' : '!'}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${done ? 'text-green-800' : 'text-gray-700'}`}>{label}</p>
        <p className="text-xs text-gray-500">{hint}</p>
      </div>
    </div>
  );
}

// Notification Preferences Component
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
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put(`/vendor/${vendorId}/notification-preferences`, prefs);
      alert('Notification preferences saved');
    } catch (err) {
      alert('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const notificationTypes = [
    { key: 'newBooking', label: 'New Bookings', icon: '📅' },
    { key: 'bookingReminder', label: 'Reminders', icon: '⏰' },
    { key: 'cancellations', label: 'Cancellations', icon: '❌' },
    { key: 'payments', label: 'Payments', icon: '💰' },
    { key: 'promotions', label: 'Updates', icon: '📢' },
  ];

  const channels = [
    { key: 'smsEnabled', label: 'SMS', icon: '📱' },
    { key: 'emailEnabled', label: 'Email', icon: '✉️' },
    { key: 'pushEnabled', label: 'Push', icon: '🔔' },
  ];

  return (
    <div className="space-y-5">
      {/* Notification Types */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Notify me about</h4>
        <div className="space-y-2">
          {notificationTypes.map((item) => (
            <label key={item.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-2">
                <span>{item.icon}</span>
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
              </div>
              <input
                type="checkbox"
                checked={(prefs as any)[item.key]}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrefs({ ...prefs, [item.key]: e.target.checked })}
                className="w-5 h-5 accent-orange-500 rounded"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Channels */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Channels</h4>
        <div className="grid grid-cols-3 gap-2">
          {channels.map((channel) => (
            <button
              key={channel.key}
              onClick={() => setPrefs({ ...prefs, [channel.key]: !(prefs as any)[channel.key] })}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                (prefs as any)[channel.key] 
                  ? 'border-orange-500 bg-orange-50 text-orange-600' 
                  : 'border-gray-200 bg-white text-gray-500'
              }`}
            >
              <span className="text-lg">{channel.icon}</span>
              <span className="text-xs font-medium">{channel.label}</span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-50 transition-colors text-sm"
      >
        {saving ? 'Saving...' : 'Save Preferences'}
      </button>
    </div>
  );
}
