'use client';

import { useState, useEffect } from 'react';
import { User, Save, LogOut, Loader2, Mail, Phone, Info, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { signOutVendor } from '@/lib/session-utils';
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
    email: '',
    phone: '',
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
          email: vendorData.email || vendorData.contactEmail || '',
          phone: vendorData.phone || vendorData.contactPhone || '',
        });
      } else {
        // Try to fetch from API
        try {
          const response = await apiClient.get(`/vendor/${vendorId}/profile`) as any;
          if (response && response.success && response.vendor) {
            const v = response.vendor;
            setProfile({
              email: v.email || v.contactEmail || '',
              phone: v.phone || v.contactPhone || '',
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
        email: profile.email,
        phone: profile.phone,
      }) as any;

      if (response && response.success) {
        toast.success('Account settings updated successfully!');
        // Update localStorage vendor data
        const currentVendorData = JSON.parse(localStorage.getItem('vendorData') || '{}');
        localStorage.setItem('vendorData', JSON.stringify({
          ...currentVendorData,
          email: profile.email,
          phone: profile.phone,
        }));
      } else {
        throw new Error(response?.message || 'Failed to update settings');
      }
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast.error(error.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await signOutVendor();
      if (typeof window !== 'undefined') {
        sessionStorage.clear();
      }
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
              Account Settings
            </h2>
            <p className="text-sm text-gray-600 mt-1">Manage your account contact information</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Info Banner - Redirect to Vendor Profile */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-blue-800 font-medium">
                Looking for Business & Address Information?
              </p>
              <p className="text-sm text-blue-700 mt-1">
                Business details, address, and service area are managed from your <strong>Vendor Profile</strong> in the dashboard. 
                Go to Dashboard → Profile to update those details.
              </p>
              <button
                onClick={onBack}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
              >
                <ExternalLink className="w-4 h-4" />
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Contact Information
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            This is the contact information associated with your account for notifications and support.
          </p>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Account Email
              </Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                placeholder="Enter email address"
                className="mt-1"
              />
              <p className="text-xs text-gray-400 mt-1">Used for account notifications and support communications</p>
            </div>

            <div>
              <Label htmlFor="phone" className="text-sm font-semibold text-gray-700">
                Account Phone Number
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
              <p className="text-xs text-gray-400 mt-1">Used for OTP verification and urgent notifications</p>
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
                Save Settings
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
