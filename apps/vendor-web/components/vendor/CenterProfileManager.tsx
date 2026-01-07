'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Clock, Building2, MapPin, Image as ImageIcon, Calendar, Sparkles, Check } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface CenterProfileManagerProps {
  vendorId: string;
  vendorData: any;
  onBack: () => void;
}

interface CenterProfile {
  centerName: string;
  description: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  operatingHours: {
    [key: string]: {
      isOpen: boolean;
      open: string;
      close: string;
    };
  };
  amenities: string[];
  customAmenities: string[];
  specializations: string[];
  photos: string[];
  emergencyServices: {
    ambulance: boolean;
    ambulanceAvailable247: boolean;
    consultationAvailable247: boolean;
    diagnosticsAvailable247: boolean;
  };
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function CenterProfileManager({ vendorId, vendorData, onBack }: CenterProfileManagerProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'timing' | 'amenities' | 'specialization'>('basic');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<CenterProfile>({
    centerName: vendorData?.businessName || '',
    description: '',
    address: vendorData?.address || '',
    city: vendorData?.city || '',
    state: vendorData?.state || '',
    pincode: vendorData?.pincode || '',
    operatingHours: DAYS.reduce((acc, day) => ({
      ...acc,
      [day]: { isOpen: true, open: '09:00', close: '18:00' }
    }), {}),
    amenities: [],
    customAmenities: [],
    specializations: [],
    photos: [],
    emergencyServices: {
      ambulance: false,
      ambulanceAvailable247: false,
      consultationAvailable247: false,
      diagnosticsAvailable247: false
    }
  });

  useEffect(() => {
    loadCenterProfile();
  }, [vendorId]);

  const loadCenterProfile = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/center-profile`);
      if (response.success && response.profile) {
        setProfile(response.profile);
      }
    } catch (error) {
      console.error('Error loading center profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiClient.put(`/vendor/${vendorId}/center-profile`, profile);
      alert('✅ Center profile saved successfully!');
    } catch (error: any) {
      alert(error.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      <div className="bg-white border-b sticky top-0 z-10 p-4">
        <div className="flex items-center gap-0 mb-4">
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="font-semibold text-gray-900">Center Profile</h1>
        </div>
        <div className="flex gap-0">
          {(['basic', 'timing', 'amenities', 'specialization'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-0 py-0 rounded-lg text-sm font-medium ${
                activeTab === tab
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {activeTab === 'basic' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">Center Name</label>
              <input
                type="text"
                value={profile.centerName}
                onChange={(e) => setProfile(prev => ({ ...prev, centerName: e.target.value }))}
                className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">Description</label>
              <textarea
                value={profile.description}
                onChange={(e) => setProfile(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
                className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">City</label>
                <input
                  type="text"
                  value={profile.city}
                  onChange={(e) => setProfile(prev => ({ ...prev, city: e.target.value }))}
                  className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">State</label>
                <input
                  type="text"
                  value={profile.state}
                  onChange={(e) => setProfile(prev => ({ ...prev, state: e.target.value }))}
                  className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timing' && (
          <div className="space-y-3">
            {DAYS.map((day, index) => (
              <div key={day} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-0">
                  <span className="font-medium">{DAY_LABELS[index]}</span>
                  <label className="flex items-center gap-0">
                    <input
                      type="checkbox"
                      checked={profile.operatingHours[day]?.isOpen || false}
                      onChange={(e) => setProfile(prev => ({
                        ...prev,
                        operatingHours: {
                          ...prev.operatingHours,
                          [day]: { ...prev.operatingHours[day], isOpen: e.target.checked }
                        }
                      }))}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Open</span>
                  </label>
                </div>
                {profile.operatingHours[day]?.isOpen && (
                  <div className="grid grid-cols-2 gap-0">
                    <div>
                      <label className="block text-xs text-gray-600 mb-0">Open</label>
                      <input
                        type="time"
                        value={profile.operatingHours[day]?.open || '09:00'}
                        onChange={(e) => setProfile(prev => ({
                          ...prev,
                          operatingHours: {
                            ...prev.operatingHours,
                            [day]: { ...prev.operatingHours[day], open: e.target.value }
                          }
                        }))}
                        className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-0">Close</label>
                      <input
                        type="time"
                        value={profile.operatingHours[day]?.close || '18:00'}
                        onChange={(e) => setProfile(prev => ({
                          ...prev,
                          operatingHours: {
                            ...prev.operatingHours,
                            [day]: { ...prev.operatingHours[day], close: e.target.value }
                          }
                        }))}
                        className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'amenities' && (
          <div className="space-y-3">
            {['WiFi', 'Parking', 'AC', 'Wheelchair Access', 'Pet Play Area'].map(amenity => (
              <button
                key={amenity}
                onClick={() => setProfile(prev => ({
                  ...prev,
                  amenities: prev.amenities.includes(amenity)
                    ? prev.amenities.filter(a => a !== amenity)
                    : [...prev.amenities, amenity]
                }))}
                className={`w-full px-4 py-0 rounded-lg border-2 text-left transition-colors ${
                  profile.amenities.includes(amenity)
                    ? 'border-[#FF8C42] bg-orange-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{amenity}</span>
                  {profile.amenities.includes(amenity) && (
                    <Check className="w-5 h-5 text-[#FF8C42]" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full px-4 py-0 bg-[#FF8C42] text-white rounded-lg font-medium disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}

