'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { ProfessionalProfileManager } from '@/components/vendor/vendorProfileManager/ProfessionalProfileManagerSolo';
import { ProfileManager as CenterProfileManager } from '@/components/vendor/vendorProfileManager/ProfileManagerCenter';
import { isSoloVendor } from '@/lib/vendor-utils';

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
  role?: { id?: string; name?: string };
  vendorType?: string;
  vendor_type?: 'solo' | 'business' | string;
  vendorConfiguration?: 'solo' | 'business' | string;
  vendor_configuration?: 'solo' | 'business' | string;
}

/**
 * ✅ UNIFIED PROFILE PAGE
 * 
 * Routes to the appropriate enhanced profile manager based on vendor type:
 * - Solo/Professional vendors -> ProfessionalProfileManager
 * - Center/Business vendors -> CenterProfileManager (ProfileManager)
 * 
 * Both are feature-rich enhanced profiles with:
 * - Photo upload (solo); center listing photos via Dashboard → Gallery
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
        vendor_configuration?: 'solo' | 'business';
        vendor_type?: 'solo' | 'business';
        vendorType?: string;
        role?: { id?: string; name?: string };
        roleName?: string;
        role_name?: string;
        roleId?: string;
        role_id?: string;
      }>(`/vendor/${storedVendorId}/profile`);
      
      if (response.success && response.vendor) {
        setProfile(response.vendor);
        
        // ✅ FIX: Use isSoloVendor utility to properly detect solo vendors (including groomer_solo)
        // This checks role name patterns, vendorConfiguration, vendor_type, and other flags
        // IMPORTANT: Include the full role object (role.name) as getVendorRoleName checks role.name first
        const combinedVendorData = {
          ...response.vendor,
          ...vendorData,
          role: response.vendor.role || vendorData?.role, // ✅ Include full role object
          roleName: response.vendor.roleName || response.vendor.role_name || response.vendor.role?.name || vendorData?.roleName || vendorData?.role_name || vendorData?.role?.name,
          roleId: response.vendor.roleId || response.vendor.role_id || response.vendor.role?.id || vendorData?.roleId || vendorData?.role_id || vendorData?.role?.id,
          vendorType: response.vendor.vendorType || response.vendor.vendor_type || vendorData?.vendorType || vendorData?.vendor_type,
          vendorConfiguration: response.vendor.vendorConfiguration || response.vendor.vendor_configuration || vendorData?.vendorConfiguration || vendorData?.vendor_configuration,
        };
        
        console.log('[PROFILE] Combined vendor data for solo check:', {
          roleName: combinedVendorData.roleName,
          role: combinedVendorData.role,
          vendorType: combinedVendorData.vendorType,
          vendorConfiguration: combinedVendorData.vendorConfiguration,
        });
        
        const isSolo = isSoloVendor(combinedVendorData);
        console.log('[PROFILE] isSoloVendor result:', isSolo);
        console.log('[PROFILE] API profileType:', response.vendor.profileType);
        
        // ✅ CRITICAL FIX: Prioritize solo detection over API profileType
        // If isSoloVendor detects solo, force 'professional' regardless of API response
        // This ensures groomer_solo and other solo roles always get the correct profile manager
        const type = isSolo ? 'professional' : (response.vendor.profileType || 'center');
        console.log('[PROFILE] Setting profileType to:', type, '(isSolo:', isSolo, ')');
        setProfileType(type);
      } else if (response.business_name) {
        // Fallback if response structure is different
        setProfile(response as unknown as VendorProfile);
        
        // ✅ FIX: Use isSoloVendor utility for fallback case too
        const combinedVendorData = {
          ...response,
          ...vendorData,
          role: response.role || vendorData?.role, // ✅ Include full role object
          roleName: response.roleName || response.role_name || response.role?.name || vendorData?.roleName || vendorData?.role_name || vendorData?.role?.name,
          roleId: response.roleId || response.role_id || response.role?.id || vendorData?.roleId || vendorData?.role_id || vendorData?.role?.id,
          vendorType: response.vendorType || response.vendor_type || vendorData?.vendorType || vendorData?.vendor_type,
          vendorConfiguration: response.vendorConfiguration || response.vendor_configuration || vendorData?.vendorConfiguration || vendorData?.vendor_configuration,
        };
        
        const isSolo = isSoloVendor(combinedVendorData);
        console.log('[PROFILE] Fallback - isSoloVendor result:', isSolo);
        
        // ✅ CRITICAL FIX: Prioritize solo detection over API profileType
        const type = isSolo ? 'professional' : (response.profileType || 'center');
        console.log('[PROFILE] Fallback - Setting profileType to:', type);
        setProfileType(type);
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
        <div className="vendor-app-column flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      </div>
    );
  }

  if (!vendorId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 w-full">
        <div className="vendor-app-column text-center px-4">
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

  // ✅ FIX: Final safety check - use isSoloVendor to ensure correct routing
  // This catches cases where profileType might not have been set correctly
  // IMPORTANT: Include the full role object (role.name) as getVendorRoleName checks role.name first
  const enrichedVendorData = {
    ...vendorData,
    ...profile,
    role: profile?.role || vendorData?.role, // ✅ Include full role object
    roleId: profile?.roleId || profile?.role_id || profile?.role?.id || vendorData?.roleId || vendorData?.role_id || vendorData?.role?.id,
    roleName: profile?.roleName || profile?.role_name || profile?.role?.name || vendorData?.roleName || vendorData?.role_name || vendorData?.role?.name,
    vendorType: profile?.vendorType || profile?.vendor_type || vendorData?.vendorType || vendorData?.vendor_type,
    vendorConfiguration: profile?.vendorConfiguration || profile?.vendor_configuration || vendorData?.vendorConfiguration || vendorData?.vendor_configuration,
  };
  
  console.log('[PROFILE] Final check - enrichedVendorData:', {
    roleName: enrichedVendorData.roleName,
    role: enrichedVendorData.role,
    vendorType: enrichedVendorData.vendorType,
    vendorConfiguration: enrichedVendorData.vendorConfiguration,
    profileType,
  });
  
  // ✅ Double-check: If profileType says professional OR isSoloVendor detects solo, use ProfessionalProfileManager
  const isSolo = profileType === 'professional' || isSoloVendor(enrichedVendorData);
  console.log('[PROFILE] Final isSolo check:', isSolo);
  
  // ✅ Route to ProfessionalProfileManager for solo vendors (no amenities)
  if (isSolo) {
    const enrichedProfile = {
      ...profile,
      roleId: enrichedVendorData.roleId,
      roleName: enrichedVendorData.roleName,
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
  return (
    <CenterProfileManager 
      vendorId={vendorId} 
      vendorData={enrichedVendorData}
      onBack={() => router.back()} 
    />
  );
}
