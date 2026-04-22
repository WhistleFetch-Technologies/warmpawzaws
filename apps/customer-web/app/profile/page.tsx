'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { getResolvedCustomerId, persistCustomerDatabaseId } from '@/lib/customer-id-storage';
import { CustomerUserProfile } from '@/components/customer/CustomerUserProfile';
import {
  inferCityStateFromCommaAddress,
  mergeStreetAddressLineOnly,
  PROFILE_ADDRESS_FORMAT_PLACEHOLDER,
} from '@/lib/profile-address-format';
import { validateEmail } from '@/lib/validation';
import { readProfileCompleted } from '@/lib/customer-flow-guards';
import { goBackOrHome } from '@/lib/go-back-or-replace';
import {
  clearCustomerSession,
  getStoredCustomerJwtForSession,
  needsPasswordSetupAfterOtp,
} from '@/lib/session-utils';

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
  houseNo?: string;
  floor?: string;
  profile_photo_url?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<CustomerProfile>>({});
  const [flowReady, setFlowReady] = useState(false);
  const [showCreateFlow, setShowCreateFlow] = useState(false);

  useEffect(() => {
    const phone = localStorage.getItem('customerPhone');
    const token = getStoredCustomerJwtForSession();
    if (!phone || !token) {
      router.push('/auth');
      return;
    }
    const createFirst = !readProfileCompleted();
    setShowCreateFlow(createFirst);
    setFlowReady(true);
    if (!createFirst) {
      loadProfile();
    } else {
      setLoading(false);
    }
  }, [router]);

  const handleCreateProfileComplete = useCallback(async () => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('profile_completed', 'true');
    try {
      const phone = localStorage.getItem('customerPhone');
      if (phone) {
        const res = await apiClient.getOrUndefinedIfNotFound<{ profile?: Record<string, unknown> }>(
          `/customer/profile/unified/${encodeURIComponent(phone)}`
        );
        if (res?.profile) {
          localStorage.setItem('customerData', JSON.stringify(res.profile));
          localStorage.setItem('customerProfile', JSON.stringify(res.profile));
          persistCustomerDatabaseId(res.profile);
        }
      }
    } catch {
      // Unified fetch is best-effort; gates still use profile_completed
    }
    if (needsPasswordSetupAfterOtp()) {
      router.replace('/auth/set-password?next=' + encodeURIComponent('/onboarding'));
      return;
    }
    const next =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('next')
        : null;
    if (next && next.startsWith('/')) {
      router.replace(next);
      return;
    }
    router.replace('/onboarding');
  }, [router]);

  const loadProfile = async () => {
    try {
      const customerId = getResolvedCustomerId();
      const phone = localStorage.getItem('customerPhone');

      const mapFromProfilePayload = (
        p: CustomerProfile & { name?: string; firstName?: string; lastName?: string; house_no?: string }
      ): CustomerProfile => {
        const full = p.full_name || p.name || [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || '';
        return {
          id: p.id,
          phone: p.phone || phone || '',
          email: p.email || '',
          full_name: full,
          city: p.city,
          state: p.state,
          pincode: p.pincode,
          address: typeof p.address === 'string' ? p.address : (p as any).address?.street,
          houseNo: p.houseNo ?? p.house_no ?? '',
          floor: p.floor ?? '',
          profile_photo_url: p.profile_photo_url || (p as any).photo,
        };
      };

      if (phone) {
        const data = await apiClient.get<{ profile?: CustomerProfile & { name?: string; firstName?: string; lastName?: string; house_no?: string } }>(
          `/customer/profile?phone=${encodeURIComponent(phone)}`
        );
        const p = data.profile;
        if (p) {
          const mapped = mapFromProfilePayload(p);
          const merged: CustomerProfile = {
            ...mapped,
            address: mergeStreetAddressLineOnly(mapped),
            city: '',
            state: '',
            houseNo: (mapped.houseNo || '').trim(),
            floor: (mapped.floor || '').trim(),
          };
          setProfile(merged);
          setEditData(merged);
          persistCustomerDatabaseId(merged);
        }
      } else if (customerId) {
        const data = await apiClient.get<{
          success?: boolean;
          profile?: CustomerProfile & { firstName?: string; lastName?: string; house_no?: string };
        }>(`/customer/profile/${encodeURIComponent(customerId)}`);
        const p = data.profile;
        if (p) {
          const full =
            [p.firstName, p.lastName].filter(Boolean).join(' ').trim() ||
            (p as CustomerProfile).full_name ||
            '';
          const mapped: CustomerProfile = {
            id: p.id || customerId,
            phone: p.phone || '',
            email: p.email || '',
            full_name: full,
            city: p.city,
            state: p.state,
            pincode: p.pincode,
            address: typeof p.address === 'string' ? p.address : '',
            houseNo: p.houseNo ?? p.house_no ?? '',
            floor: p.floor ?? '',
            profile_photo_url: p.profile_photo_url || (p as any).photo,
          };
          const merged: CustomerProfile = {
            ...mapped,
            address: mergeStreetAddressLineOnly(mapped),
            city: '',
            state: '',
            houseNo: (mapped.houseNo || '').trim(),
            floor: (mapped.floor || '').trim(),
          };
          setProfile(merged);
          setEditData(merged);
          persistCustomerDatabaseId(merged);
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
      const customerId = getResolvedCustomerId();
      if (!customerId) throw new Error('Missing customer id');

      const addr = (editData.address || '').trim();
      if (!addr) {
        alert('Please enter your address');
        return;
      }
      if (!(editData.houseNo || '').trim()) {
        alert('Please enter House No / Flat No');
        return;
      }
      if (!editData.pincode || !/^\d{6}$/.test(String(editData.pincode))) {
        alert('Please enter a valid 6-digit pincode');
        return;
      }
      const email = (editData.email || '').trim();
      if (!email || !validateEmail(email)) {
        alert('Please enter a valid email address');
        return;
      }

      const full = (editData.full_name || '').trim();
      const nameParts = full.split(/\s+/).filter(Boolean);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const { city: inferredCity, state: inferredState } = inferCityStateFromCommaAddress(addr);

      const houseNo = (editData.houseNo ?? '').trim();
      const floor = (editData.floor ?? '').trim();

      await apiClient.put(`/customer/profile/${encodeURIComponent(customerId)}`, {
        firstName,
        lastName,
        email,
        address: addr,
        pincode: editData.pincode,
        city: inferredCity ?? '',
        state: inferredState ?? '',
        houseNo,
        floor,
      });

      const updatedProfile = {
        ...profile,
        ...editData,
        email,
        address: addr,
        city: '',
        state: '',
        houseNo,
        floor,
      } as CustomerProfile;
      setProfile(updatedProfile);
      setEditData(updatedProfile);
      localStorage.setItem('customerProfile', JSON.stringify(updatedProfile));
      localStorage.setItem('customerData', JSON.stringify(updatedProfile));
      persistCustomerDatabaseId(updatedProfile);
      localStorage.setItem('profile_completed', 'true');
      setEditing(false);
    } catch (err) {
      console.error('Error saving profile:', err);
    }
  };

  const handleLogout = () => {
    clearCustomerSession();
    router.push('/auth');
  };

  const handleCreateProfileBack = useCallback(() => {
    if (typeof window === 'undefined') return;
    clearCustomerSession();
    router.replace('/auth');
  }, [router]);

  if (!flowReady || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (showCreateFlow) {
    const phone = typeof window !== 'undefined' ? localStorage.getItem('customerPhone') || '' : '';
    return (
      <CustomerUserProfile
        session={{ phone }}
        onComplete={handleCreateProfileComplete}
        onBack={handleCreateProfileBack}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex flex-col">
      {/* Header - Match consistency pattern: max-w-7xl mx-auto px-6 py-4 */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-orange-200 sticky top-0 z-10 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => goBackOrHome(router)}
              className="mt-1 text-2xl leading-none text-gray-700 hover:text-gray-900"
              aria-label="Go back"
            >
              ←
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
              <p className="text-sm text-gray-500 mt-1">Manage your account information</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Match consistency pattern: max-w-7xl mx-auto p-6 or p-8 */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-24">
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
                <label className="block text-sm font-medium text-gray-600 mb-2">Full Name</label>
                <input
                  type="text"
                  value={editData.full_name || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditData({ ...editData, full_name: e.target.value })}
                  className="w-full p-3 border-2 border-gray-200 rounded-xl bg-gray-50 focus:border-orange-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Email</label>
                <input
                  type="email"
                  value={editData.email || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditData({ ...editData, email: e.target.value })}
                  className="w-full p-3 border-2 border-gray-200 rounded-xl bg-gray-50 focus:border-orange-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Address</label>
                <textarea
                  value={editData.address || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setEditData({ ...editData, address: e.target.value })
                  }
                  placeholder={PROFILE_ADDRESS_FORMAT_PLACEHOLDER}
                  rows={4}
                  className="w-full p-3 border-2 border-gray-200 rounded-xl bg-gray-50 focus:border-orange-400 focus:outline-none resize-y min-h-[100px]"
                />
                <p className="text-xs text-gray-500 mt-1">Use commas between area, locality, city, state, and country.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  House No / Flat No <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editData.houseNo || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditData({ ...editData, houseNo: e.target.value })
                  }
                  placeholder="e.g., A-101, Flat 12B"
                  className="w-full p-3 border-2 border-gray-200 rounded-xl bg-gray-50 focus:border-orange-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Floor</label>
                <input
                  type="text"
                  value={editData.floor || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditData({ ...editData, floor: e.target.value })
                  }
                  placeholder="e.g., 1st Floor"
                  className="w-full p-3 border-2 border-gray-200 rounded-xl bg-gray-50 focus:border-orange-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Pincode</label>
                <input
                  type="text"
                  value={editData.pincode || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditData({ ...editData, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })
                  }
                  placeholder="6-digit PIN"
                  maxLength={6}
                  className="w-full p-3 border-2 border-gray-200 rounded-xl bg-gray-50 focus:border-orange-400 focus:outline-none"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    if (profile) setEditData(profile);
                    setEditing(false);
                  }}
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
              <div className="flex justify-between py-3 border-b items-start gap-4">
                <span className="text-gray-500 shrink-0">Address</span>
                <span className="font-medium text-right max-w-[65%] whitespace-pre-wrap">
                  {profile?.address || 'Not set'}
                </span>
              </div>
              <div className="flex justify-between py-3 border-b">
                <span className="text-gray-500">House / Flat</span>
                <span className="font-medium text-right max-w-[60%]">
                  {profile?.houseNo?.trim() ? profile.houseNo : 'Not set'}
                </span>
              </div>
              <div className="flex justify-between py-3 border-b">
                <span className="text-gray-500">Floor</span>
                <span className="font-medium">{profile?.floor?.trim() ? profile.floor : '—'}</span>
              </div>
              <div className="flex justify-between py-3 border-b">
                <span className="text-gray-500">Pincode</span>
                <span className="font-medium">{profile?.pincode || 'Not set'}</span>
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
            onClick={() => router.push('/wallet')}
            className="w-full p-4 bg-white rounded-xl shadow-sm flex items-center justify-between hover:shadow-md transition"
          >
            <span className="flex items-center gap-3">
              <span className="text-2xl">💰</span>
              <span className="font-medium">Wallet</span>
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
