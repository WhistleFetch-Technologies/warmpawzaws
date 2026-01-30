'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { ProfessionalProfileManager } from '@/components/vendor/ProfessionalProfileManager';
import { ProfileManager as CenterProfileManager } from '@/components/vendor/CenterProfileManager';

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

/**
 * ✅ UNIFIED PROFILE PAGE
 * 
 * Routes to the appropriate enhanced profile manager based on vendor type:
 * - Solo/Professional vendors -> ProfessionalProfileManager
 * - Center/Business vendors -> CenterProfileManager (ProfileManager)
 * 
 * Both are feature-rich enhanced profiles with:
 * - Photo upload
 * - Address autocomplete
 * - Specializations (Problem Grid)
 * - Availability/Schedule management
 * - Amenities (for centers)
 */
export default function ProfilePage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [vendorData, setVendorData] = useState<any>(null);
  const [profileType, setProfileType] = useState<'professional' | 'center' | null>(null);

  useEffect(() => {
    const storedVendorId = localStorage.getItem('vendorId');
    if (!storedVendorId) {
      router.push('/onboarding');
      return;
    }
    setVendorId(storedVendorId);
    
    // Load vendorData from localStorage for roleId/roleName
    const storedVendorData = localStorage.getItem('vendorData');
    if (storedVendorData) {
      try {
        setVendorData(JSON.parse(storedVendorData));
      } catch (e) {
        console.warn('Failed to parse vendorData:', e);
      }
    }
    
    loadProfile();
  }, [router]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const storedVendorId = localStorage.getItem('vendorId');
      if (!storedVendorId) return;

      const response = await apiClient.get<{
        success?: boolean;
        vendor?: VendorProfile & {
          profileType?: 'professional' | 'center';
          vendorConfiguration?: 'solo' | 'business';
          vendor_type?: 'solo' | 'business';
        };
        business_name?: string;
        profileType?: 'professional' | 'center';
        vendorConfiguration?: 'solo' | 'business';
        vendor_type?: 'solo' | 'business';
      }>(`/vendor/${storedVendorId}/profile`);
      
      if (response.success && response.vendor) {
        setProfile(response.vendor);
        // Determine profile type
        const type = response.vendor.profileType || 
                     (response.vendor.vendorConfiguration === 'solo' || response.vendor.vendor_type === 'solo' 
                       ? 'professional' 
                       : 'center') ||
                     response.profileType ||
                     'center'; // Default to center for backward compatibility
        setProfileType(type);
      } else if (response.business_name) {
        // Fallback if response structure is different
        setProfile(response as unknown as VendorProfile);
        setProfileType(response.profileType || 
                      (response.vendorConfiguration === 'solo' || response.vendor_type === 'solo'
                        ? 'professional' 
                        : 'center') ||
                      'center');
      }
    } catch (err: any) {
      console.error('Error loading profile:', err);
      toast.error(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 w-full">
        <div className="w-full max-w-[430px] mx-auto flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      </div>
    );
  }

  if (!vendorId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 w-full">
        <div className="w-full max-w-[430px] mx-auto text-center px-4">
          <p className="text-gray-600 mb-4">Vendor not found</p>
          <button 
            onClick={() => router.push('/onboarding')}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg"
          >
            Go to Onboarding
          </button>
        </div>
      </div>
    );
  }

  // ✅ Route to ProfessionalProfileManager for solo vendors
  if (profileType === 'professional') {
    const enrichedProfile = {
      ...profile,
      roleId: profile?.roleId || profile?.role_id || vendorData?.roleId || vendorData?.role_id,
      roleName: profile?.roleName || profile?.role_name || vendorData?.roleName || vendorData?.role_name,
    };
    return (
      <ProfessionalProfileManager 
        vendorId={vendorId} 
        profile={enrichedProfile} 
        onBack={() => router.back()} 
      />
    );
  }

  // ✅ Route to CenterProfileManager for center/business vendors
  // This is the ENHANCED profile with tabs: Basic Info, Availability, Amenities, Specialization
  const enrichedVendorData = {
    ...vendorData,
    ...profile,
    roleId: profile?.roleId || profile?.role_id || vendorData?.roleId || vendorData?.role_id,
    roleName: profile?.roleName || profile?.role_name || vendorData?.roleName || vendorData?.role_name,
  };
  
  return (
    <CenterProfileManager 
      vendorId={vendorId} 
      vendorData={enrichedVendorData}
      onBack={() => router.back()} 
    />
  );
}
