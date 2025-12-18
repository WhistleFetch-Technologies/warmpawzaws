/**
 * Onboarding Screen - Vendor Mobile App
 * Matches EnhancedVendorOnboarding from web app
 * Handles business type selection and routes to appropriate form
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, publicAnonKey } from '../../config/api';
import BusinessTypeSelectorScreen from './BusinessTypeSelectorScreen';
import SoloProviderOnboardingScreen from './SoloProviderOnboardingScreen';
import MultiStaffOnboardingScreen from './MultiStaffOnboardingScreen';

interface OnboardingScreenProps {
  route?: {
    params?: {
      roleId?: string;
      vendorType?: string;
      applicationId?: string;
      mode?: 'new' | 'clarification' | 'resubmit';
      isMultiStaff?: boolean;
      roleName?: string;
    };
  };
  navigation?: any;
}

type OnboardingStep = 'business_type' | 'solo_onboarding' | 'multi_staff_onboarding';

export default function OnboardingScreen({
  route,
  navigation,
}: OnboardingScreenProps) {
  const { vendor } = useAuth();
  const roleId = route?.params?.roleId || 'service-provider';
  const mode = route?.params?.mode || 'new';
  const isMultiStaff = route?.params?.isMultiStaff || false;
  const roleName = route?.params?.roleName || 'Service Provider';
  
  const [step, setStep] = useState<OnboardingStep>(
    isMultiStaff ? 'multi_staff_onboarding' : 'business_type'
  );
  const [isSoloProvider, setIsSoloProvider] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Business Type Selection
  const handleBusinessTypeSelect = (solo: boolean) => {
    setIsSoloProvider(solo);
    setStep(solo ? 'solo_onboarding' : 'multi_staff_onboarding');
  };

  // Step 2a: Solo Provider Onboarding Submit
  const handleSoloOnboardingSubmit = async (soloData: any) => {
    setSubmitting(true);
    
    try {
      const phone = vendor?.phone || soloData.phone;
      
      const payload = {
        roleId,
        phone,
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
      };

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/onboard-solo`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Failed to submit: ${response.status}`);
      }

      const result = await response.json();
      
      Alert.alert('Success', 'Solo provider application submitted successfully!');
      
      if (navigation) {
        navigation.navigate('ApplicationSubmitted', {
          applicationId: result.applicationId || result.vendorId,
        });
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit application');
      setSubmitting(false);
    }
  };

  // Step 2b: Multi-Staff Onboarding Submit
  const handleMultiStaffOnboardingSubmit = async (multiStaffData: any) => {
    setSubmitting(true);
    
    try {
      const phone = vendor?.phone || multiStaffData.formData?.phone;
      const formEmail = multiStaffData.formData?.email;
      const finalEmail = formEmail || (phone ? `${phone}@warmpawz.com` : undefined);

      const applicationPayload = {
        roleId,
        phone,
        email: finalEmail,
        formData: multiStaffData.formData,
        documents: multiStaffData.documents,
        serviceStyle: multiStaffData.serviceStyle || 'both',
        location: multiStaffData.location,
        isSoloProvider: false,
      };

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/applications`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify(applicationPayload),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Failed to submit: ${response.status}`);
      }

      const result = await response.json();
      
      Alert.alert('Success', 'Application submitted successfully!');

      if (navigation) {
        navigation.navigate('ApplicationSubmitted', {
          applicationId: result.applicationId || result.vendorId,
        });
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit application');
      setSubmitting(false);
    }
  };

  // Render appropriate step
  if (step === 'business_type') {
    return (
      <BusinessTypeSelectorScreen
        route={route}
        navigation={navigation}
        onSelect={handleBusinessTypeSelect}
      />
    );
  }

  if (step === 'solo_onboarding') {
    return (
      <SoloProviderOnboardingScreen
        route={{
          params: {
            roleId,
            roleName,
            phone: vendor?.phone,
          },
        }}
        navigation={navigation}
        onSubmit={handleSoloOnboardingSubmit}
        onBack={() => setStep('business_type')}
        submitting={submitting}
      />
    );
  }

  // Multi-staff onboarding
  return (
    <MultiStaffOnboardingScreen
      route={route}
      navigation={navigation}
      onSubmit={handleMultiStaffOnboardingSubmit}
      onBack={() => setStep('business_type')}
      submitting={submitting}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: Spacing.xl,
  },
  content: {
    flex: 1,
  },
  title: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    color: BrandColors.neutral.gray600,
    marginBottom: Spacing.xl,
  },
  placeholderCard: {
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.xl,
    minHeight: 200,
    justifyContent: 'center',
  },
  placeholderText: {
    color: BrandColors.neutral.gray600,
    marginTop: Spacing.base,
    textAlign: 'center',
  },
  placeholderSubtext: {
    color: BrandColors.neutral.gray500,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
});

