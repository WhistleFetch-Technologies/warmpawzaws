/**
 * Login Screen - Customer Mobile App
 * Matches web app CustomerAuth component exactly
 * Includes: Phone OTP, Referral Code, All web features
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  StatusBar,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, publicAnonKey } from '../../config/api';

interface LoginScreenProps {
  onAuthSuccess?: (session: any) => void;
}

export default function LoginScreen({ onAuthSuccess }: LoginScreenProps) {
  const { login } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showReferralInput, setShowReferralInput] = useState(false);

  const handleSendCode = async () => {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    
    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('🔐 Requesting OTP for:', cleanPhone);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/otp/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ phone: cleanPhone })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send OTP');
      }

      const data = await response.json();
      console.log('✅ OTP sent:', data);
      
      if (data.uatMode) {
        Alert.alert('UAT Testing Mode', 'OTP: 123456', [{ text: 'OK' }]);
      } else {
        Alert.alert('Success', 'OTP sent to your phone');
      }
      
      setShowOtpScreen(true);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
      console.error('❌ Send code error:', err);
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
      
      console.log('🔐 Verifying OTP for:', cleanPhone);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/otp/verify`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ phone: cleanPhone, otp: otpCode })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to verify OTP');
      }

      const data = await response.json();
      console.log('✅ OTP verified:', data);
      
      // Apply referral code if provided
      if (referralCode && data.isNewUser) {
        try {
          console.log('🎁 Applying referral code:', referralCode);
          const referralResponse = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/loyalty/referral/apply`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${publicAnonKey}`
              },
              body: JSON.stringify({
                referralCode: referralCode,
                newUserId: data.customer.id,
                userType: 'customer'
              })
            }
          );

          if (referralResponse.ok) {
            const referralData = await referralResponse.json();
            console.log('✅ Referral code applied:', referralData);
            Alert.alert('Success', '🎉 Referral code applied! You\'ll earn bonus points!');
          } else {
            const errorData = await referralResponse.json();
            console.log('⚠️ Referral code failed:', errorData.error);
            Alert.alert('Error', errorData.error || 'Invalid referral code');
          }
        } catch (refError: any) {
          console.error('❌ Referral code error:', refError);
          // Don't block signup if referral fails
        }
      }
      
      // Check if user has completed onboarding
      const hasCompletedOnboarding = data.customer.onboardingComplete;
      const hasPets = data.customer.petIds && data.customer.petIds.length > 0;
      
      console.log('📊 User state:', {
        isNewUser: data.isNewUser,
        hasCompletedOnboarding,
        hasPets,
        customer: data.customer
      });
      
      // Create session object matching web app
      const session = {
        phone: cleanPhone,
        customerId: data.customer.id,
        customer: data.customer,
        sessionToken: data.sessionToken,
        verified: true,
        isNewUser: data.isNewUser,
        hasCompletedOnboarding,
        hasPets
      };
      
      // Login via AuthContext
      await login(
        {
          id: data.customer.id,
          phone: cleanPhone,
          name: data.customer.name,
        },
        data.sessionToken
      );
      
      // Call onAuthSuccess if provided
      if (onAuthSuccess) {
        onAuthSuccess(session);
      }
      
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP');
      console.error('❌ Verify OTP error:', err);
      setLoading(false);
    }
  };

  // OTP VERIFICATION SCREEN
  if (showOtpScreen) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              setShowOtpScreen(false);
              setOtpCode('');
              setError('');
            }}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.centerContent}>
            {/* Logo - Using paw print with heart matching web */}
            <View style={styles.logoContainer}>
              <View style={styles.pawLogo}>
                {/* Main paw pad */}
                <View style={styles.pawPad} />
                {/* Heart in center */}
                <View style={styles.heart} />
                {/* Toes */}
                <View style={[styles.toe, styles.toeTopLeft]} />
                <View style={[styles.toe, styles.toeTopCenterLeft]} />
                <View style={[styles.toe, styles.toeTopCenterRight]} />
                <View style={[styles.toe, styles.toeTopRight]} />
              </View>
            </View>

            <Text style={[Typography.h2, styles.title]}>
              Enter verification code
            </Text>
            <Text style={[Typography.bodySmall, styles.subtitle]}>
              We've sent a code to +91 {phoneNumber}
            </Text>

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.form}>
              <Text style={[Typography.bodySmall, styles.label]}>
                6-digit code
              </Text>
              <TextInput
                style={styles.otpInput}
                value={otpCode}
                onChangeText={(text) => setOtpCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="••••••"
                placeholderTextColor={BrandColors.neutral.gray400}
                autoFocus
                textAlign="center"
              />

              <BrandedButton
                title={loading ? 'Verifying...' : 'Verify Code'}
                onPress={handleVerifyOtp}
                disabled={loading || otpCode.length !== 6}
                fullWidth
              />

              <TouchableOpacity
                style={styles.resendButton}
                onPress={handleSendCode}
                disabled={loading}
              >
                <Text style={styles.resendText}>Resend code</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // PHONE NUMBER SCREEN
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.centerContent}>
          {/* Logo - Paw print with heart */}
          <View style={styles.logoContainerLarge}>
            <View style={styles.pawLogoLarge}>
              <View style={styles.pawPadLarge} />
              <View style={styles.heartLarge} />
              <View style={[styles.toeLarge, styles.toeTopLeftLarge]} />
              <View style={[styles.toeLarge, styles.toeTopCenterLeftLarge]} />
              <View style={[styles.toeLarge, styles.toeTopCenterRightLarge]} />
              <View style={[styles.toeLarge, styles.toeTopRightLarge]} />
            </View>
          </View>

          <Text style={[Typography.h2, styles.title]}>
            Welcome to Warmpawz
          </Text>
          <Text style={[Typography.bodySmall, styles.subtitle]}>
            Your 360° pet care companion
          </Text>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <Text style={[Typography.bodySmall, styles.label]}>
              Mobile Number
            </Text>
            <View style={styles.phoneInputContainer}>
              <View style={styles.countryCode}>
                <Text style={[Typography.body, { color: BrandColors.neutral.gray900 }]}>
                  +91
                </Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                value={phoneNumber}
                onChangeText={(text) => setPhoneNumber(text.replace(/[^0-9]/g, '').slice(0, 10))}
                keyboardType="phone-pad"
                maxLength={10}
                placeholder="9876543210"
                placeholderTextColor={BrandColors.neutral.gray400}
                autoFocus
              />
            </View>
            <Text style={[Typography.bodyTiny, styles.helperText]}>
              🔐 UAT Mode: OTP is 123456 for all numbers
            </Text>

            <BrandedButton
              title={loading ? 'Sending code...' : 'Continue'}
              onPress={handleSendCode}
              disabled={loading || phoneNumber.length !== 10}
              fullWidth
            />

            {/* Referral Code Section - Matching web app */}
            <View style={styles.referralSection}>
              {!showReferralInput ? (
                <TouchableOpacity
                  style={styles.referralToggle}
                  onPress={() => setShowReferralInput(true)}
                >
                  <Text style={styles.referralToggleText}>
                    + Have a referral code?
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.referralInputContainer}>
                  <View style={styles.referralHeader}>
                    <Text style={[Typography.bodySmall, styles.label]}>
                      Referral Code (Optional)
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setShowReferralInput(false);
                        setReferralCode('');
                      }}
                    >
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.referralInput}
                    value={referralCode}
                    onChangeText={(text) => setReferralCode(text.toUpperCase().slice(0, 20))}
                    placeholder="Enter referral code"
                    placeholderTextColor={BrandColors.neutral.gray400}
                    autoCapitalize="characters"
                    maxLength={20}
                  />
                  {referralCode ? (
                    <View style={styles.referralSuccess}>
                      <Text style={styles.referralSuccessText}>
                        ✓ You'll earn bonus points after signup!
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          </View>

          <Text style={[Typography.bodyTiny, styles.legalText]}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.base,
  },
  backButtonText: {
    ...Typography.bodySmall,
    color: BrandColors.neutral.gray700,
  },
  logoContainer: {
    width: 80,
    height: 80,
    marginBottom: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainerLarge: {
    width: 120,
    height: 120,
    marginBottom: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pawLogo: {
    width: 80,
    height: 80,
    position: 'relative',
  },
  pawLogoLarge: {
    width: 120,
    height: 120,
    position: 'relative',
  },
  pawPad: {
    position: 'absolute',
    width: 44,
    height: 52,
    borderRadius: 22,
    backgroundColor: BrandColors.neutral.black,
    bottom: 0,
    left: '50%',
    marginLeft: -22,
  },
  pawPadLarge: {
    position: 'absolute',
    width: 66,  // 44 * 1.5 (50% increase)
    height: 78, // 52 * 1.5 (50% increase)
    borderRadius: 33, // 22 * 1.5
    backgroundColor: BrandColors.neutral.black,
    bottom: 0,
    left: '50%',
    marginLeft: -33, // -22 * 1.5
  },
  heart: {
    position: 'absolute',
    width: 16,
    height: 16,
    backgroundColor: BrandColors.primary.orange,
    borderRadius: 8,
    bottom: 20,
    left: '50%',
    marginLeft: -8,
    transform: [{ rotate: '45deg' }],
  },
  heartLarge: {
    position: 'absolute',
    width: 24,  // 16 * 1.5 (50% increase)
    height: 24, // 16 * 1.5 (50% increase)
    backgroundColor: BrandColors.primary.orange,
    borderRadius: 12, // 8 * 1.5
    bottom: 30, // 20 * 1.5
    left: '50%',
    marginLeft: -12, // -8 * 1.5
    transform: [{ rotate: '45deg' }],
  },
  toe: {
    position: 'absolute',
    width: 20,
    height: 28,
    borderRadius: 10,
    backgroundColor: BrandColors.neutral.black,
  },
  toeLarge: {
    position: 'absolute',
    width: 30,  // 20 * 1.5 (50% increase)
    height: 42, // 28 * 1.5 (50% increase)
    borderRadius: 15, // 10 * 1.5
    backgroundColor: BrandColors.neutral.black,
  },
  toeTopLeft: {
    top: 10,
    left: 10,
    transform: [{ rotate: '-15deg' }],
  },
  toeTopLeftLarge: {
    top: 15,  // 10 * 1.5 (50% increase)
    left: 15, // 10 * 1.5 (50% increase)
    transform: [{ rotate: '-15deg' }],
  },
  toeTopCenterLeft: {
    top: 0,
    left: 20,
    transform: [{ rotate: '-5deg' }],
  },
  toeTopCenterLeftLarge: {
    top: 0,
    left: 30, // 20 * 1.5 (50% increase)
    transform: [{ rotate: '-5deg' }],
  },
  toeTopCenterRight: {
    top: 0,
    right: 20,
    transform: [{ rotate: '5deg' }],
  },
  toeTopCenterRightLarge: {
    top: 0,
    right: 30, // 20 * 1.5 (50% increase)
    transform: [{ rotate: '5deg' }],
  },
  toeTopRight: {
    top: 10,
    right: 10,
    transform: [{ rotate: '15deg' }],
  },
  toeTopRightLarge: {
    top: 15,  // 10 * 1.5 (50% increase)
    right: 15, // 10 * 1.5 (50% increase)
    transform: [{ rotate: '15deg' }],
  },
  title: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    color: BrandColors.neutral.gray600,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  form: {
    width: '100%',
    maxWidth: 400,
  },
  label: {
    color: BrandColors.neutral.gray700,
    marginBottom: Spacing.sm,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  countryCode: {
    backgroundColor: BrandColors.neutral.gray100,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray300,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    justifyContent: 'center',
  },
  phoneInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray300,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.base,
    ...Typography.body,
    color: BrandColors.neutral.gray900,
  },
  otpInput: {
    height: 56,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray300,
    borderRadius: BorderRadius.sm,
    ...Typography.h2,
    letterSpacing: 8,
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.lg,
  },
  helperText: {
    color: BrandColors.neutral.gray500,
    marginTop: Spacing.xs,
    marginBottom: Spacing.base,
  },
  errorContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.lg,
  },
  errorText: {
    ...Typography.bodySmall,
    color: BrandColors.semantic.error,
  },
  resendButton: {
    marginTop: Spacing.base,
    alignItems: 'center',
  },
  resendText: {
    ...Typography.bodySmall,
    color: BrandColors.primary.orange,
  },
  referralSection: {
    marginTop: Spacing.lg,
    width: '100%',
  },
  referralToggle: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  referralToggleText: {
    ...Typography.bodySmall,
    color: BrandColors.primary.orange,
  },
  referralInputContainer: {
    width: '100%',
  },
  referralHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  cancelText: {
    ...Typography.bodyTiny,
    color: BrandColors.neutral.gray500,
  },
  referralInput: {
    height: 48,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray300,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.base,
    ...Typography.body,
    color: BrandColors.neutral.gray900,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  referralSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  referralSuccessText: {
    ...Typography.bodyTiny,
    color: BrandColors.semantic.success,
  },
  legalText: {
    color: BrandColors.neutral.gray400,
    textAlign: 'center',
    marginTop: Spacing.xl,
    maxWidth: 300,
  },
});
