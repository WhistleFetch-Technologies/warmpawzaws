'use client';

import { useState } from 'react';
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

export function EnhancedVendorOnboarding({ 
  onComplete, 
  phone, 
  roleId, 
  roleName, 
  onBack,
  initialData 
}: EnhancedVendorOnboardingProps) {
  const [step, setStep] = useState<'business_type' | 'solo_onboarding' | 'multi_staff_onboarding'>('business_type');
  const [isSoloProvider, setIsSoloProvider] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  if (step === 'business_type') {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto p-6">
        <div className="mb-6">
          {onBack && (
            <button onClick={onBack} className="text-primary hover:underline text-sm mb-4">
              ← Back
            </button>
          )}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Business Type</h1>
          <p className="text-gray-600 text-sm">Select how you'll operate</p>
        </div>

        <div className="space-y-4">
          <button
            type="button"
            onClick={() => handleBusinessTypeSelect(true)}
            className="w-full p-6 bg-white rounded-xl border-2 border-gray-200 hover:border-primary transition-all text-left"
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
            className="w-full p-6 bg-white rounded-xl border-2 border-gray-200 hover:border-primary transition-all text-left"
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
    return (
      <SoloProviderOnboarding
        roleId={roleId}
        roleName={roleName || 'Provider'}
        phone={phone}
        onSubmit={handleSoloOnboardingSubmit}
        onBack={() => setStep('business_type')}
        submitting={submitting}
      />
    );
  }

  if (step === 'multi_staff_onboarding' && roleId) {
    return (
      <DynamicVendorOnboardingForm
        roleId={roleId}
        onSubmit={handleMultiStaffOnboardingSubmit}
        onBack={() => setStep('business_type')}
        initialData={initialData}
      />
    );
  }

  return null;
}
