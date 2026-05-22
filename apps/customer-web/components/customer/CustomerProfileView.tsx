'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { User, Camera, Edit2, Loader2 } from 'lucide-react';
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
import { ServiceDashboardHeader } from '@/components/customer/shared/ServiceDashboardHeader';
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
  /** X on header — exit to app home (same as account sidebar / wallet). */
  onCloseToHome?: () => void;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-gray-500 mb-2">{children}</label>;
}

function ReadOnlyField({ value }: { value: string }) {
  return (
    <p className="text-gray-900 font-medium px-4 py-3 bg-gray-100 rounded-xl min-h-[48px] flex items-center">
      {value || '—'}
    </p>
  );
}

export function CustomerProfileView({ phone, onBack, onCloseToHome }: CustomerProfileViewProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [savedProfile, setSavedProfile] = useState<UserProfile | null>(null);
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

  const fetchAndApplyProfile = async (showLoadingSpinner: boolean) => {
    try {
      if (showLoadingSpinner) setLoading(true);
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
      setSavedProfile(normalized);
      setPhotoPreview(base.photo || '');
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      if (showLoadingSpinner) setLoading(false);
    }
  };

  const loadProfile = () => fetchAndApplyProfile(true);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setUploadingPhoto(true);
    setUploadProgress(0);

    try {
      const result = await uploadCustomerPhotoWithProgress(file, phone, {
        onProgress: (progress) => setUploadProgress(progress),
        verifyUpload: true,
      });

      if (result.success && result.publicUrl) {
        setUploadedPhotoUrl(result.publicUrl);
        setPhotoPreview(result.publicUrl);
        setProfile({ ...profile, photo: result.publicUrl });
        toast.success('Photo uploaded successfully!');
      } else {
        toast.error(result.error || 'Failed to upload photo. Please try again.');
        setPhotoPreview(profile.photo || '');
      }
    } catch (error: unknown) {
      console.error('Photo upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload photo. Please try again.');
      setPhotoPreview(profile.photo || '');
    } finally {
      setUploadingPhoto(false);
      setUploadProgress(0);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

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
        phone,
        profile: profileToSave,
      });

      patchCustomerProfileKeysInLocalStorage({
        pincode: profileToSave.pincode,
        address: profileToSave.address,
        city: profileToSave.city,
        state: profileToSave.state,
        photo: profileToSave.photo || '',
        houseNo: profileToSave.houseNo,
        floor: profileToSave.floor,
      });
      setEditMode(false);
      setUploadedPhotoUrl('');
      toast.success('Profile updated successfully!');
      // Silently re-fetch from API so photo, houseNo, etc. reflect what is actually stored in the DB
      await fetchAndApplyProfile(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Error saving profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const displayName = profile
    ? [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() || 'Account'
    : 'Account';

  const headerIcon = (
    <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white">
      {photoPreview ? (
        <PresignableImage src={photoPreview} alt="" className="h-full w-full object-cover" />
      ) : (
        <User className="h-6 w-6 text-[#FF8C42]" />
      )}
    </span>
  );

  const header = (
    <ServiceDashboardHeader
      serviceName={loading ? 'Account' : displayName}
      serviceSubtitle={loading ? undefined : phone}
      serviceIcon={headerIcon}
      iconColor="text-white"
      stats={[]}
      onCloseToHome={onCloseToHome}
      onBack={onBack}
      showBackButton
      bottomEdge="sheet"
      sheetToneClass="bg-gray-50"
    />
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-customer mx-auto">
        {header}
        <div className="-mt-1 flex items-center justify-center py-24">
          <div className="w-12 h-12 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-customer mx-auto">
        {header}
        <div className="-mt-1 flex flex-col items-center justify-center px-6 py-24">
          <p className="text-gray-600 mb-4">Profile not found</p>
          <Button onClick={onBack} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const inputClass =
    'w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-white focus:border-[#FF8C42] focus:outline-none';

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-customer mx-auto">
      {header}

      <div className="-mt-1 pb-28">
        <div className="px-5 pt-5 pb-6">
          <div className="flex items-center justify-between gap-3 mb-5">
            <h2 className="text-xl font-bold text-gray-900">My Profile</h2>
            {!editMode ? (
              <button
                type="button"
                onClick={() => setEditMode(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm active:scale-[0.98]"
              >
                <Edit2 className="w-4 h-4 text-gray-600" />
                Edit Profile
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (savedProfile) {
                    setProfile(savedProfile);
                    setPhotoPreview(savedProfile.photo || '');
                  }
                  setEditMode(false);
                  setUploadedPhotoUrl('');
                }}
                className="text-sm font-medium text-gray-600 px-3 py-2"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="flex justify-center mb-8">
            <div
              onClick={() => editMode && !uploadingPhoto && fileInputRef.current?.click()}
              className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden flex items-center justify-center border-4 border-white shadow-lg bg-gray-200 relative ${
                editMode && !uploadingPhoto ? 'cursor-pointer' : ''
              } ${uploadingPhoto ? 'opacity-75' : ''}`}
            >
              {photoPreview ? (
                <>
                  <PresignableImage src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                  {uploadingPhoto && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
                      <Loader2 className="w-8 h-8 text-white animate-spin mb-1" />
                      <span className="text-white text-xs">{uploadProgress}%</span>
                    </div>
                  )}
                  {editMode && !uploadingPhoto && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <Camera className="w-8 h-8 text-white" />
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-400 w-full h-full">
                  {uploadingPhoto ? (
                    <>
                      <Loader2 className="w-10 h-10 animate-spin mb-1" />
                      <span className="text-xs text-gray-500">{uploadProgress}%</span>
                    </>
                  ) : (
                    <User className="w-16 h-16 sm:w-20 sm:h-20" strokeWidth={1.25} />
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
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>First Name</FieldLabel>
                {editMode ? (
                  <input
                    type="text"
                    value={profile.firstName}
                    onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                    className={inputClass}
                  />
                ) : (
                  <ReadOnlyField value={profile.firstName} />
                )}
              </div>
              <div>
                <FieldLabel>Last Name</FieldLabel>
                {editMode ? (
                  <input
                    type="text"
                    value={profile.lastName}
                    onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                    className={inputClass}
                  />
                ) : (
                  <ReadOnlyField value={profile.lastName} />
                )}
              </div>
            </div>

            <div>
              <FieldLabel>Phone Number</FieldLabel>
              <ReadOnlyField value={profile.phone} />
            </div>

            <div>
              <FieldLabel>Email</FieldLabel>
              {editMode ? (
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className={inputClass}
                />
              ) : (
                <ReadOnlyField value={profile.email} />
              )}
            </div>

            <div>
              <FieldLabel>Address</FieldLabel>
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
                    className={`${inputClass} resize-y min-h-[100px]`}
                  />
                  <p className="text-xs text-gray-500 mt-1.5">
                    Separate parts with commas: area, locality, city, state, country.
                  </p>
                </>
              ) : (
                <ReadOnlyField value={profile.address} />
              )}
            </div>

            <div>
              <FieldLabel>
                House No / Flat No {editMode && <span className="text-red-500">*</span>}
              </FieldLabel>
              {editMode ? (
                <input
                  type="text"
                  value={profile.houseNo}
                  onChange={(e) => setProfile({ ...profile, houseNo: e.target.value })}
                  placeholder="e.g., A-101, Flat 12B"
                  className={inputClass}
                />
              ) : (
                <ReadOnlyField value={profile.houseNo} />
              )}
            </div>

            <div>
              <FieldLabel>Floor</FieldLabel>
              {editMode ? (
                <input
                  type="text"
                  value={profile.floor}
                  onChange={(e) => setProfile({ ...profile, floor: e.target.value })}
                  placeholder="e.g., 1st Floor"
                  className={inputClass}
                />
              ) : (
                <ReadOnlyField value={profile.floor} />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>City</FieldLabel>
                {editMode ? (
                  <input
                    type="text"
                    value={profile.city ?? ''}
                    onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                    placeholder="Bengaluru"
                    className={inputClass}
                  />
                ) : (
                  <ReadOnlyField value={profile.city ?? ''} />
                )}
              </div>
              <div>
                <FieldLabel>State</FieldLabel>
                {editMode ? (
                  <input
                    type="text"
                    value={profile.state ?? ''}
                    onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                    placeholder="Karnataka"
                    className={inputClass}
                  />
                ) : (
                  <ReadOnlyField value={profile.state ?? ''} />
                )}
              </div>
            </div>

            <div>
              <FieldLabel>Pincode</FieldLabel>
              {editMode ? (
                <input
                  type="text"
                  value={profile.pincode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setProfile({ ...profile, pincode: value });
                  }}
                  maxLength={6}
                  className={inputClass}
                />
              ) : (
                <ReadOnlyField value={profile.pincode} />
              )}
            </div>
          </div>
        </div>
      </div>

      {editMode && (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 bg-white px-5 py-4 max-w-customer mx-auto w-full pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 bg-[#FF8C42] hover:bg-[#FF7A2E] rounded-xl text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}
    </div>
  );
}
