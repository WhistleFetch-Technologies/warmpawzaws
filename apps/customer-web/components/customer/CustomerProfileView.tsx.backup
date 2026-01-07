'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Camera, Edit2, Save, X, User } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  pincode: string;
  photo?: string;
}

interface CustomerProfileViewProps {
  phone: string;
  onBack: () => void;
}

export function CustomerProfileView({ phone, onBack }: CustomerProfileViewProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [originalProfile, setOriginalProfile] = useState<UserProfile | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
  }, [phone]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ profile: UserProfile }>(`/customer/profile/${phone}`);
      if (response.profile) {
        setProfile(response.profile);
        setPhotoPreview(response.profile.photo || '');
        setOriginalProfile(response.profile);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      // Set default profile if not found
      setProfile({
        firstName: '',
        lastName: '',
        email: '',
        phone: phone,
        address: '',
        pincode: '',
        photo: ''
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && profile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
        setProfile({ ...profile, photo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    // Validation
    if (!profile.firstName || !profile.lastName || !profile.email || !profile.address || !profile.pincode) {
      alert('Please fill in all required fields');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(profile.email)) {
      alert('Please enter a valid email address');
      return;
    }

    if (!/^\d{6}$/.test(profile.pincode)) {
      alert('Please enter a valid 6-digit pincode');
      return;
    }

    setSaving(true);
    try {
      await apiClient.post('/customer/profile', {
        phone: phone,
        profile: profile,
      });

      setEditMode(false);
      await loadProfile();
      alert('Profile updated successfully! 🎉');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Error saving profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (originalProfile) {
      setProfile(originalProfile);
      setPhotoPreview(originalProfile.photo || '');
    }
    setEditMode(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center w-full max-w-[430px] mx-auto">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center w-full max-w-[430px] mx-auto">
        <div className="text-center px-6">
          <p className="text-gray-600 mb-4">Profile not found</p>
          <button 
            onClick={onBack} 
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col w-full max-w-[430px] mx-auto">
      {/* Status Bar */}
      <div className="px-6 pt-3 pb-2 flex justify-between items-center">
        <span className="text-black text-sm">09:41</span>
        <div className="flex gap-1.5 items-center">
          <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
            <rect y="8" width="3" height="4" rx="0.5" fill="black"/>
            <rect x="4.5" y="5" width="3" height="7" rx="0.5" fill="black"/>
            <rect x="9" y="2" width="3" height="10" rx="0.5" fill="black"/>
            <rect x="13.5" y="0" width="3" height="12" rx="0.5" fill="black"/>
          </svg>
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
            <path d="M0.5 7.5C2.5 5.5 5.5 4 8 4C10.5 4 13.5 5.5 15.5 7.5M3.5 10C5 8.5 6.5 8 8 8C9.5 8 11 8.5 12.5 10" stroke="black" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
            <rect x="0.75" y="1.5" width="20" height="9" rx="2" stroke="black" strokeWidth="1.5"/>
            <rect x="2.5" y="3" width="16.5" height="6" rx="1" fill="black"/>
            <rect x="22" y="4" width="2.5" height="4" rx="1" fill="black"/>
          </svg>
        </div>
      </div>

      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-3 border-b border-gray-200">
        <button
          onClick={editMode ? handleCancelEdit : onBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">My Profile</h1>
        {!editMode && (
          <button
            onClick={() => setEditMode(true)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Edit2 className="w-5 h-5 text-primary" />
          </button>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="px-6 py-6">
          {/* Photo */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 border-4 border-white shadow-lg">
                {photoPreview ? (
                  <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-16 h-16 text-gray-400" />
                  </div>
                )}
              </div>
              {editMode && (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                  >
                    <Camera className="w-6 h-6 text-white" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-3">
              {profile.firstName} {profile.lastName}
            </p>
          </div>

          {/* Profile Fields */}
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2.5">First Name</label>
                {editMode ? (
                  <input
                    type="text"
                    value={profile.firstName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfile({ ...profile, firstName: e.target.value })}
                    className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                  />
                ) : (
                  <p className="text-black font-medium px-4 py-3.5 bg-gray-50 rounded-xl">{profile.firstName || '-'}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2.5">Last Name</label>
                {editMode ? (
                  <input
                    type="text"
                    value={profile.lastName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfile({ ...profile, lastName: e.target.value })}
                    className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                  />
                ) : (
                  <p className="text-black font-medium px-4 py-3.5 bg-gray-50 rounded-xl">{profile.lastName || '-'}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2.5">Phone Number</label>
              <p className="text-black font-medium px-4 py-3.5 bg-gray-100 rounded-xl">{profile.phone}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2.5">Email</label>
              {editMode ? (
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                />
              ) : (
                <p className="text-black font-medium px-4 py-3.5 bg-gray-50 rounded-xl">{profile.email || '-'}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2.5">Address</label>
              {editMode ? (
                <textarea
                  value={profile.address}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setProfile({ ...profile, address: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none resize-none"
                />
              ) : (
                <p className="text-black font-medium px-4 py-3.5 bg-gray-50 rounded-xl">{profile.address || '-'}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2.5">Pincode</label>
              {editMode ? (
                <input
                  type="text"
                  value={profile.pincode}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setProfile({ ...profile, pincode: value });
                  }}
                  maxLength={6}
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                />
              ) : (
                <p className="text-black font-medium px-4 py-3.5 bg-gray-50 rounded-xl">{profile.pincode || '-'}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Navigation */}
      {editMode && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 max-w-[430px] mx-auto w-full">
          <div className="flex gap-3">
            <button
              onClick={handleCancelEdit}
              className="flex-1 h-12 border-2 border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-12 bg-primary hover:bg-primary-dark rounded-xl text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save
                </>
              )}
            </button>
          </div>

          {/* Home Indicator */}
          <div className="flex justify-center mt-4">
            <div className="w-32 h-1 bg-black rounded-full"></div>
          </div>
        </div>
      )}
    </div>
  );
}

