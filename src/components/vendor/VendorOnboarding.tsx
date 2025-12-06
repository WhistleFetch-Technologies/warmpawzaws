import { useState } from 'react';
import { DynamicVendorOnboardingForm } from './DynamicVendorOnboardingForm';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface VendorOnboardingData {
  services?: string[];
  serviceStyle?: 'clinic' | 'home';
  fullName?: string;
  phone?: string;
  email?: string;
  serviceStyles?: string[];
  roleId?: string;
}

interface VendorOnboardingProps {
  onComplete: (data: VendorOnboardingData) => void;
  phone?: string;
  roleId?: string; // ✅ Pre-selected roleId from VendorRoleSelection
  roleName?: string; // ✅ Role name for display
  onBack?: () => void; // ✅ Back button handler to return to role selection
  initialData?: any; // ✅ NEW: For re-editing applications
}

export function VendorOnboarding({ onComplete, phone, roleId: preSelectedRoleId, roleName, onBack, initialData }: VendorOnboardingProps) {
  const [submitting, setSubmitting] = useState(false);

  // ✅ Since roleId is now pre-selected from VendorRoleSelection, we skip the service selection step
  const roleId = preSelectedRoleId || 'general';

  const handleDetailsSubmit = async (dynamicFormData: any) => {
    setSubmitting(true);
    
    try {
      console.log('[VENDOR ONBOARDING] Submitting application for roleId:', roleId);
      console.log('[VENDOR ONBOARDING] Form data:', dynamicFormData);

      // ✅ Robust Data Extraction with Fallbacks
      const formEmail = dynamicFormData.formData?.email;
      const formPhone = dynamicFormData.formData?.phone;
      
      // Prioritize prop phone, fallback to form phone
      const finalPhone = phone || formPhone;
      
      // Prioritize form email, fallback to generated email from phone
      const finalEmail = formEmail || (finalPhone ? `${finalPhone}@warmpawz.com` : undefined);

      if (!finalPhone && !finalEmail) {
          console.warn('⚠️ No phone or email found in form data or props');
          // Proceeding anyway, backend might handle validation
      }
      
      // Submit application using the enhanced onboarding API
      const applicationPayload = {
        roleId,
        phone: finalPhone,
        email: finalEmail,
        formData: dynamicFormData.formData,
        documents: dynamicFormData.documents,
        serviceStyle: dynamicFormData.serviceStyle || 'both', // Default to 'both' if not specified
        location: dynamicFormData.location
      };
      
      console.log('[VENDOR ONBOARDING] 📤 Submitting to /vendor/applications', applicationPayload);
      
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
        console.error('[VENDOR ONBOARDING] ❌ API Error:', errorText);
        throw new Error(errorText || `Failed to submit application: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('[VENDOR ONBOARDING] ✅ Application submitted:', result);
      
      // ✅ FIX: Pass the result data properly with status indicator
      // Complete onboarding with proper data structure
      const completionData = {
        success: true,
        applicationId: result.applicationId,
        vendorId: result.vendorId,
        status: 'submitted', // ✅ Tell parent to show submitted screen
        roleId,
        ...dynamicFormData.formData
      };
      
      toast.success('Registration submitted successfully!');
      onComplete(completionData);
      
    } catch (error) {
      console.error('[VENDOR ONBOARDING] ❌ Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to submit: ${errorMessage}`);
      setSubmitting(false); // ✅ Reset submitting on error
    }
    // ✅ Don't reset submitting on success - let parent handle navigation
  };

  // ✅ Directly show the dynamic form since role is already selected
  return (
    <DynamicVendorOnboardingForm 
      roleId={roleId}
      onSubmit={handleDetailsSubmit}
      onBack={onBack} // Pass the back handler to go to VendorRoleSelection
      serviceStyles={[]} // No longer needed since we don't have service selection
      initialData={initialData} // ✅ Pass initial data for re-editing
    />
  );
}