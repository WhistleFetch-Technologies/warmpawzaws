'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Camera } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { EnhancedAddressAutocomplete, AddressComponents } from '@/components/shared/EnhancedAddressAutocomplete';
import { COUNTRY_CODES } from '@/components/ui/CountryCodeSelector';
import { validateEmail } from '@/lib/validation';

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
        
        if (result.success && result.publicUrl) {
          // Functional update so a slow upload cannot overwrite fields typed after pick (e.g. houseNo).
          setProfile((prev) => ({ ...prev, photo: result.publicUrl }));
          console.log('✅ Customer photo uploaded to S3:', result.publicUrl);
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

  const handleSubmit = async () => {
    const houseFromDom = houseNoInputRef.current?.value?.trim() ?? '';
    const houseFromState = String((profile as UserProfile & { house_no?: string }).houseNo ?? '').trim();
    const houseFromSnake = String((profile as UserProfile & { house_no?: string }).house_no ?? '').trim();
    const effectiveHouseNo = houseFromDom || houseFromState || houseFromSnake;

    // Validation
    if (
      !profile.firstName ||
      !profile.lastName ||
      !profile.email ||
      !profile.phone ||
      !profile.address ||
      !profile.pincode ||
      !profile.city ||
      !effectiveHouseNo
    ) {
      alert('Please fill in all required fields (including house / flat number)');
      return;
    }

    // Email validation
    if (!validateEmail(profile.email)) {
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
      };
      delete (profileBody as UserProfile & { house_no?: string }).house_no;
      // Save user profile to backend - AWS Serverless compatible
      await apiClient.post('/customer/profile', {
        phone: session.phone,
        profile: profileBody,
        journeyType: journeyStage, // Save journey type
      });

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
      <div className="px-4 pt-4 pb-2 flex items-center">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors bg-gray-100 hover:bg-gray-200 rounded-full px-3 py-2"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-32">
        {/* Logo */}
        <div className="flex justify-center pt-4 mb-6">
          <img src={'/logo.png'} alt="Warmpawz" className="w-16 h-16 object-contain" />
        </div>

        {/* Orange Circle Icon */}
        <div className="flex flex-col items-center mb-8 px-6">
          <div className="w-24 h-24 bg-[#FF8C42] rounded-full flex items-center justify-center mb-4">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="18" r="8" fill="white"/>
              <path d="M10 38C10 30 16 24 24 24C32 24 38 30 38 38V42H10V38Z" fill="white"/>
            </svg>
          </div>
          <h1 className="text-black text-center">Create Your<br />Profile 👤</h1>
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
              Email Address <span className="text-red-500">*</span>
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
                  return updated;
                });
              }}
              placeholder="Search address, landmark, city..."
              className="w-full"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Type to search for your address, landmark or area
            </p>
          </div>

          {/* House No / Flat No */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              House No / Flat No <span className="text-red-500">*</span>
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
                State
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