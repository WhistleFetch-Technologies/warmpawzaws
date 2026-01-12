import { useState } from 'react';
import { BusinessTypeSelector } from './BusinessTypeSelector';
import { SoloProviderOnboarding } from './SoloProviderOnboarding';
import { DynamicVendorOnboardingForm } from '../DynamicVendorOnboardingForm';
import { MockAPI } from '../../../lib/mockAPI';

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

  console.log('🚀 EnhancedVendorOnboarding - roleId:', roleId, 'roleName:', roleName);

  // Step 1: Business Type Selection
  const handleBusinessTypeSelect = (solo: boolean) => {
    console.log(`📝 Business type selected: ${solo ? 'Solo Provider' : 'Multi-Staff Center'}`);
    setIsSoloProvider(solo);
    setStep(solo ? 'solo_onboarding' : 'multi_staff_onboarding');
  };

  // Step 2a: Solo Provider Onboarding
  const handleSoloOnboardingSubmit = async (soloData: any) => {
    setSubmitting(true);
    
    try {
      console.log('📤 Submitting solo provider application:', soloData);

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
        profilePhoto: soloData.profilePhoto,
        business_type: 'solo'
      };

      // Use MockAPI instead of fetch
      const result = await MockAPI.vendor.submitApplication(payload);
      
      console.log('✅ Solo provider onboarded:', result);

      toast.success('Solo provider application submitted successfully!');
      
      onComplete({
        success: true,
        vendorId: result.id,
        isSoloProvider: true,
        status: 'submitted',
        roleId,
        ...soloData
      });

    } catch (error) {
      console.error('❌ Solo onboarding error:', error);
      toast.error(`Failed to submit: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setSubmitting(false);
    }
  };

  // Step 2b: Multi-Staff Center Onboarding (existing flow)
  const handleMultiStaffOnboardingSubmit = async (multiStaffData: any) => {
    setSubmitting(true);
    
    try {
      console.log('📤 Submitting multi-staff application:', multiStaffData);

      const formEmail = multiStaffData.formData?.email;
      const formPhone = multiStaffData.formData?.phone;
      const finalPhone = phone || formPhone;
      const finalEmail = formEmail || (finalPhone ? `${finalPhone}@warmpawz.com` : undefined);

      const applicationPayload = {
        roleId,
        phone: finalPhone,
        email: finalEmail,
        ...multiStaffData.formData,
        documents: multiStaffData.documents,
        serviceStyle: multiStaffData.serviceStyle || 'both',
        location: multiStaffData.location,
        business_type: 'business',
        isSoloProvider: false 
      };

      console.log('📤 Submitting to MockAPI');

      // Use MockAPI instead of fetch
      const result = await MockAPI.vendor.submitApplication(applicationPayload);

      console.log('✅ Multi-staff application submitted:', result);

      toast.success('Application submitted successfully!');

      onComplete({
        success: true,
        applicationId: result.id,
        vendorId: result.id,
        isSoloProvider: false,
        status: 'submitted',
        roleId,
        ...multiStaffData.formData
      });

    } catch (error) {
      console.error('❌ Multi-staff onboarding error:', error);
      toast.error(`Failed to submit: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setSubmitting(false);
    }
  };

  // Render appropriate step
  if (step === 'business_type') {
    return (
      <BusinessTypeSelector
        selectedRole={roleName || 'Service Provider'}
        onSelect={handleBusinessTypeSelect}
        onBack={onBack || (() => {})}
      />
    );
  }

  if (step === 'solo_onboarding') {
    return (
      <SoloProviderOnboarding
        roleId={roleId || 'general'}
        roleName={roleName || 'Service Provider'}
        phone={phone}
        onSubmit={handleSoloOnboardingSubmit}
        onBack={() => setStep('business_type')}
        submitting={submitting}
      />
    );
  }

  if (step === 'multi_staff_onboarding') {
    return (
      <DynamicVendorOnboardingForm
        roleId={roleId || 'general'}
        onSubmit={handleMultiStaffOnboardingSubmit}
        onBack={() => setStep('business_type')}
        serviceStyles={[]}
        initialData={initialData}
      />
    );
  }

  return null;
}
