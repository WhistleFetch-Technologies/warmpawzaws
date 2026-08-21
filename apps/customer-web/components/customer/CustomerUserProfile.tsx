'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Camera } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { EnhancedAddressAutocomplete, AddressComponents } from '@/components/shared/EnhancedAddressAutocomplete';
import { UseCurrentLocationButton } from '@/components/shared/UseCurrentLocationButton';
import type { AddressFromGeolocationResult } from '@/lib/address-from-geolocation';
import { COUNTRY_CODES } from '@/components/ui/CountryCodeSelector';
import { validateEmail } from '@/lib/validation';
import { getResolvedCustomerId, persistCustomerDatabaseId } from '@/lib/customer-id-storage';
import { toast } from 'sonner';
import { isLoyaltyUiVisibleForAccount } from '@/lib/app-review-demo-account';

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  pincode: string;
  city: string;
  state: string;
  houseNo: string;
  floor: string;
  photo?: string;
  latitude?: number | null;
  longitude?: number | null;
  coordinates?: { lat: number; lng: number };
}

interface CustomerUserProfileProps {
  session: any;
  journeyStage?: string;
  onComplete: (profile: UserProfile) => void;
  onBack?: () => void;
}

export function CustomerUserProfile({ session, journeyStage, onComplete, onBack }: CustomerUserProfileProps) {
  const [profile, setProfile] = useState<UserProfile>({
    firstName: '',
    lastName: '',
    email: '',
    phone: session.phone || '',
    address: '',
    pincode: '',
    city: '',
    state: '',
    houseNo: '',
    floor: '',
    photo: ''
  });
  
  // Get saved country code for display
  const [savedCountryCode, setSavedCountryCode] = useState('+91');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const code = localStorage.getItem('customerCountryCode') || '+91';
      setSavedCountryCode(code);
    }
  }, []);

  // Ensure customerPhone is in localStorage for API client UAT token (profile POST needs it)
  useEffect(() => {
    if (typeof window !== 'undefined' && session?.phone && !localStorage.getItem('customerPhone')) {
      localStorage.setItem('customerPhone', session.phone.replace(/\D/g, '').slice(-10));
    }
  }, [session?.phone]);
  
  // Get country flag for display
  const countryInfo = COUNTRY_CODES.find(c => c.code === savedCountryCode) || COUNTRY_CODES[0];
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [referralExpanded, setReferralExpanded] = useState(false);
  const [referralLinked, setReferralLinked] = useState(false);
  const [referralApplying, setReferralApplying] = useState(false);
  const [linkedReferralCode, setLinkedReferralCode] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const houseNoInputRef = useRef<HTMLInputElement>(null);
  const latestProfileRef = useRef(profile);
  latestProfileRef.current = profile;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }
      
      // Show preview immediately
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      // Upload to S3 with progress tracking
      setUploadingPhoto(true);
      setUploadProgress(0);
      try {
        const { uploadCustomerPhotoWithProgress } = await import('@/lib/photo-upload-enhanced');
        const result = await uploadCustomerPhotoWithProgress(file, session.phone, {
          onProgress: (progress) => {
            setUploadProgress(progress);
          },
          verifyUpload: true,
          maxRetries: 3,
        });
        
        if (result.success && (result.imageKey || result.publicUrl)) {
          const keyOrUrl = result.imageKey || result.fileName || result.publicUrl;
          const previewUrl = result.url || result.publicUrl || keyOrUrl;
          setProfile((prev) => ({ ...prev, photo: keyOrUrl }));
          setPhotoPreview(previewUrl || '');
          console.log('✅ Customer photo uploaded:', keyOrUrl);
        } else {
          alert(result.error || 'Failed to upload photo. Please try again.');
          setPhotoPreview(latestProfileRef.current.photo || '');
        }
      } catch (error: any) {
        console.error('Error uploading photo to S3:', error);
        alert(error.message || 'Failed to upload photo. Please try again.');
        setPhotoPreview(latestProfileRef.current.photo || '');
      } finally {
        setUploadingPhoto(false);
        setUploadProgress(0);
      }
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pending = localStorage.getItem('pendingReferralCode')?.trim().toUpperCase();
    if (pending) {
      setReferralCode(pending);
      setReferralExpanded(true);
    }
  }, []);

  useEffect(() => {
    const customerId = getResolvedCustomerId();
    if (!customerId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<{
          hasReferral?: boolean;
          referralCode?: string;
        }>(`/referrals/referee-status?customerId=${encodeURIComponent(customerId)}`);
        if (cancelled) return;
        if (res.hasReferral) {
          setReferralLinked(true);
          if (res.referralCode) setLinkedReferralCode(res.referralCode);
        }
      } catch {
        /* ignore — new users may not have id yet */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGeolocationSuccess = useCallback((result: AddressFromGeolocationResult) => {
    setProfile((prev) => ({
      ...prev,
      address: result.addressLine1 ?? prev.address,
      city: result.city ?? prev.city,
      state: result.state ?? prev.state,
      pincode: result.pincode ?? prev.pincode,
      latitude: result.latitude,
      longitude: result.longitude,
      coordinates: result.coordinates,
    }));
  }, []);

  const applyReferralCode = async (customerId: string) => {
    const trimmed = referralCode.trim().toUpperCase();
    if (!trimmed || referralLinked) return;
    setReferralApplying(true);
    try {
      await apiClient.post('/referrals/apply', {
        customerId,
        referralCode: trimmed,
        phone: session.phone,
      });
      setReferralLinked(true);
      setLinkedReferralCode(trimmed);
      localStorage.removeItem('pendingReferralCode');
      toast.success('Referral linked — you will earn points after your first booking');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not apply referral code';
      toast.error(msg);
    } finally {
      setReferralApplying(false);
    }
  };

  const handleSubmit = async () => {
    const houseFromDom = houseNoInputRef.current?.value?.trim() ?? '';
    const houseFromState = String((profile as UserProfile & { house_no?: string }).houseNo ?? '').trim();
    const houseFromSnake = String((profile as UserProfile & { house_no?: string }).house_no ?? '').trim();
    const effectiveHouseNo = houseFromDom || houseFromState || houseFromSnake;

    // Required: first name, last name, phone (from login), address, city, state, pincode
    if (
      !profile.firstName.trim() ||
      !profile.lastName.trim() ||
      !profile.phone ||
      !profile.address.trim() ||
      !profile.pincode ||
      !profile.city.trim() ||
      !profile.state.trim()
    ) {
      alert('Please fill in First Name, Last Name, Address, City, State, and Pincode');
      return;
    }

    if (profile.email.trim() && !validateEmail(profile.email)) {
      alert('Please enter a valid email address');
      return;
    }

    // Pincode validation (6 digits for India)
    if (!/^\d{6}$/.test(profile.pincode)) {
      alert('Please enter a valid 6-digit pincode');
      return;
    }

    setLoading(true);
    try {
      const trimmedHouse = effectiveHouseNo;
      const profileBody: UserProfile = {
        ...profile,
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        email: profile.email.trim(),
        address: profile.address.trim(),
        houseNo: trimmedHouse,
        floor: profile.floor.trim(),
        pincode: profile.pincode.trim(),
        city: profile.city.trim(),
        state: profile.state.trim(),
        ...(profile.latitude != null &&
          profile.longitude != null &&
          Number.isFinite(profile.latitude) &&
          Number.isFinite(profile.longitude) && {
            latitude: profile.latitude,
            longitude: profile.longitude,
            coordinates: { lat: profile.latitude, lng: profile.longitude },
          }),
      };
      delete (profileBody as UserProfile & { house_no?: string }).house_no;
      // Save user profile to backend - AWS Serverless compatible
      await apiClient.post('/customer/profile', {
        phone: session.phone,
        profile: profileBody,
        journeyType: journeyStage, // Save journey type
      });

      let customerId = getResolvedCustomerId();
      if (!customerId) {
        try {
          const unified = await apiClient.get<{ profile?: Record<string, unknown>; customer?: { id?: string } }>(
            `/customer/profile/unified/${encodeURIComponent(session.phone)}`
          );
          const id =
            unified?.customer?.id ||
            (unified?.profile?.id as string | undefined) ||
            (unified?.profile?.customer_id as string | undefined);
          if (id) {
            persistCustomerDatabaseId(id);
            customerId = id;
          }
        } catch {
          /* best effort */
        }
      }

      if (customerId && referralCode.trim() && !referralLinked) {
        await applyReferralCode(customerId);
      }

      console.log('User profile saved successfully');
      setProfile(profileBody);
      onComplete(profileBody);
    } catch (error) {
      console.error('Error saving user profile:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col w-full max-w-customer mx-auto">
      {/* Top Bar with Back Button */}
      <div className="cw-header-safe-top cw-header-safe-x flex min-h-[56px] items-center gap-3 py-2 pb-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex min-h-[44px] items-center gap-1 rounded-full bg-gray-100 px-3 py-2 text-gray-600 transition-colors touch-manipulation hover:bg-gray-200 hover:text-gray-900 active:bg-gray-200"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-32">
        {/* Logo */}
        <div className="flex justify-center pt-4 mb-8">
          <img src={'/logo.webp'} alt="Warmpawz" className="w-16 h-16 object-contain" />
        </div>

        {/* Content */}
        <div className="px-6 mb-6">
          <p className="text-center text-gray-700 mb-6 text-sm">
            Let's set up your account 🌟<br />
            Almost there!
          </p>

          {/* Photo Upload */}
          <div className="flex flex-col items-center mb-6">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-32 h-32 bg-orange-100 rounded-full overflow-hidden flex items-center justify-center cursor-pointer hover:bg-orange-200 transition-all border-4 border-white shadow-lg mb-3 relative group"
            >
              {photoPreview && !uploadingPhoto ? (
                <>
                  <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-8 h-8 text-white" />
                  </div>
                </>
              ) : uploadingPhoto ? (
                <div className="flex flex-col items-center justify-center h-full bg-black bg-opacity-50">
                  <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mb-2" />
                  <span className="text-white text-xs">{uploadProgress}%</span>
                  <div className="mt-2 w-20 bg-gray-300 rounded-full h-1">
                    <div
                      className="bg-white h-1 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Camera className="w-10 h-10 text-[#FF8C42] mb-2" />
                  <span className="text-xs text-[#FF8C42]">Add Photo</span>
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
            <p className="text-xs text-gray-500 text-center">
              Click to upload your profile photo<br />
              (Optional)
            </p>
          </div>

          {/* First Name and Last Name */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={profile.firstName}
                onChange={(e) => setProfile((prev) => ({ ...prev, firstName: e.target.value }))}
                placeholder="John"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={profile.lastName}
                onChange={(e) => setProfile((prev) => ({ ...prev, lastName: e.target.value }))}
                placeholder="Doe"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
              />
            </div>
          </div>

          {/* Email */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={profile.email}
              onChange={(e) => setProfile((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="john.doe@example.com"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
            />
          </div>

          {/* Phone (Pre-filled, Read-only) */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <div className="flex items-stretch border-2 border-gray-200 bg-gray-50 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-3 bg-gray-100 border-r border-gray-200">
                <span className="text-lg">{countryInfo.flag}</span>
                <span className="text-gray-600 font-medium text-sm">{savedCountryCode}</span>
              </div>
              <input
                type="tel"
                value={profile.phone}
                readOnly
                className="flex-1 px-4 py-3 bg-gray-50 cursor-not-allowed outline-none"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Phone number from your login
            </p>
          </div>

          {/* Address with Google Maps Autocomplete */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address <span className="text-red-500">*</span>
            </label>
            <UseCurrentLocationButton
              className="mb-3"
              onSuccess={handleGeolocationSuccess}
            />
            <EnhancedAddressAutocomplete
              value={profile.address}
              onChange={(address: string, components?: AddressComponents) => {
                setProfile(prev => {
                  const updated = { ...prev, address };
                  // Auto-populate fields from Google Maps results
                  if (components?.pincode) {
                    updated.pincode = components.pincode;
                  }
                  if (components?.city) {
                    updated.city = components.city;
                  }
                  if (components?.state) {
                    updated.state = components.state;
                  }
                  if (components?.coordinates) {
                    updated.latitude = components.coordinates.lat;
                    updated.longitude = components.coordinates.lng;
                  }
                  return updated;
                });
              }}
              placeholder="Search address, landmark, city..."
              className="w-full"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Use current location or type to search for your address, landmark or area
            </p>
          </div>

          {/* House No / Flat No */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              House No / Flat No
            </label>
            <input
              ref={houseNoInputRef}
              type="text"
              name="customerHouseFlatNo"
              value={profile.houseNo}
              onChange={(e) => setProfile((prev) => ({ ...prev, houseNo: e.target.value }))}
              autoComplete="off"
              data-lpignore="true"
              placeholder="e.g., A-101, Flat 12B"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
            />
          </div>

          {/* Floor (Optional) */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Floor
            </label>
            <input
              type="text"
              value={profile.floor}
              onChange={(e) => setProfile((prev) => ({ ...prev, floor: e.target.value }))}
              placeholder="e.g., 1st Floor"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
            />
          </div>

          {/* City and State */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={profile.city}
                onChange={(e) => setProfile((prev) => ({ ...prev, city: e.target.value }))}
                placeholder="Mumbai"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                State <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={profile.state}
                onChange={(e) => setProfile((prev) => ({ ...prev, state: e.target.value }))}
                placeholder="Maharashtra"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
              />
            </div>
          </div>

          {/* Pincode */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pincode <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={profile.pincode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setProfile((prev) => ({ ...prev, pincode: value }));
              }}
              placeholder="400001"
              maxLength={6}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
            />
          </div>

          {/* Referral code (optional) */}
          {isLoyaltyUiVisibleForAccount(profile.phone) ? (
          <div className="mb-6">
            {referralLinked ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-sm font-medium text-green-800">Referral applied</p>
                <p className="text-xs text-green-700 mt-1">
                  Code {linkedReferralCode || referralCode} — earn points after your first booking.
                </p>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setReferralExpanded((v) => !v)}
                  className="text-sm text-[#FF8C42] font-medium mb-2"
                >
                  {referralExpanded ? 'Hide referral code' : 'Have a referral code?'}
                </button>
                {referralExpanded && (
                  <div className="flex w-full min-w-0 gap-2">
                    <input
                      type="text"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      placeholder="Enter referral code"
                      className="min-w-0 flex-1 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none uppercase"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!referralCode.trim() || referralApplying}
                      onClick={async () => {
                        const customerId = getResolvedCustomerId();
                        if (customerId) {
                          await applyReferralCode(customerId);
                        } else {
                          toast.info('Save your profile first, or we will apply the code when you continue.');
                        }
                      }}
                      className="shrink-0"
                    >
                      {referralApplying ? 'Applying…' : 'Apply'}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
          ) : null}

          {/* Info Card */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <p className="text-xs text-blue-900 text-center">
              🔒 Your information is secure and will be used<br />
              for service delivery and communication only.
            </p>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 max-w-customer mx-auto w-full">
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full h-12 bg-[#FF8C42] hover:bg-[#FF7A2E] rounded-xl text-white disabled:opacity-50"
        >
          {loading ? 'Creating Profile...' : 'Complete & Continue'}
        </Button>

        {/* Home Indicator */}
        <div className="flex justify-center mt-4">
          <div className="w-32 h-1 bg-black rounded-full"></div>
        </div>
      </div>
    </div>
  );
}