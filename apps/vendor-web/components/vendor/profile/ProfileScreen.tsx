'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface ProfileScreenProps {
  vendorId: string;
  onBack?: () => void;
}

interface ProfileForm {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  description: string;
}

/**
 * Simplified vendor profile screen for web
 * Fetches and saves profile via API Gateway (Lambda + RDS)
 */
export function ProfileScreen({ vendorId, onBack }: ProfileScreenProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<ProfileForm>({
    businessName: '',
    ownerName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    description: '',
  });

  useEffect(() => {
    loadProfile();
  }, [vendorId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{
        success?: boolean;
        profile?: Partial<ProfileForm>;
      }>(`/vendor/profile/${vendorId}`);

      if (response && (response as any).profile) {
        setFormData((prev) => ({ ...prev, ...(response as any).profile }));
      }
    } catch (error) {
      console.error('[ProfileScreen] Failed to load profile', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof ProfileForm, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiClient.post('/vendor/profile/save', {
        id: vendorId,
        ...formData,
      });
      toast.success('Profile saved');
    } catch (error: any) {
      console.error('[ProfileScreen] Failed to save profile', error);
      toast.error(error?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          {onBack && (
            <button
              onClick={onBack}
              className="text-orange-500 text-sm font-medium mb-2"
            >
              ← Back
            </button>
          )}
          <h1 className="text-xl font-bold text-gray-900">Vendor Profile</h1>
        </div>

        <div className="px-4 py-6 space-y-4">
          {(
            [
              ['businessName', 'Business Name'],
              ['ownerName', 'Owner Name'],
              ['email', 'Email'],
              ['phone', 'Phone'],
              ['address', 'Address'],
              ['city', 'City'],
              ['state', 'State'],
              ['pincode', 'Pincode'],
              ['description', 'Description'],
            ] as Array<[keyof ProfileForm, string]>
          ).map(([field, label]) => (
            <div key={field} className="space-y-1">
              <label className="text-sm text-gray-700">{label}</label>
              <input
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                value={formData[field] || ''}
                onChange={(e) => handleChange(field, e.target.value)}
                placeholder={label}
              />
            </div>
          ))}

          <button
            className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
