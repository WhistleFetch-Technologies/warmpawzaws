'use client';

import { useState, useEffect } from 'react';
import { BusinessTypeSelector } from './BusinessTypeSelector';
import { SoloProviderOnboarding } from './SoloProviderOnboarding';
import { DynamicVendorOnboardingForm } from '../orders/DynamicVendorOnboardingForm';
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

  // ✅ REMOVED: handleSoloOnboardingSubmit - Not used, SoloProviderOnboarding handles submission directly

  // ✅ FIX: handleMultiStaffOnboardingSubmit - Use correct endpoint
  const handleMultiStaffOnboardingSubmit = async (submissionData: any) => {
    setSubmitting(true);
    try {
      // ✅ FIX: Get phone from localStorage or props
      const vendorPhone = phone || (typeof window !== 'undefined' ? localStorage.getItem('vendorPhone') : null);
      
      if (!vendorPhone) {
        throw new Error('Phone number is required. Please log in again.');
      }

      // ✅ FIX: Transform submissionData to match backend expected format
      // ✅ FIX: Sanitize formData to remove invalid/placeholder fields
      const invalidFieldPatterns = ['new_field', 'newfield', 'new-field'];
      const invalidValuePatterns = ['xxxxxxxx', 'placeholder'];
      
      // ✅ DEBUG: Log raw submissionData - AGGRESSIVE LOGGING
      console.log(`📍 [EnhancedOnboarding] ========== PINCODE DEBUG START ==========`);
      console.log(`📍 [EnhancedOnboarding] Raw submissionData.formData keys: ${Object.keys(submissionData.formData || {}).join(', ')}`);
      console.log(`📍 [EnhancedOnboarding] Full submissionData.formData:`, JSON.stringify(submissionData.formData, null, 2));
      if (submissionData.formData) {
        Object.keys(submissionData.formData).forEach(key => {
          if (key.toLowerCase().includes('pin') || key.toLowerCase().includes('code')) {
            console.log(`📍 [EnhancedOnboarding] ✅ Found pincode-related field: ${key} = '${submissionData.formData[key]}' (type: ${typeof submissionData.formData[key]})`);
          }
        });
      }
      
      const sanitizedFormData: Record<string, any> = {};
      for (const [key, value] of Object.entries(submissionData.formData || {})) {
        // Skip fields with placeholder names
        if (invalidFieldPatterns.some(pattern => key.toLowerCase().includes(pattern))) {
          console.warn(`⚠️ [EnhancedOnboarding] Skipping invalid field: ${key}`);
          continue;
        }
        // Skip boolean values for fields that should be strings (e.g., phone: true)
        if (key === 'phone' && typeof value === 'boolean') {
          continue;
        }
        // Skip placeholder values
        if (typeof value === 'string' && invalidValuePatterns.some(pattern => value.toLowerCase().includes(pattern))) {
          continue;
        }
        // ✅ FIX: Normalize pincode field name - accept both 'pin' and 'pincode', but use 'pin' consistently
        if (key === 'pincode' || key === 'pinCode' || key === 'postalCode' || key === 'postal_code') {
          const pinStr = value != null && value !== '' ? String(value) : '';
          sanitizedFormData['pin'] = pinStr;
          sanitizedFormData['pincode'] = pinStr;
          console.log(`📍 [EnhancedOnboarding] Normalized pincode field: ${key} -> pin/pincode, value: '${pinStr}'`);
          continue;
        }
        // ✅ FIX: Don't skip pin/pincode even if empty - let backend handle it
        // Skip empty/null values (except for pin/pincode which might be intentionally empty)
        if (value === null || value === undefined || value === '') {
          // Allow empty string for pin/pincode (backend will handle validation)
          if (key === 'pin' || key === 'pincode' || key === 'pinCode') {
            sanitizedFormData['pin'] = value || ''; // Always use 'pin' as the key
            console.log(`📍 [EnhancedOnboarding] Including pin field (may be empty): ${key} -> pin = '${value}'`);
          }
          continue;
        }
        sanitizedFormData[key] = value;
      }
      
      // ✅ DEBUG: Log sanitized formData before sending
      console.log(`📍 [EnhancedOnboarding] Sanitized formData keys: ${Object.keys(sanitizedFormData).join(', ')}`);
      if (sanitizedFormData.pin !== undefined) {
        console.log(`📍 [EnhancedOnboarding] ✅ Final pin value in sanitizedFormData: '${sanitizedFormData.pin}'`);
      } else {
        console.warn(`📍 [EnhancedOnboarding] ⚠️ WARNING: pin field NOT found in sanitizedFormData!`);
      }
      
      // ✅ FIX: Sanitize documents to only include valid entries with URLs
      const validDocuments = Object.entries(submissionData.documents || {})
        .filter(([key, doc]: [string, any]) => {
          if (invalidFieldPatterns.some(pattern => key.toLowerCase().includes(pattern))) {
            return false;
          }
          return doc?.url && doc.url.trim() !== '';
        })
        .map(([key, doc]: [string, any]) => {
          // ✅ FIX: Ensure profilePhoto is correctly typed
          const docType = key === 'profilePhoto' || key === 'profile_photo' ? 'profilePhoto' : key;
          console.log(`📸 [EnhancedOnboarding] Document mapping: ${key} -> type: ${docType}, url: ${doc?.url ? 'present' : 'missing'}`);
          return {
            type: docType,
            name: doc?.name || key,
            url: doc?.url || '',
            size: doc?.size,
            mime_type: doc?.type,
          };
        });
      
      // ✅ FIX: Log profilePhoto document specifically
      const profilePhotoDoc = validDocuments.find(doc => doc.type === 'profilePhoto' || doc.type === 'profile_photo');
      if (profilePhotoDoc) {
        console.log(`📸 [EnhancedOnboarding] ✅ Profile photo document found: type=${profilePhotoDoc.type}, url=${profilePhotoDoc.url}`);
      } else {
        console.warn(`⚠️ [EnhancedOnboarding] Profile photo document NOT found in uploaded_documents`);
      }
      
      const payload = {
        phone: vendorPhone,
        application_payload: {
          ...sanitizedFormData,
          roleId: submissionData.roleId || roleId,
          location: submissionData.location || submissionData.coordinates,
          coordinates: submissionData.coordinates || submissionData.location,
          serviceStyles: submissionData.serviceStyles || [],
          agreedToTerms: submissionData.agreedToTerms || false,
          formVersion: submissionData.formVersion || 1,
        },
        uploaded_documents: validDocuments,
      };
      
      console.log('📤 [EnhancedOnboarding] Sanitized payload:', JSON.stringify(payload, null, 2));

      // ✅ FIX: Use correct endpoint /vendor/onboarding/submit-application
      const response = await apiClient.post<any>('/vendor/onboarding/submit-application', payload);
      
      if (response.success || response.applicationId) {
        onComplete({
          success: true,
          applicationId: response.applicationId,
          vendorId: response.vendorId,
          isSoloProvider: false,
          status: 'submitted',
          roleId: roleId,
        });
      } else {
        throw new Error(response.error || 'Failed to submit application');
      }
    } catch (error: any) {
      console.error('Multi-staff onboarding error:', error);
      alert(`Failed to submit: ${error.message || 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Show loading state while determining role configuration
  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 vendor-app-column flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (step === 'business_type') {
    return (
      <div className="min-h-screen bg-gray-50 vendor-app-column p-0">
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
