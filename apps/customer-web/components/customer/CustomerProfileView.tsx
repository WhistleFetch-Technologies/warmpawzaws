'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  User,
  Camera,
  Edit2,
  Loader2,
  Mail,
  Phone,
  MapPin,
  Home,
  Building2,
  MapPinned,
} from 'lucide-react';
import { apiClient, ordersApi } from '@/lib/api-client';
import { uploadCustomerPhotoWithProgress } from '@/lib/photo-upload-enhanced';
import { toast } from 'sonner';
import { validateEmail } from '@/lib/validation';
import { inferCityStateFromCommaAddress, mergeStreetAddressLineOnly } from '@/lib/profile-address-format';
import { EnhancedAddressAutocomplete, AddressComponents } from '@/components/shared/EnhancedAddressAutocomplete';
import { UseCurrentLocationButton } from '@/components/shared/UseCurrentLocationButton';
import type { AddressFromGeolocationResult } from '@/lib/address-from-geolocation';
import { PresignableImage } from '@/components/shared/PresignableImage';
import {
  normalizeCustomerProfileFields,
  patchCustomerProfileKeysInLocalStorage,
} from '@/lib/normalize-customer-profile-api';
import { formatMemberSinceLabel } from '@/lib/format-member-since';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import { clearCustomerSession } from '@/lib/session-utils';
import { ProfileAccountHero } from '@/components/customer/profile/ProfileAccountHero';
import { ProfileStatCards, type ProfileStatCounts } from '@/components/customer/profile/ProfileStatCards';
import { ProfileQuickActions } from '@/components/customer/profile/ProfileQuickActions';
import { ProfileInfoSection } from '@/components/customer/profile/ProfileInfoSection';
import { ProfileFieldLabel } from '@/components/customer/profile/ProfileFieldLabel';
import { ProfileReadOnlyField } from '@/components/customer/profile/ProfileReadOnlyField';

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
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string;
}

interface CustomerProfileViewProps {
  phone: string;
  onBack: () => void;
  /** X on header — exit to app home (same as account sidebar / wallet). */
  onCloseToHome?: () => void;
}

const INITIAL_COUNTS: ProfileStatCounts = {
  orders: null,
  pets: null,
  saved: null,
};

