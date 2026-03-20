'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { EnhancedAddressAutocomplete, AddressComponents } from '@/components/shared/EnhancedAddressAutocomplete';

interface CustomerProfile {
  id: string;
  phone: string;
  email: string;
  full_name: string;
  date_of_birth?: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  profile_photo_url?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<CustomerProfile>>({});

  useEffect(() => {
    const phone = localStorage.getItem('customerPhone');
    if (!phone) {
      router.push('/auth');
      return;
    }
    loadProfile();
  }, [router]);

  const loadProfile = async () => {
    try {
      const customerId = localStorage.getItem('customerId');
      const phone = localStorage.getItem('customerPhone');
      if (customerId) {
        const response = await apiClient.get<CustomerProfile>(`/customer/${customerId}/profile`);
        setProfile(response);
        setEditData(response);
      } else if (phone) {
        const data = await apiClient.get<{ profile?: CustomerProfile & { name?: string; firstName?: string; lastName?: string } }>(
          `/customer/profile?phone=${encodeURIComponent(phone)}`
        );
        const p = data.profile;
        if (p) {
          const full = p.full_name || p.name || [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || '';
          const mapped: CustomerProfile = {
            id: p.id,
            phone: p.phone || phone,
            email: p.email || '',
            full_name: full,
            city: p.city,
            state: p.state,
            pincode: p.pincode,
            address: typeof p.address === 'string' ? p.address : (p as any).address?.street,
            profile_photo_url: p.profile_photo_url || (p as any).photo,
          };
          setProfile(mapped);
          setEditData(mapped);
        }
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const customerId = localStorage.getItem('customerId');
      await apiClient.put(`/customer/${customerId}/profile`, editData);
      const updatedProfile = { ...profile, ...editData } as CustomerProfile;
      setProfile(updatedProfile);
      setEditData(updatedProfile);
      localStorage.setItem('customerProfile', JSON.stringify(updatedProfile));
      localStorage.setItem('customerData', JSON.stringify(updatedProfile));
      setEditing(false);
    } catch (err) {
      console.error('Error saving profile:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('customerPhone');
    localStorage.removeItem('customerId');
    localStorage.removeItem('authToken');
    router.push('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header - Match consistency pattern: max-w-7xl mx-auto px-6 py-4 */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-orange-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              {/* ✅ FIX: Match consistency - text-2xl font-bold */}
              <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
              <p className="text-sm text-gray-500 mt-1">Manage your account information</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Match consistency pattern: max-w-7xl mx-auto p-6 or p-8 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b">
            <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center text-3xl">
              {profile?.full_name?.charAt(0) || '👤'}
            </div>
            <div>
              <h2 className="text-xl font-semibold">{profile?.full_name || 'User'}</h2>
              <p className="text-gray-500">{profile?.phone}</p>
            </div>
          </div>

          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-500 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editData.full_name || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditData({ ...editData, full_name: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Email</label>
                <input
                  type="email"
                  value={editData.email || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditData({ ...editData, email: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-1">City</label>
                  <input
                    type="text"
                    value={editData.city || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditData({ ...editData, city: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">State</label>
                  <input
                    type="text"
                    value={editData.state || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditData({ ...editData, state: e.target.value })}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Address</label>
                <EnhancedAddressAutocomplete
                  value={editData.address || ''}
                  onChange={(address: string, components?: AddressComponents) => {
                    const updates: Partial<CustomerProfile> = { address };
                    // Auto-populate city, state, pincode from Google Maps selection
                    if (components) {
                      if (components.city) updates.city = components.city;
                      if (components.state) updates.state = components.state;
                      if (components.pincode) updates.pincode = components.pincode;
                    }
                    setEditData({ ...editData, ...updates });
                  }}
                  placeholder="Search address, landmark, city..."
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 p-3 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 p-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between py-3 border-b">
                <span className="text-gray-500">Email</span>
                <span className="font-medium">{profile?.email || 'Not set'}</span>
              </div>
              <div className="flex justify-between py-3 border-b">
                <span className="text-gray-500">Phone</span>
                <span className="font-medium">{profile?.phone}</span>
              </div>
              <div className="flex justify-between py-3 border-b">
                <span className="text-gray-500">City</span>
                <span className="font-medium">{profile?.city || 'Not set'}</span>
              </div>
              <div className="flex justify-between py-3 border-b">
                <span className="text-gray-500">Address</span>
                <span className="font-medium">{profile?.address || 'Not set'}</span>
              </div>

              <button
                onClick={() => setEditing(true)}
                className="w-full p-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 mt-4"
              >
                Edit Profile
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 space-y-3">
          <button
            onClick={() => router.push('/pets')}
            className="w-full p-4 bg-white rounded-xl shadow-sm flex items-center justify-between hover:shadow-md transition"
          >
            <span className="flex items-center gap-3">
              <span className="text-2xl">🐾</span>
              <span className="font-medium">My Pets</span>
            </span>
            <span className="text-gray-400">→</span>
          </button>
          <button
            onClick={() => router.push('/bookings')}
            className="w-full p-4 bg-white rounded-xl shadow-sm flex items-center justify-between hover:shadow-md transition"
          >
            <span className="flex items-center gap-3">
              <span className="text-2xl">📅</span>
              <span className="font-medium">My Bookings</span>
            </span>
            <span className="text-gray-400">→</span>
          </button>
          <button
            onClick={() => router.push('/orders')}
            className="w-full p-4 bg-white rounded-xl shadow-sm flex items-center justify-between hover:shadow-md transition"
          >
            <span className="flex items-center gap-3">
              <span className="text-2xl">📦</span>
              <span className="font-medium">Order History</span>
            </span>
            <span className="text-gray-400">→</span>
          </button>
          <button
            onClick={() => router.push('/settings')}
            className="w-full p-4 bg-white rounded-xl shadow-sm flex items-center justify-between hover:shadow-md transition"
          >
            <span className="flex items-center gap-3">
              <span className="text-2xl">⚙️</span>
              <span className="font-medium">Settings</span>
            </span>
            <span className="text-gray-400">→</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full p-4 bg-red-50 text-red-600 rounded-xl flex items-center justify-center gap-2 hover:bg-red-100 transition mt-6"
          >
            <span>🚪</span>
            <span className="font-medium">Logout</span>
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
