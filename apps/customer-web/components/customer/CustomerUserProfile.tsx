'use client';

import { useState, useRef } from 'react';
import { Camera } from 'lucide-react';
import { apiClient, isUatMode } from '@/lib/api-client';

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  pincode: string;
  photo?: string;
}

interface CustomerUserProfileProps {
  phone: string;
  journeyStage?: string | null;
  onComplete: (profile: UserProfile) => void;
}

export function CustomerUserProfile({ phone, journeyStage, onComplete }: CustomerUserProfileProps) {
  const [profile, setProfile] = useState<UserProfile>({
    firstName: '',
    lastName: '',
    email: '',
    phone: phone || '',
    address: '',
    pincode: '',
    photo: ''
  });
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
        setProfile({ ...profile, photo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    
    // Validation
    if (!profile.firstName || !profile.lastName || !profile.email || !profile.phone || !profile.address || !profile.pincode) {
      setError('Please fill in all required fields');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(profile.email)) {
      setError('Please enter a valid email address');
      return;
    }

    // Pincode validation (6 digits for India)
    if (!/^\d{6}$/.test(profile.pincode)) {
      setError('Please enter a valid 6-digit pincode');
      return;
    }

    setLoading(true);
    try {
      // UAT Mode: Skip API call
      if (isUatMode()) {
        console.log('🔧 [UAT Mode] Profile saved locally:', profile);
        localStorage.setItem('customerProfile', JSON.stringify(profile));
        onComplete(profile);
        return;
      }

      // Save user profile to backend
      await apiClient.post('/customer/profile', {
        phone: phone,
        profile: profile,
        journeyType: journeyStage,
      });

      console.log('✅ User profile saved successfully');
      localStorage.setItem('customerProfile', JSON.stringify(profile));
      onComplete(profile);
    } catch (err: any) {
      console.error('Error saving user profile:', err);
      
      // UAT Fallback: If API fails in UAT mode, save locally
      if (isUatMode()) {
        console.log('🔧 [UAT Fallback] Saving profile locally');
        localStorage.setItem('customerProfile', JSON.stringify(profile));
        onComplete(profile);
        return;
      }
      
      setError(err.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col w-full max-w-[430px] mx-auto">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-32">
        {/* Logo */}
        <div className="flex justify-center pt-8 mb-6">
          <img src="/logo.png" alt="Warmpawz" className="w-16 h-16 object-contain" />
        </div>

        {/* Orange Circle Icon */}
        <div className="flex flex-col items-center mb-8 px-6">
          <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center mb-4 shadow-lg shadow-primary/30">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="18" r="8" fill="white"/>
              <path d="M10 38C10 30 16 24 24 24C32 24 38 30 38 38V42H10V38Z" fill="white"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 text-center">Create Your<br />Profile 👤</h1>
        </div>

        {/* Content */}
        <div className="px-6 mb-6">
          <p className="text-center text-gray-600 mb-6 text-sm">
            Let's set up your account 🌟<br />
            Almost there!
          </p>

          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <span className="text-red-500 text-xl">⚠️</span>
              <p className="text-red-600 text-sm flex-1">{error}</p>
            </div>
          )}

          {/* Photo Upload */}
          <div className="flex flex-col items-center mb-6">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-32 h-32 bg-orange-100 rounded-full overflow-hidden flex items-center justify-center cursor-pointer hover:bg-orange-200 transition-all border-4 border-white shadow-lg mb-3 relative group"
            >
              {photoPreview ? (
                <>
                  <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-8 h-8 text-white" />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center">
                  <Camera className="w-10 h-10 text-primary mb-2" />
                  <span className="text-xs text-primary">Add Photo</span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfile({ ...profile, firstName: e.target.value })}
                placeholder="John"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={profile.lastName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfile({ ...profile, lastName: e.target.value })}
                placeholder="Doe"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all"
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfile({ ...profile, email: e.target.value })}
              placeholder="john.doe@example.com"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* Phone (Pre-filled, Read-only) */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center border-2 border-gray-200 rounded-xl bg-gray-50">
              <span className="pl-4 pr-2 text-gray-600 font-medium">+91</span>
              <input
                type="tel"
                value={profile.phone}
                readOnly
                className="flex-1 px-2 py-3 bg-gray-50 rounded-r-xl cursor-not-allowed outline-none"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Phone number from your login
            </p>
          </div>

          {/* Address */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address <span className="text-red-500">*</span>
            </label>
            <textarea
              value={profile.address}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setProfile({ ...profile, address: e.target.value })}
              placeholder="House No, Street, Area"
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all resize-none"
            />
          </div>

          {/* Pincode */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pincode <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={profile.pincode}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setProfile({ ...profile, pincode: value });
              }}
              placeholder="400001"
              maxLength={6}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20 transition-all"
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
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 max-w-[430px] mx-auto w-full">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full h-14 bg-primary hover:bg-primary-dark text-white font-semibold rounded-2xl disabled:opacity-50 transition-all shadow-lg shadow-primary/30"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Creating Profile...
            </span>
          ) : (
            'Complete & Continue'
          )}
        </button>
      </div>
    </div>
  );
}

