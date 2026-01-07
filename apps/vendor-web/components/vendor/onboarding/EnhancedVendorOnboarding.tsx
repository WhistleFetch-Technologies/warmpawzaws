'use client';

import { useState, useEffect } from 'react';
import { BusinessTypeSelector } from './BusinessTypeSelector';
import { SoloProviderOnboarding } from './SoloProviderOnboarding';
import { DynamicVendorOnboardingForm } from '../DynamicVendorOnboardingForm';
import { apiClient } from '@/lib/api-client';

interface EnhancedVendorOnboardingProps {
  onComplete: (data: any) => void;
  phone?: string;
  roleId?: string;
  roleName?: string;
  onBack?: () => void;
  initialData?: any;
}

// Roles that support solo vendor option (can choose between solo and business)
const ROLES_WITH_SOLO_OPTION = [
  'veterinarian',
  'pet_groomer',
  'pet_trainer',
  'pet_behaviorist',
  'behaviorist',
  'behaviourist'
];

// Roles that are always solo (no choice, skip business type selection)
const ALWAYS_SOLO_ROLES = [
  'pet_walker'
];

export function EnhancedVendorOnboarding({ 
  onComplete, 
  phone, 
  roleId, 
  roleName, 
  onBack,
  initialData 
}: EnhancedVendorOnboardingProps) {
  const [step, setStep] = useState<'loading' | 'business_type' | 'solo_onboarding' | 'multi_staff_onboarding'>('loading');
  const [isSoloProvider, setIsSoloProvider] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fetchedRoleName, setFetchedRoleName] = useState<string | null>(null);

  // Fetch role information if roleId is provided but roleName is not
  useEffect(() => {
    const initializeRole = async () => {
      if (!roleId) {
        setStep('business_type');
        return;
      }

      // Use provided roleName if available
      const currentRoleName = roleName || fetchedRoleName;
      
      // If we have roleName, determine next step
      if (currentRoleName) {
        const normalizedRoleName = currentRoleName.toLowerCase();
        
        // Walker is always solo - skip business type selection
        if (ALWAYS_SOLO_ROLES.includes(normalizedRoleName)) {
          setIsSoloProvider(true);
          setStep('solo_onboarding');
          return;
        }
        
        // Roles with solo option - show business type selection
        if (ROLES_WITH_SOLO_OPTION.includes(normalizedRoleName)) {
          setStep('business_type');
          return;
        }
        
        // Other roles - go directly to multi-staff onboarding
        setIsSoloProvider(false);
        setStep('multi_staff_onboarding');
        return;
      }

      // If no roleName, try to fetch from roleId
      try {
        const roleResponse = await apiClient.get<any>(`/config/roles/${roleId}`);
        if (roleResponse.role || roleResponse) {
          const role = roleResponse.role || roleResponse;
          const roleNameFromResponse = role.name || role.roleName;
          
          if (roleNameFromResponse) {
            setFetchedRoleName(roleNameFromResponse);
            const normalizedRoleName = roleNameFromResponse.toLowerCase();
            
            // Walker is always solo - skip business type selection
            if (ALWAYS_SOLO_ROLES.includes(normalizedRoleName)) {
              setIsSoloProvider(true);
              setStep('solo_onboarding');
              return;
            }
            
            // Check vendor types supported from role config
            const vendorTypes = role.vendor_types_supported || role.config?.vendorTypes || [];
            const supportsSolo = vendorTypes.includes('solo') || vendorTypes.includes('solo_provider');
            const supportsBusiness = vendorTypes.includes('business') || vendorTypes.includes('center');
            
            // If role supports both solo and business, show selection
            if (supportsSolo && supportsBusiness && ROLES_WITH_SOLO_OPTION.includes(normalizedRoleName)) {
              setStep('business_type');
              return;
            }
            
            // If role only supports solo, go directly to solo onboarding
            if (supportsSolo && !supportsBusiness) {
              setIsSoloProvider(true);
              setStep('solo_onboarding');
              return;
            }
            
            // Otherwise, go to multi-staff onboarding
            setIsSoloProvider(false);
            setStep('multi_staff_onboarding');
            return;
          }
        }
      } catch (error) {
        console.error('Error fetching role information:', error);
        // Default to business type selection if fetch fails
        setStep('business_type');
      }
    };

    initializeRole();
  }, [roleId, roleName]);

  const handleBusinessTypeSelect = (solo: boolean) => {
    setIsSoloProvider(solo);
    setStep(solo ? 'solo_onboarding' : 'multi_staff_onboarding');
  };

  const handleSoloOnboardingSubmit = async (soloData: any) => {
    setSubmitting(true);
    
    try {
      const payload = {
        roleId,
        phone: phone || soloData.phone,
        email: soloData.email,
        ownerName: soloData.ownerName,
        businessName: soloData.businessName,
        panNumber: soloData.panNumber,
        bankAccount: soloData.bankAccount,
        serviceArea: soloData.serviceArea,
        operatingHours: soloData.operatingHours,
        certifications: soloData.certifications || [],
        experience: soloData.experience || 0,
        specializations: soloData.specializations || [],
        bio: soloData.bio || '',
        profilePhoto: soloData.profilePhoto
      };

      const response = await apiClient.post<any>('/vendor/onboard-solo', payload);

      if (response.success) {
        onComplete({
          success: true,
          vendorId: response.vendorId,
          centerId: response.centerId,
          staffId: response.staffId,
          isSoloProvider: true,
          status: 'submitted',
          roleId,
          ...soloData
        });
      } else {
        throw new Error(response.error || 'Failed to submit');
      }
    } catch (error: any) {
      console.error('Solo onboarding error:', error);
      alert(`Failed to submit: ${error.message || 'Unknown error'}`);
      setSubmitting(false);
    }
  };

  const handleMultiStaffOnboardingSubmit = async (formData: any) => {
    setSubmitting(true);
    try {
      const response = await apiClient.post<any>('/vendor/onboard', formData);
      if (response.success) {
        onComplete({
          success: true,
          vendorId: response.vendorId,
          isSoloProvider: false,
          status: 'submitted',
          roleId,
          ...formData
        });
      }
    } catch (error: any) {
      console.error('Multi-staff onboarding error:', error);
      alert(`Failed to submit: ${error.message || 'Unknown error'}`);
      setSubmitting(false);
    }
  };

  // Show loading state while determining role configuration
  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (step === 'business_type') {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto p-0">
        <div className="mb-0">
          {onBack && (
            <button onClick={onBack} className="text-primary hover:underline text-sm mb-4">
              ← Back
            </button>
          )}
          <h1 className="text-2xl font-bold text-gray-900 mb-0">Choose Your Business Type</h1>
          <p className="text-gray-600 text-sm">Select how you'll operate</p>
        </div>

        <div className="space-y-4">
          <button
            type="button"
            onClick={() => handleBusinessTypeSelect(true)}
            className="w-full p-0 bg-white rounded-xl border-2 border-gray-200 hover:border-primary transition-all text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                <span className="text-2xl">👤</span>
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Solo Provider</h3>
                <p className="text-sm text-gray-600">I work alone, no staff needed</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleBusinessTypeSelect(false)}
            className="w-full p-0 bg-white rounded-xl border-2 border-gray-200 hover:border-primary transition-all text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-2xl">🏢</span>
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Multi-Staff Center</h3>
                <p className="text-sm text-gray-600">I have a business with multiple staff</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (step === 'solo_onboarding' && roleId) {
    // Determine if we can go back to business type selection
    // Only allow back if role supports solo option (not always solo roles like walker)
    const currentRoleName = roleName || fetchedRoleName;
    const normalizedRoleName = currentRoleName?.toLowerCase();
    const canGoBack = normalizedRoleName && ROLES_WITH_SOLO_OPTION.includes(normalizedRoleName);
    
    return (
      <SoloProviderOnboarding
        roleId={roleId}
        onBack={canGoBack ? () => setStep('business_type') : onBack}
        onSuccess={() => {
          // SoloProviderOnboarding already handles submission internally
          // Just notify parent that onboarding is complete
          onComplete({
            success: true,
            isSoloProvider: true,
          });
        }}
      />
    );
  }

  if (step === 'multi_staff_onboarding' && roleId) {
    // Determine if we can go back to business type selection
    // Only allow back if role supports solo option
    const currentRoleName = roleName || fetchedRoleName;
    const normalizedRoleName = currentRoleName?.toLowerCase();
    const canGoBack = normalizedRoleName && ROLES_WITH_SOLO_OPTION.includes(normalizedRoleName);
    
    return (
      <DynamicVendorOnboardingForm
        roleId={roleId}
        onSubmit={handleMultiStaffOnboardingSubmit}
        onBack={canGoBack ? () => setStep('business_type') : onBack}
        initialData={initialData}
      />
    );
  }

  return null;
}
