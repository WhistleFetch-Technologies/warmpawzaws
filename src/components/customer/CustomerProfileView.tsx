import { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { ChevronLeft, Camera, Edit2, Save, X } from 'lucide-react';
// Logo placeholder - using base64 encoded SVG (Warmpawz logo)
const logoImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHJ4PSI4IiBmaWxsPSIjRkY4QzQyIi8+CiAgPHBhdGggZD0iTTIwIDEyQzE2LjY4NjMgMTIgMTQgMTQuNjg2MyAxNCAxOEMxNCAxOS41OTEzIDE0LjYzMjEgMjEuMDI2MSAxNS42NTY5IDIyLjA1MTRDMTY4MjE3IDIzLjA3NjcgMTguMTE2NSAyMy43MDg4IDE5LjcwNzcgMjMuNzA4OEMyMS4yOTg5IDIzLjcwODggMjIuNzMzNyAyMy4wNzY3IDIzLjc1ODUgMjIuMDUxNEMyNC43ODMzIDIxLjAyNjEgMjUuNDE1NCAxOS41OTEzIDI1LjQxNTQgMThDMjUuNDE1NCAxNC42ODYzIDIyLjcyOTEgMTIgMTkuNDE1NCAxMkgyMFpNMjAgMTRDMjEuNjU2OSAxNCAyMyAxNS4zNDMxIDIzIDE3QzIzIDE4LjY1NjkgMjEuNjU2OSAyMCAyMCAyMEMxOC4zNDMxIDIwIDE3IDE4LjY1NjkgMTcgMTdDMTcgMTUuMzQzMSAxOC4zNDMxIDE0IDIwIDE0WiIgZmlsbD0id2hpdGUiLz4KICA8cGF0aCBkPSJNMTIgMjRDMTIgMjQuNTUyMyAxMi40NDc3IDI1IDEzIDI1SDI3QzI3LjU1MjMgMjUgMjggMjQuNTUyMyAyOCAyNEMyOCAyMi4zNDMxIDI2LjY1NjkgMjEgMjUgMjFIMTVDMTMuMzQzMSAyMSAxMiAyMi4zNDMxIDEyIDI0WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

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
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/profile/${phone}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const result = await response.json();
        setProfile(result.profile);
        setPhotoPreview(result.profile.photo || '');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
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
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/profile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            phone: phone,
            profile: profile,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      setEditMode(false);
      alert('Profile updated successfully! 🎉');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Error saving profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center w-full max-w-[430px] mx-auto">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
          <Button onClick={onBack} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
            Go Back
          </Button>
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
      <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200">
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
              onClick={() => editMode && fileInputRef.current?.click()}
              className={`w-32 h-32 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full overflow-hidden flex items-center justify-center border-4 border-white shadow-lg mb-3 relative group ${editMode ? 'cursor-pointer' : ''}`}
            >
              {photoPreview ? (
                <>
                  <img src={photoPreview} alt="Profile" className="w-full h-full object-cover" />
                  {editMode && (
                    <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="w-8 h-8 text-white" />
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center text-white">
                  <span className="text-4xl font-bold">
                    {profile.firstName?.charAt(0)}{profile.lastName?.charAt(0)}
                  </span>
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
            {editMode && (
              <p className="text-xs text-gray-500 text-center">
                Click photo to change
              </p>
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

            {/* Address */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">
                Address
              </label>
              {editMode ? (
                <textarea
                  value={profile.address}
                  onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#FF8C42] focus:outline-none resize-none"
                />
              ) : (
                <p className="text-black font-medium px-4 py-3 bg-gray-50 rounded-xl">
                  {profile.address}
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
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 max-w-[430px] mx-auto w-full">
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
        <div className="fixed bottom-0 left-0 right-0 bg-white px-6 py-4 max-w-[430px] mx-auto w-full">
          <div className="flex justify-center">
            <div className="w-32 h-1 bg-black rounded-full"></div>
          </div>
        </div>
      )}
    </div>
  );
}
