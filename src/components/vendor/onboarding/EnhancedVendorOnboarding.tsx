import { useState } from 'react';
import { BusinessTypeSelector } from './BusinessTypeSelector';
import { SoloProviderOnboarding } from './SoloProviderOnboarding';
import { DynamicVendorOnboardingForm } from '../DynamicVendorOnboardingForm';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

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
        profilePhoto: soloData.profilePhoto
      };

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/onboard-solo`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Solo onboarding error:', errorText);
        throw new Error(errorText || `Failed to submit: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Solo provider onboarded:', result);

      toast.success('Solo provider application submitted successfully!');
      
      onComplete({
        success: true,
        vendorId: result.vendorId,
        centerId: result.centerId,
        staffId: result.staffId,
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
        formData: multiStaffData.formData,
        documents: multiStaffData.documents,
        serviceStyle: multiStaffData.serviceStyle || 'both',
        location: multiStaffData.location,
        specializations: multiStaffData.specializations || [], // ✅ NEW: Include specializations
        isSoloProvider: false // ✅ Explicitly mark as multi-staff
      };

      console.log('📤 Submitting to /vendor/applications');
      console.log('📤 Specializations:', applicationPayload.specializations);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/applications`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify(applicationPayload)
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Multi-staff onboarding error:', errorText);
        throw new Error(errorText || `Failed to submit: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Multi-staff application submitted:', result);

      toast.success('Application submitted successfully!');

      onComplete({
        success: true,
        applicationId: result.applicationId,
        vendorId: result.vendorId,
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
