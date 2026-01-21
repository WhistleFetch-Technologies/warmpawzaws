'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, Camera, Save, Building2, User, Mail, Phone, MapPin, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ProfessionalProfileManager } from '@/components/vendor/ProfessionalProfileManager';

interface VendorProfile {
  id: string;
  business_name: string;
  owner_name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  gst_number?: string;
  pan_number?: string;
  registration_number?: string;
  operating_hours?: string;
  description?: string;
  logo_url?: string;
  roleId?: string;
  role_id?: string;
  roleName?: string;
  role_name?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [profileType, setProfileType] = useState<'professional' | 'center' | null>(null);

  useEffect(() => {
    const storedVendorId = localStorage.getItem('vendorId');
    if (!storedVendorId) {
      router.push('/onboarding');
      return;
    }
    setVendorId(storedVendorId);
    loadProfile();
  }, [router]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) return;

      const response = await apiClient.get<{
        success?: boolean;
        vendor?: VendorProfile & {
          profileType?: 'professional' | 'center';
          vendorConfiguration?: 'solo' | 'business';
        };
        business_name?: string;
        profileType?: 'professional' | 'center';
        vendorConfiguration?: 'solo' | 'business';
      }>(`/vendor/${vendorId}/profile`);
      
      if (response.success && response.vendor) {
        setProfile(response.vendor);
        // ✅ NEW: Extract profileType from response
        const type = response.vendor.profileType || 
                     (response.vendor.vendorConfiguration === 'solo' ? 'professional' : 'center') ||
                     response.profileType ||
                     'center'; // Default to center for backward compatibility
        setProfileType(type);
      } else if (response.business_name) {
        // Fallback if response structure is different
        setProfile(response as VendorProfile);
        setProfileType(response.profileType || 
                      (response.vendorConfiguration === 'solo' ? 'professional' : 'center') ||
                      'center');
      }
    } catch (err: any) {
      console.error('Error loading profile:', err);
      toast.error(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof VendorProfile, value: string) => {
    if (!profile) return;
    setProfile({ ...profile, [field]: value });
    setHasChanges(true);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !vendorId) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('photo', file);

      const response = await apiClient.post<{ success?: boolean; photo_url?: string }>(
        `/vendor/${vendorId}/profile/photo`,
        formData
      );
      if (response.success && response.photo_url) {
        setProfile({ ...profile!, logo_url: response.photo_url });
        toast.success('Photo uploaded successfully');
      }
    } catch (err: any) {
      console.error('Error uploading photo:', err);
      toast.error(err.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!profile || !vendorId) return;
    setSaving(true);
    try {
      const response = await apiClient.put<{ success?: boolean; error?: string }>(
        `/vendor/${vendorId}/profile`,
        profile
      ) as { success?: boolean; error?: string };
      if (response?.success) {
        toast.success('Profile updated successfully');
        setHasChanges(false);
        loadProfile(); // Reload to get updated status
      } else {
        toast.error(response?.error || 'Failed to update profile');
      }
    } catch (err: any) {
      console.error('Error saving profile:', err);
      toast.error(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Failed to load profile</p>
          <Button onClick={loadProfile}>Retry</Button>
        </div>
      </div>
    );
  }

  // ✅ NEW: Route to Professional Profile for solo vendors
  if (profileType === 'professional') {
    // Get vendorData from localStorage to include roleId for specializations
    const vendorData = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('vendorData') || '{}') : {};
    const enrichedProfile = {
      ...profile,
      roleId: profile?.roleId || profile?.role_id || vendorData?.roleId || vendorData?.role_id,
      roleName: profile?.roleName || profile?.role_name || vendorData?.roleName || vendorData?.role_name,
    };
    return <ProfessionalProfileManager vendorId={vendorId!} profile={enrichedProfile} onBack={() => router.back()} />;
  }

  // ✅ Default: Center Profile (existing implementation)
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-orange-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-800">Profile</h1>
              <p className="text-sm text-gray-500 mt-1">Manage your business profile</p>
            </div>
            {hasChanges && (
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Profile Photo */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <Label className="text-lg font-semibold mb-4 block">Profile Photo</Label>
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="w-32 h-32 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center overflow-hidden">
                {profile.logo_url ? (
                  <img src={profile.logo_url} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-16 h-16 text-orange-400" />
                )}
              </div>
              <label
                htmlFor="photo-upload"
                className="absolute bottom-0 right-0 bg-orange-500 text-white p-2 rounded-full cursor-pointer hover:bg-orange-600 transition"
              >
                <Camera className="w-4 h-4" />
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600">
                Upload your business logo or profile photo. Recommended size: 512x512px
              </p>
              {uploading && <p className="text-sm text-orange-600 mt-2">Uploading...</p>}
            </div>
          </div>
        </div>

        {/* Business Information */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <Building2 className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-semibold">Business Information</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="business_name">Business Name *</Label>
              <Input
                id="business_name"
                value={profile.business_name}
                onChange={(e) => handleInputChange('business_name', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="owner_name">Owner Name *</Label>
              <Input
                id="owner_name"
                value={profile.owner_name}
                onChange={(e) => handleInputChange('owner_name', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="gst_number">GST Number</Label>
              <Input
                id="gst_number"
                value={profile.gst_number || ''}
                onChange={(e) => handleInputChange('gst_number', e.target.value)}
                className="mt-1"
                placeholder="Enter GST number"
              />
            </div>
            <div>
              <Label htmlFor="pan_number">PAN Number</Label>
              <Input
                id="pan_number"
                value={profile.pan_number || ''}
                onChange={(e) => handleInputChange('pan_number', e.target.value)}
                className="mt-1"
                placeholder="Enter PAN number"
              />
            </div>
            <div>
              <Label htmlFor="registration_number">Registration Number</Label>
              <Input
                id="registration_number"
                value={profile.registration_number || ''}
                onChange={(e) => handleInputChange('registration_number', e.target.value)}
                className="mt-1"
                placeholder="Enter registration number"
              />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <Phone className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-semibold">Contact Information</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={profile.phone}
                disabled
                className="mt-1 bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">Phone number cannot be changed</p>
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* Address Information */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <MapPin className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-semibold">Address Information</h2>
          </div>
          <div className="space-y-6">
            <div>
              <Label htmlFor="address">Address *</Label>
              <Textarea
                id="address"
                value={profile.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={profile.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="state">State *</Label>
                <Input
                  id="state"
                  value={profile.state}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="pincode">Pincode *</Label>
                <Input
                  id="pincode"
                  value={profile.pincode}
                  onChange={(e) => handleInputChange('pincode', e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <FileText className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-semibold">Additional Information</h2>
          </div>
          <div className="space-y-6">
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={profile.description || ''}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="mt-1"
                rows={4}
                placeholder="Describe your business, services, and what makes you unique..."
              />
            </div>
            <div>
              <Label htmlFor="operating_hours">Operating Hours</Label>
              <Input
                id="operating_hours"
                value={profile.operating_hours || ''}
                onChange={(e) => handleInputChange('operating_hours', e.target.value)}
                className="mt-1"
                placeholder="e.g., Mon-Sat: 9 AM - 6 PM"
              />
            </div>
          </div>
        </div>

        {/* Save Button (if changes) */}
        {hasChanges && (
          <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-orange-200 p-4 rounded-t-2xl">
            <div className="max-w-4xl mx-auto flex justify-end gap-4">
              <Button
                variant="outline"
                onClick={() => {
                  loadProfile();
                  setHasChanges(false);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
