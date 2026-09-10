'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Camera } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { COUNTRY_CODES } from '@/components/ui/CountryCodeSelector';
import { getResolvedCustomerId, persistCustomerDatabaseId } from '@/lib/customer-id-storage';

interface UserProfile {
  firstName: string;
  lastName: string;
  phone: string;
  photo?: string;
}

interface CustomerUserProfileProps {
  session: any;
  journeyStage?: string;
  onComplete: (profile: UserProfile) => void;
  onBack?: () => void;
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim().replace(/\s+/g, ' ');
  const space = trimmed.indexOf(' ');
  if (space === -1) {
    return { firstName: trimmed, lastName: '' };
  }
  return {
    firstName: trimmed.slice(0, space),
    lastName: trimmed.slice(space + 1),
  };
}

export function CustomerUserProfile({ session, journeyStage, onComplete, onBack }: CustomerUserProfileProps) {
  const [fullName, setFullName] = useState('');
  const [photo, setPhoto] = useState('');
  const [savedCountryCode, setSavedCountryCode] = useState('+91');
  const [photoPreview, setPhotoPreview] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const latestPhotoRef = useRef(photo);
  latestPhotoRef.current = photo;

  const phone = session.phone || '';

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

  const countryInfo = COUNTRY_CODES.find((c) => c.code === savedCountryCode) || COUNTRY_CODES[0];

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

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
          setPhoto(keyOrUrl);
          setPhotoPreview(previewUrl || '');
        } else {
          alert(result.error || 'Failed to upload photo. Please try again.');
          setPhotoPreview(latestPhotoRef.current || '');
        }
      } catch (error: any) {
        console.error('Error uploading photo to S3:', error);
        alert(error.message || 'Failed to upload photo. Please try again.');
        setPhotoPreview(latestPhotoRef.current || '');
      } finally {
        setUploadingPhoto(false);
        setUploadProgress(0);
      }
    }
  };

  const handleSubmit = async () => {
    const { firstName, lastName } = splitFullName(fullName);

    if (!firstName || !phone) {
      alert('Please enter your name');
      return;
    }

    setLoading(true);
    try {
      const profileBody: UserProfile = {
        firstName,
        lastName,
        phone,
        ...(photo ? { photo } : {}),
      };

      await apiClient.post('/customer/profile', {
        phone: session.phone,
        profile: profileBody,
        journeyType: journeyStage,
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
          }
        } catch {
          /* best effort */
        }
      }

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

      <div className="flex-1 overflow-y-auto pb-32">
        <div className="flex justify-center pt-4 mb-8">
          <img src={'/logo.webp'} alt="Warmpawz" className="w-16 h-16 object-contain" />
        </div>

        <div className="px-6 mb-6">
          <p className="text-center text-gray-700 mb-6 text-sm">
            Let's set up your account 🌟<br />
            Almost there!
          </p>

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

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              autoComplete="name"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none"
            />
          </div>

          <div className="mb-6">
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
                value={phone}
                readOnly
                className="flex-1 px-4 py-3 bg-gray-50 cursor-not-allowed outline-none"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Phone number from your login</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <p className="text-xs text-blue-900 text-center">
              🔒 Your information is secure and will be used<br />
              for service delivery and communication only.
            </p>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 max-w-customer mx-auto w-full">
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full h-12 bg-[#FF8C42] hover:bg-[#FF7A2E] rounded-xl text-white disabled:opacity-50"
        >
          {loading ? 'Creating Profile...' : 'Complete & Continue'}
        </Button>

        <div className="flex justify-center mt-4">
          <div className="w-32 h-1 bg-black rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
