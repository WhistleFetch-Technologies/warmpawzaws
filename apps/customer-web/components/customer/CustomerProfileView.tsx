'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Camera, Edit2, Save, X, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { uploadCustomerPhotoWithProgress } from '@/lib/photo-upload-enhanced';
import { toast } from 'sonner';
import { validateEmail } from '@/lib/validation';
import {
  inferCityStateFromCommaAddress,
  mergeStreetAddressLineOnly,
  PROFILE_ADDRESS_FORMAT_PLACEHOLDER,
} from '@/lib/profile-address-format';
import { PresignableImage } from '@/components/shared/PresignableImage';
import {
  normalizeCustomerProfileFields,
  patchCustomerProfileKeysInLocalStorage,
} from '@/lib/normalize-customer-profile-api';

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  pincode: string;
  houseNo: string;
  floor: string;
  city?: string;
  state?: string;
  photo?: string;
  created_at?: string;
}

interface CustomerProfileViewProps {
  phone: string;
  onBack: () => void;
}

export function CustomerProfileView({ phone, onBack }: CustomerProfileViewProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
  }, [phone]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const result = await apiClient.get<{ profile: Record<string, unknown> }>(
        `/customer/profile?phone=${encodeURIComponent(phone)}`
      );
      const raw = result.profile;
      if (!raw) return;
      const base = normalizeCustomerProfileFields(raw as any, phone);
      const addressLine = mergeStreetAddressLineOnly({
        address: base.address,
        city: base.city,
        state: base.state,
      });
      const houseNo = String((raw as any).houseNo ?? (raw as any).house_no ?? '').trim();
      const floor = String((raw as any).floor ?? '').trim();
      const { city: inferredCity, state: inferredState } = inferCityStateFromCommaAddress(addressLine);
      const normalized: UserProfile = {
        firstName: base.firstName,
        lastName: base.lastName,
        email: base.email,
        phone: base.phone,
        address: addressLine,
        pincode: base.pincode,
        houseNo,
        floor,
        city: inferredCity ?? base.city,
        state: inferredState ?? base.state,
        photo: base.photo,
        created_at: (raw as any).created_at ?? (raw as any).createdAt,
      };
      setProfile(normalized);
      setPhotoPreview(base.photo || '');
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    // Show preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload photo with progress
    setUploadingPhoto(true);
    setUploadProgress(0);

    try {
      const result = await uploadCustomerPhotoWithProgress(
        file,
        phone,
        {
          onProgress: (progress) => {
            setUploadProgress(progress);
          },
          verifyUpload: true,
        }
      );

      if (result.success && result.publicUrl) {
        setUploadedPhotoUrl(result.publicUrl);
        setPhotoPreview(result.publicUrl);
        setProfile({ ...profile, photo: result.publicUrl });
        toast.success('Photo uploaded successfully!');
      } else {
        toast.error(result.error || 'Failed to upload photo. Please try again.');
        // Reset preview on error
        setPhotoPreview(profile.photo || '');
      }
    } catch (error: any) {
      console.error('Photo upload error:', error);
      toast.error(error.message || 'Failed to upload photo. Please try again.');
      setPhotoPreview(profile.photo || '');
    } finally {
      setUploadingPhoto(false);
      setUploadProgress(0);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    // Validation
    if (!profile.firstName || !profile.lastName || !profile.email || !profile.address || !profile.pincode) {
      alert('Please fill in all required fields');
      return;
    }

    if (!profile.houseNo?.trim()) {
      alert('Please enter House No / Flat No');
      return;
    }

    if (!validateEmail(profile.email)) {
      alert('Please enter a valid email address');
      return;
    }

    if (!/^\d{6}$/.test(profile.pincode)) {
      alert('Please enter a valid 6-digit pincode');
      return;
    }

    setSaving(true);
    try {
      // Use uploaded photo URL if available, otherwise keep existing
      const addr = profile.address.trim();
      const { city: inferredCity, state: inferredState } = inferCityStateFromCommaAddress(addr);
      const profileToSave = {
        ...profile,
        address: addr,
        city: inferredCity ?? profile.city,
        state: inferredState ?? profile.state,
        houseNo: profile.houseNo.trim(),
        floor: (profile.floor || '').trim(),
        photo: uploadedPhotoUrl || profile.photo,
      };

      await apiClient.post('/customer/profile', {
        phone: phone,
        profile: profileToSave,
      });

      patchCustomerProfileKeysInLocalStorage({
        pincode: profileToSave.pincode,
        address: profileToSave.address,
        city: profileToSave.city,
        state: profileToSave.state,
      });
      setProfile(profileToSave);

      setEditMode(false);
      setUploadedPhotoUrl(''); // Reset after save
      toast.success('Profile updated successfully! 🎉');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Error saving profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center w-full max-w-customer mx-auto">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center w-full max-w-customer mx-auto">
        <div className="text-center px-6">
          <p className="text-gray-600 mb-4">Profile not found</p>
          <Button onClick={onBack} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col w-full max-w-customer mx-auto">
      {/* Header — real device status bar is system-drawn; use safe-area padding only */}
      <div className="cw-header-safe-top cw-header-safe-x pb-4 flex items-center justify-between border-b border-gray-200">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-black">My Profile</h1>
        <button 
          onClick={() => editMode ? setEditMode(false) : setEditMode(true)}
          className="p-2 -mr-2 hover:bg-gray-100 rounded-full"
        >
          {editMode ? (
            <X className="w-6 h-6 text-gray-700" />
          ) : (
            <Edit2 className="w-5 h-5 text-[#FF8C42]" />
          )}
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="px-6 py-6">
          {/* Profile Photo */}
          <div className="flex flex-col items-center mb-8">
            <div 
              onClick={() => editMode && !uploadingPhoto && fileInputRef.current?.click()}
              className={`w-32 h-32 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full overflow-hidden flex items-center justify-center border-4 border-white shadow-lg mb-3 relative group ${editMode && !uploadingPhoto ? 'cursor-pointer' : ''} ${uploadingPhoto ? 'opacity-75' : ''}`}
            >
              {photoPreview ? (
                <>
                  <PresignableImage src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                  {uploadingPhoto && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center">
                      <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
                      <span className="text-white text-xs">{uploadProgress}%</span>
                    </div>
                  )}
                  {editMode && !uploadingPhoto && (
                    <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="w-8 h-8 text-white" />
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center text-white">
                  {uploadingPhoto ? (
                    <>
                      <Loader2 className="w-8 h-8 animate-spin mb-2" />
                      <span className="text-xs">{uploadProgress}%</span>
                    </>
                  ) : (
                    <span className="text-4xl font-bold">
                      {profile.firstName?.charAt(0)}{profile.lastName?.charAt(0)}
                    </span>
                  )}
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              disabled={uploadingPhoto}
              className="hidden"
            />
            {editMode && (
              <div className="text-center">
                <p className="text-xs text-gray-500">
                  {uploadingPhoto ? 'Uploading...' : 'Click photo to change'}
                </p>
                {uploadingPhoto && (
                  <div className="mt-2 w-48 bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-orange-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Profile Information */}
          <div className="space-y-4">
            {/* Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  First Name
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={profile.firstName}
                    onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                  />
                ) : (
                  <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">
                    {profile.firstName}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Last Name
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={profile.lastName}
                    onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                  />
                ) : (
                  <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">
                    {profile.lastName}
                  </p>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">
                Email Address
              </label>
              {editMode ? (
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                />
              ) : (
                <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">
                  {profile.email}
                </p>
              )}
            </div>

            {/* Phone (Read-only) */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">
                Phone Number
              </label>
              <p className="text-black font-medium px-4 py-3 bg-gray-100 rounded-xl cursor-not-allowed">
                {profile.phone}
              </p>
            </div>

            {/* Address — single comma-separated field (area, locality, city, state, country) */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">
                Address
              </label>
              {editMode ? (
                <>
                  <textarea
                    value={profile.address}
                    onChange={(e) => {
                      const address = e.target.value;
                      const { city: c, state: s } = inferCityStateFromCommaAddress(address);
                      setProfile((prev) =>
                        prev ? { ...prev, address, city: c ?? prev.city, state: s ?? prev.state } : null
                      );
                    }}
                    placeholder={PROFILE_ADDRESS_FORMAT_PLACEHOLDER}
                    rows={4}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none resize-y min-h-[100px]"
                  />
                  <p className="text-xs text-gray-500 mt-1.5">
                    Separate parts with commas: area, locality, city, state, country.
                  </p>
                </>
              ) : (
                <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl whitespace-pre-wrap">
                  {profile.address}
                </p>
              )}
            </div>

            {/* House No / Flat No — same as account creation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                House No / Flat No <span className="text-red-500">*</span>
              </label>
              {editMode ? (
                <input
                  type="text"
                  value={profile.houseNo}
                  onChange={(e) => setProfile({ ...profile, houseNo: e.target.value })}
                  placeholder="e.g., A-101, Flat 12B"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                />
              ) : (
                <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">
                  {profile.houseNo?.trim() || '—'}
                </p>
              )}
            </div>

            {/* Floor (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Floor</label>
              {editMode ? (
                <input
                  type="text"
                  value={profile.floor}
                  onChange={(e) => setProfile({ ...profile, floor: e.target.value })}
                  placeholder="e.g., 1st Floor"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                />
              ) : (
                <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">
                  {profile.floor?.trim() || '—'}
                </p>
              )}
            </div>

            {/* Pincode */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">
                Pincode
              </label>
              {editMode ? (
                <input
                  type="text"
                  value={profile.pincode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setProfile({ ...profile, pincode: value });
                  }}
                  maxLength={6}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
                />
              ) : (
                <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">
                  {profile.pincode}
                </p>
              )}
            </div>
          </div>

          {/* Account Info */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Account Information</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-600">Member Since</span>
                <span className="text-sm font-medium text-black">
                  {new Date(profile.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-600">Profile Status</span>
                <span className="text-sm font-medium text-green-600">✓ Verified</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Button */}
      {editMode && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 max-w-customer mx-auto w-full">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 bg-[#FF8C42] hover:bg-[#FF7A2E] rounded-xl text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>

          {/* Home Indicator */}
          <div className="flex justify-center mt-4">
            <div className="w-32 h-1 bg-black rounded-full"></div>
          </div>
        </div>
      )}

      {/* Home Indicator (when not in edit mode) */}
      {!editMode && (
        <div className="fixed bottom-0 left-0 right-0 bg-white px-6 py-4 max-w-customer mx-auto w-full">
          <div className="flex justify-center">
            <div className="w-32 h-1 bg-black rounded-full"></div>
          </div>
        </div>
      )}
    </div>
  );
}