export function CustomerProfileView({ phone, onBack, onCloseToHome }: CustomerProfileViewProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [savedProfile, setSavedProfile] = useState<UserProfile | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string>('');
  const [statCounts, setStatCounts] = useState<ProfileStatCounts>(INITIAL_COUNTS);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addressSectionRef = useRef<HTMLDivElement>(null);

  const handleCloseToHome = onCloseToHome ?? onBack;

  useEffect(() => {
    loadProfile();
  }, [phone]);

  const loadStatCounts = useCallback(async () => {
    setStatCounts(INITIAL_COUNTS);

    const setCount = (key: keyof ProfileStatCounts, value: number) => {
      setStatCounts((prev) => ({ ...prev, [key]: value }));
    };

    const petsPromise = apiClient
      .get<{ pets?: unknown[] }>(`/customer/pets/${encodeURIComponent(phone)}`)
      .then((r) => setCount('pets', Array.isArray(r.pets) ? r.pets.length : 0))
      .catch(() => setCount('pets', 0));

    const savedPromise = apiClient
      .get<{ savedItems?: unknown[] }>(`/customer/saved/${phone}`)
      .then((r) => setCount('saved', Array.isArray(r.savedItems) ? r.savedItems.length : 0))
      .catch(() => setCount('saved', 0));

    const ordersPromise = (async () => {
      try {
        const customerId = getResolvedCustomerId();
        if (customerId) {
          const result = await ordersApi.list({ customerId });
          const rawList = (result as { orders?: unknown[] })?.orders;
          if (Array.isArray(rawList)) {
            setCount('orders', rawList.length);
            return;
          }
        }
      } catch {
        /* fall through to bookings */
      }
      try {
        const result = await apiClient.get<{ bookings?: unknown[] }>(
          `/customer/bookings?phone=${encodeURIComponent(phone)}`
        );
        setCount('orders', Array.isArray(result.bookings) ? result.bookings.length : 0);
      } catch {
        setCount('orders', 0);
      }
    })();

    await Promise.all([petsPromise, savedPromise, ordersPromise]);
  }, [phone]);

  useEffect(() => {
    if (!loading && profile) {
      loadStatCounts();
    }
  }, [loading, profile, loadStatCounts]);

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
      const latRaw = (raw as any).latitude ?? (raw as any).lat;
      const lngRaw = (raw as any).longitude ?? (raw as any).lng;
      const latitude =
        latRaw != null && Number.isFinite(Number(latRaw)) ? Number(latRaw) : undefined;
      const longitude =
        lngRaw != null && Number.isFinite(Number(lngRaw)) ? Number(lngRaw) : undefined;

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
        latitude,
        longitude,
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

  const cancelEdit = () => {
    if (savedProfile) {
      setProfile(savedProfile);
      setPhotoPreview(savedProfile.photo || '');
    }
    setEditMode(false);
    setUploadedPhotoUrl('');
  };

  const enterEditMode = (scrollToAddress?: boolean) => {
    setEditMode(true);
    if (scrollToAddress) {
      requestAnimationFrame(() => {
        addressSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

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
        ...(profile.latitude != null &&
          profile.longitude != null &&
          Number.isFinite(profile.latitude) &&
          Number.isFinite(profile.longitude) && {
            latitude: profile.latitude,
            longitude: profile.longitude,
            coordinates: { lat: profile.latitude, lng: profile.longitude },
          }),
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
      await fetchAndApplyProfile(false);
      loadStatCounts();
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Error saving profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    clearCustomerSession();
    router.replace('/auth');
  };

  const displayName = profile
    ? [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() || 'Account'
    : 'Account';

  const memberSinceLabel = formatMemberSinceLabel(profile?.created_at);

  const hero = (
    <ProfileAccountHero
      displayName={loading ? 'Account' : displayName}
      phone={loading ? '' : phone}
      photoUrl={photoPreview || profile?.photo}
      loading={loading}
      memberSinceLabel={memberSinceLabel}
      onCloseToHome={handleCloseToHome}
      onBack={onBack}
      editMode={editMode}
      onPhotoClick={editMode ? () => fileInputRef.current?.click() : undefined}
      uploadingPhoto={uploadingPhoto}
      uploadProgress={uploadProgress}
    />
  );

  if (loading) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-customer bg-[#F5F5F5]">
        {hero}
        <div className="flex items-center justify-center py-24">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#FF8C42] border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-customer bg-[#F5F5F5]">
        {hero}
        <div className="flex flex-col items-center justify-center px-6 py-24">
          <p className="mb-4 text-gray-600">Profile not found</p>
          <Button onClick={onBack} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const inputClass =
    'w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 focus:border-[#FF8C42] focus:outline-none';

  const profileForm = (
    <div className="space-y-4">
      {!editMode && (
        <div className="flex justify-center mb-6">
          <div className="relative h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-gray-200 shadow-lg sm:h-32 sm:w-32">
            {photoPreview ? (
              <PresignableImage src={photoPreview} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gray-400">
                <User className="h-16 w-16 sm:h-20 sm:w-20" strokeWidth={1.25} />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <ProfileFieldLabel>First Name</ProfileFieldLabel>
          {editMode ? (
            <input
              type="text"
              value={profile.firstName}
              onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
              className={inputClass}
            />
          ) : (
            <ProfileReadOnlyField value={profile.firstName} />
          )}
        </div>
        <div>
          <ProfileFieldLabel>Last Name</ProfileFieldLabel>
          {editMode ? (
            <input
              type="text"
              value={profile.lastName}
              onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
              className={inputClass}
            />
          ) : (
            <ProfileReadOnlyField value={profile.lastName} />
          )}
        </div>
      </div>

      <div>
        <ProfileFieldLabel>Phone Number</ProfileFieldLabel>
        <ProfileReadOnlyField value={profile.phone} />
      </div>

      <div>
        <ProfileFieldLabel>Email</ProfileFieldLabel>
        {editMode ? (
          <input
            type="email"
            value={profile.email}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            className={inputClass}
          />
        ) : (
          <ProfileReadOnlyField value={profile.email} />
        )}
      </div>

      <div ref={addressSectionRef}>
        <ProfileFieldLabel>Address</ProfileFieldLabel>
        {editMode ? (
          <>
            <UseCurrentLocationButton
              className="mb-3"
              onSuccess={(result: AddressFromGeolocationResult) => {
                setProfile((prev) => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    address: result.addressLine1 ?? prev.address,
                    city: result.city ?? prev.city,
                    state: result.state ?? prev.state,
                    pincode: result.pincode ?? prev.pincode,
                    latitude: result.latitude,
                    longitude: result.longitude,
                  };
                });
              }}
            />
            <EnhancedAddressAutocomplete
              value={profile.address}
              onChange={(address: string, components?: AddressComponents) => {
                setProfile((prev) => {
                  if (!prev) return null;
                  const updated = { ...prev, address };
                  if (components?.pincode) updated.pincode = components.pincode;
                  if (components?.city) updated.city = components.city;
                  if (components?.state) updated.state = components.state;
                  if (components?.coordinates) {
                    updated.latitude = components.coordinates.lat;
                    updated.longitude = components.coordinates.lng;
                  } else {
                    const { city: c, state: s } = inferCityStateFromCommaAddress(address);
                    if (c) updated.city = c;
                    if (s) updated.state = s;
                  }
                  return updated;
                });
              }}
              placeholder="Search address, landmark, city..."
              className="w-full"
              required
            />
            <p className="mt-1.5 text-xs text-gray-500">
              Type to search for your address, landmark or area
            </p>
          </>
        ) : (
          <ProfileReadOnlyField value={profile.address} />
        )}
      </div>

      <div>
        <ProfileFieldLabel>
          House No / Flat No {editMode && <span className="text-red-500">*</span>}
        </ProfileFieldLabel>
        {editMode ? (
          <input
            type="text"
            value={profile.houseNo}
            onChange={(e) => setProfile({ ...profile, houseNo: e.target.value })}
            placeholder="e.g., A-101, Flat 12B"
            className={inputClass}
          />
        ) : (
          <ProfileReadOnlyField value={profile.houseNo} />
        )}
      </div>

      <div>
        <ProfileFieldLabel>Floor</ProfileFieldLabel>
        {editMode ? (
          <input
            type="text"
            value={profile.floor}
            onChange={(e) => setProfile({ ...profile, floor: e.target.value })}
            placeholder="e.g., 1st Floor"
            className={inputClass}
          />
        ) : (
          <ProfileReadOnlyField value={profile.floor} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <ProfileFieldLabel>City</ProfileFieldLabel>
          {editMode ? (
            <input
              type="text"
              value={profile.city ?? ''}
              onChange={(e) => setProfile({ ...profile, city: e.target.value })}
              placeholder="Bengaluru"
              className={inputClass}
            />
          ) : (
            <ProfileReadOnlyField value={profile.city ?? ''} />
          )}
        </div>
        <div>
          <ProfileFieldLabel>State</ProfileFieldLabel>
          {editMode ? (
            <input
              type="text"
              value={profile.state ?? ''}
              onChange={(e) => setProfile({ ...profile, state: e.target.value })}
              placeholder="Karnataka"
              className={inputClass}
            />
          ) : (
            <ProfileReadOnlyField value={profile.state ?? ''} />
          )}
        </div>
      </div>

      <div>
        <ProfileFieldLabel>Pincode</ProfileFieldLabel>
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
          <ProfileReadOnlyField value={profile.pincode} />
        )}
      </div>
    </div>
  );

  return (
    <div className="mx-auto min-h-screen w-full max-w-customer bg-[#F5F5F5]">
      {hero}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoUpload}
        disabled={uploadingPhoto}
        className="hidden"
      />

      <div className={`pb-28 ${editMode ? 'pt-2' : ''}`}>
        {!editMode ? (
          <>
            <ProfileStatCards
              counts={statCounts}
              onViewOrders={() => router.push('/orders')}
              onViewPets={() => router.push('/pets')}
              onViewSaved={() => router.push('/wishlist')}
            />

            <div className="mt-3 space-y-5 pb-4 sm:mt-4">
              <ProfileQuickActions
                onEditProfile={() => enterEditMode()}
                onChangePassword={() =>
                  router.push('/auth/set-password?next=/profile')
                }
                onManageAddress={() => enterEditMode(true)}
                onFavouritePets={() => router.push('/wishlist')}
                onLogout={handleLogout}
              />

              <div className="space-y-4 px-4 sm:px-5">
                <ProfileInfoSection
                  title="Personal Information"
                  titleIcon={User}
                  onEdit={() => enterEditMode()}
                  rows={[
                    { label: 'First Name', value: profile.firstName, icon: User },
                    { label: 'Last Name', value: profile.lastName, icon: User },
                    { label: 'Phone Number', value: profile.phone, icon: Phone },
                    { label: 'Email', value: profile.email, icon: Mail },
                  ]}
                />

                <ProfileInfoSection
                  title="Address Information"
                  titleIcon={MapPin}
                  onEdit={() => enterEditMode(true)}
                  rows={[
                    { label: 'Address', value: profile.address, icon: MapPin },
                    { label: 'House No / Flat No', value: profile.houseNo, icon: Home },
                    { label: 'Floor', value: profile.floor, icon: Building2 },
                    { label: 'City', value: profile.city ?? '', icon: MapPinned },
                    { label: 'State', value: profile.state ?? '', icon: MapPinned },
                    { label: 'Pincode', value: profile.pincode, icon: MapPinned },
                  ]}
                />
              </div>

              <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
                <button
                  type="button"
                  onClick={() => enterEditMode()}
                  className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#FF8C42] text-base font-bold text-white shadow-[0_4px_14px_rgba(255,140,66,0.35)] active:scale-[0.98] hover:bg-[#FF7A2E]"
                >
                  <Edit2 className="h-5 w-5" strokeWidth={2} />
                  Edit Profile
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="px-5 pb-6 pt-2">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-gray-900">Edit Profile</h2>
              <button
                type="button"
                onClick={cancelEdit}
                className="min-h-[44px] px-3 py-2 text-sm font-medium text-gray-600"
              >
                Cancel
              </button>
            </div>

            <div className="mb-6 flex justify-center sm:hidden">
              <div
                onClick={() => !uploadingPhoto && fileInputRef.current?.click()}
                className={`relative h-28 w-28 cursor-pointer overflow-hidden rounded-full border-4 border-white bg-gray-200 shadow-lg ${
                  uploadingPhoto ? 'opacity-75' : ''
                }`}
              >
                {photoPreview ? (
                  <>
                    <PresignableImage src={photoPreview} alt="Profile" className="h-full w-full object-cover" />
                    {uploadingPhoto && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                        <Loader2 className="mb-1 h-8 w-8 animate-spin text-white" />
                        <span className="text-xs text-white">{uploadProgress}%</span>
                      </div>
                    )}
                    {!uploadingPhoto && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                        <Camera className="h-8 w-8 text-white" />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center text-gray-400">
                    {uploadingPhoto ? (
                      <>
                        <Loader2 className="mb-1 h-10 w-10 animate-spin" />
                        <span className="text-xs text-gray-500">{uploadProgress}%</span>
                      </>
                    ) : (
                      <User className="h-16 w-16" strokeWidth={1.25} />
                    )}
                  </div>
                )}
                {!uploadingPhoto && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#FF8C42]">
                    <Camera className="h-4 w-4 text-white" />
                  </span>
                )}
              </div>
            </div>

            {profileForm}
          </div>
        )}
      </div>

      {editMode && (
        <div className="fixed bottom-0 left-0 right-0 z-20 mx-auto w-full max-w-customer border-t border-gray-200 bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="h-12 w-full rounded-xl bg-[#FF8C42] text-white hover:bg-[#FF7A2E] disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      )}
    </div>
  );
}
