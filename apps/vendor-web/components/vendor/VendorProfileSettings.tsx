'use client';

import { useState, useEffect } from 'react';
import { User, Save, LogOut, Loader2, Mail, Phone, Building2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { clearVendorSession } from '@/lib/session-utils';
import { useRouter } from 'next/navigation';

interface VendorProfileSettingsProps {
  vendorId: string;
  vendorData?: any;
  onBack?: () => void;
}

export function VendorProfileSettings({ vendorId, vendorData, onBack }: VendorProfileSettingsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    businessName: '',
    ownerName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    description: ''
  });

  useEffect(() => {
    loadProfile();
  }, [vendorId, vendorData]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      
      // Load vendor profile from API or use vendorData
      if (vendorData) {
        setProfile({
          businessName: vendorData.businessName || vendorData.business_name || '',
          ownerName: vendorData.ownerName || vendorData.owner_name || '',
          email: vendorData.email || vendorData.contactEmail || '',
          phone: vendorData.phone || vendorData.contactPhone || '',
          address: vendorData.address || '',
          city: vendorData.city || '',
          state: vendorData.state || '',
          pincode: vendorData.pincode || vendorData.zipCode || '',
          description: vendorData.description || vendorData.businessDescription || ''
        });
      } else {
        // Try to fetch from API
        try {
          const response = await apiClient.get(`/vendor/${vendorId}/profile`) as any;
          if (response && response.success && response.vendor) {
            const v = response.vendor;
            setProfile({
              businessName: v.businessName || v.business_name || '',
              ownerName: v.ownerName || v.owner_name || '',
              email: v.email || v.contactEmail || '',
              phone: v.phone || v.contactPhone || '',
              address: v.address || '',
              city: v.city || '',
              state: v.state || '',
              pincode: v.pincode || v.zipCode || '',
              description: v.description || v.businessDescription || ''
            });
          }
        } catch (error) {
          console.error('Error loading profile:', error);
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const response = await apiClient.put(`/vendor/${vendorId}/profile`, {
        businessName: profile.businessName,
        ownerName: profile.ownerName,
        email: profile.email,
        phone: profile.phone,
        address: profile.address,
        city: profile.city,
        state: profile.state,
        pincode: profile.pincode,
        description: profile.description
      }) as any;

      if (response && response.success) {
        toast.success('Profile updated successfully!');
        // Update localStorage vendor data
        const currentVendorData = JSON.parse(localStorage.getItem('vendorData') || '{}');
        localStorage.setItem('vendorData', JSON.stringify({
          ...currentVendorData,
          ...profile
        }));
      } else {
        throw new Error(response?.message || 'Failed to update profile');
      }
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      // Clear all session data
      clearVendorSession();
      
      // Clear session storage
      if (typeof window !== 'undefined') {
        sessionStorage.clear();
      }
      
      // Redirect to auth page
      router.push('/auth');
      toast.success('Logged out successfully');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#FF8C42]" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <User className="w-6 h-6" />
              Profile Settings
            </h2>
            <p className="text-sm text-gray-600 mt-1">Manage your vendor profile information</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Business Information */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Business Information
          </h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="businessName" className="text-sm font-semibold text-gray-700">
                Business Name *
              </Label>
              <Input
                id="businessName"
                value={profile.businessName}
                onChange={(e) => setProfile({ ...profile, businessName: e.target.value })}
                placeholder="Enter business name"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="ownerName" className="text-sm font-semibold text-gray-700">
                Owner Name *
              </Label>
              <Input
                id="ownerName"
                value={profile.ownerName}
                onChange={(e) => setProfile({ ...profile, ownerName: e.target.value })}
                placeholder="Enter owner name"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="description" className="text-sm font-semibold text-gray-700">
                Business Description
              </Label>
              <Textarea
                id="description"
                value={profile.description}
                onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                placeholder="Describe your business..."
                rows={4}
                className="mt-1"
              />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Contact Information
          </h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email *
              </Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                placeholder="Enter email address"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="phone" className="text-sm font-semibold text-gray-700">
                Phone Number *
              </Label>
              <Input
                id="phone"
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                placeholder="Enter 10-digit phone number"
                className="mt-1"
                maxLength={10}
              />
            </div>
          </div>
        </div>

        {/* Address Information */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Address Information
          </h3>
          <div className="space-y-4">
            <div>
              <Label htmlFor="address" className="text-sm font-semibold text-gray-700">
                Street Address
              </Label>
              <Input
                id="address"
                value={profile.address}
                onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                placeholder="Enter street address"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city" className="text-sm font-semibold text-gray-700">
                  City
                </Label>
                <Input
                  id="city"
                  value={profile.city}
                  onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                  placeholder="Enter city"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="state" className="text-sm font-semibold text-gray-700">
                  State
                </Label>
                <Input
                  id="state"
                  value={profile.state}
                  onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                  placeholder="Enter state"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="pincode" className="text-sm font-semibold text-gray-700">
                Pincode
              </Label>
              <Input
                id="pincode"
                value={profile.pincode}
                onChange={(e) => setProfile({ ...profile, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                placeholder="Enter pincode"
                className="mt-1"
                maxLength={6}
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="border-t border-gray-200 pt-6">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Profile
              </>
            )}
          </Button>
        </div>

        {/* Logout Button */}
        <div className="border-t border-red-100 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Actions</h3>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}
