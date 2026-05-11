/**
 * Vendor Authentication Screen
 * Migrated from web app with identical functionality
 * Includes staff login support
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { VendorApi, ApiService } from '../../services/api';
import { saveVendorLoginResponse } from '../../services/auth-session';
import { GradientBackground, BrandedCard, WarmPawzLogo } from '../../components/branded';

interface VendorAuthScreenProps {
  onAuthSuccess: (session: any) => void;
}

export function VendorAuthScreen({ onAuthSuccess }: VendorAuthScreenProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setError('');
      setLoading(false);
    };
  }, []);

  const handleSendCode = async () => {
    setLoading(true);
    setError('');

    try {
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
      
      if (cleanPhone.length !== 10) {
        setError('Please enter a valid 10-digit phone number');
        setLoading(false);
        return;
      }

      // Send OTP
      const data = await VendorApi.generateOtp(cleanPhone);
      
      if (data.uatMode) {
        Alert.alert('UAT Testing Mode', 'OTP: 123456');
      } else {
        Alert.alert('Success', 'OTP sent to your phone');
      }
      
      setShowOtpScreen(true);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    setError('');

    try {
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
      
      // First check if this is a staff member
      try {
        const staffCheckData = await ApiService.post('/staff/auth/check-phone', { phone: cleanPhone });

        // If staff member, log them in as staff
        if (staffCheckData && staffCheckData.exists && staffCheckData.staff) {
          const staffData = await ApiService.post('/staff/auth/login', { phone: cleanPhone });

          if (staffData.success && staffData.staff) {
            // Persist the full token bundle (90-day refresh window) via the
            // centralized session manager, then keep the legacy single-token
            // slot in sync for any code still reading it directly.
            await saveVendorLoginResponse(staffData, {
              phone: cleanPhone,
              isNewLogin: true,
              staffIdOverride: staffData?.staff?.id || staffData?.staff?.staffId,
              roleOverride: staffData?.staff?.role || 'staff',
            });
            if (staffData.sessionToken) {
              await ApiService.saveSessionToken(staffData.sessionToken);
            }

            onAuthSuccess({
              phone: cleanPhone,
              user: { isStaff: true },
              staff: staffData.staff,
              isStaffLogin: true
            });
            setLoading(false);
            return;
          }
        }
      } catch (staffError) {
        // Not a staff member or error, continue with vendor login
        console.log('Not a staff member, proceeding with vendor login');
      }

      // Not staff, proceed with vendor login
      const data = await ApiService.post('/auth/login', {
        phone: cleanPhone,
        portal: 'vendor'
      });

      const profile = data?.data?.profile || data?.profile;
      const user = data?.data?.user || data?.user;
      const vendorIdFromProfile =
        profile?.id || profile?.vendorId || profile?.vendor_id || user?.vendorId || user?.id;

      await saveVendorLoginResponse(data, {
        phone: cleanPhone,
        isNewLogin: true,
        vendorIdOverride: vendorIdFromProfile,
      });

      // Keep the legacy single-token slot in sync for anything still reading
      // it directly. saveVendorLoginResponse already mirrors this, but older
      // shapes (data.session.accessToken) need an explicit copy.
      const legacyToken =
        data?.session?.accessToken ||
        data?.data?.token?.access_token ||
        data?.token?.access_token;
      if (legacyToken) {
        await ApiService.saveSessionToken(legacyToken);
      }

      if (user && profile) {
        // Existing vendor
        onAuthSuccess({
          phone: cleanPhone,
          user,
          profile,
          state: data?.data?.state || data?.state,
        });
      } else {
        // New vendor - will go to role selection
        onAuthSuccess({
          phone: cleanPhone,
          isNewUser: true
        });
      }

      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP');
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    await handleSendCode();
  };

  const handleChangePhone = () => {
    setShowOtpScreen(false);
    setOtpCode('');
    setError('');
  };

  // OTP Verification Screen
  if (showOtpScreen) {
    const formattedPhone = phoneNumber.length === 10 
      ? `+91 ${phoneNumber.slice(0, 5)} ${phoneNumber.slice(5)}`
      : phoneNumber;

    return (
      <GradientBackground variant="orange">
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView contentContainerStyle={styles.otpScrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.otpTopSection}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleChangePhone}
              >
                <Text style={styles.backButtonText}>← Change phone number</Text>
              </TouchableOpacity>

              <WarmPawzLogo size="large" showText={false} />
              <Text style={styles.otpTitle}>Verify Your Number</Text>
            </View>

            <BrandedCard>
              <Text style={styles.otpSubtitle}>
                Enter the OTP sent to
              </Text>
              <Text style={styles.phoneNumberText}>{formattedPhone}</Text>

              {error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.otpInputContainer}>
                <Text style={styles.otpLabel}>Verification Code</Text>
                <TextInput
                  style={styles.otpInput}
                  placeholder="Enter 6-digit code"
                  value={otpCode}
                  onChangeText={setOtpCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={[styles.button, (loading || otpCode.length !== 6) && styles.buttonDisabled]}
                onPress={handleVerifyOtp}
                disabled={loading || otpCode.length !== 6}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Verify & Continue</Text>
                )}
              </TouchableOpacity>

              <View style={styles.otpLinksContainer}>
                <TouchableOpacity onPress={handleResendCode}>
                  <Text style={styles.linkText}>Resend Code</Text>
                </TouchableOpacity>
                <Text style={styles.linkSeparator}> • </Text>
                <TouchableOpacity onPress={() => Linking.openURL('https://warmpawz.com/help')}>
                  <Text style={styles.linkText}>Trouble with verification? Get Help</Text>
                </TouchableOpacity>
              </View>
            </BrandedCard>
          </ScrollView>
        </KeyboardAvoidingView>
      </GradientBackground>
    );
  }

  // Phone Number Input Screen
  return (
    <GradientBackground variant="orange">
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.topSection}>
            <WarmPawzLogo size="large" showText={true} />
            <Text style={styles.tagline}>
              Join our community of professional pet care providers
            </Text>
          </View>

          <BrandedCard>
            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.phoneInput}
                placeholder="+91 74493 38923"
                value={phoneNumber}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9]/g, '');
                  if (cleaned.length <= 10) {
                    setPhoneNumber(cleaned);
                  }
                }}
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, (loading || phoneNumber.length !== 10) && styles.buttonDisabled]}
              onPress={handleSendCode}
              disabled={loading || phoneNumber.length !== 10}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Send Verification Code</Text>
              )}
            </TouchableOpacity>

            <View style={styles.termsContainer}>
              <Text style={styles.termsText}>
                By continuing, you agree to our{' '}
                <Text 
                  style={styles.termsLink}
                  onPress={() => Linking.openURL('https://warmpawz.com/terms')}
                >
                  Terms of Service
                </Text>
                {' '}and{' '}
                <Text 
                  style={styles.termsLink}
                  onPress={() => Linking.openURL('https://warmpawz.com/privacy')}
                >
                  Privacy Policy
                </Text>
              </Text>
            </View>

            <View style={styles.signInContainer}>
              <Text style={styles.signInText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => setIsSignUp(false)}>
                <Text style={styles.signInLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </BrandedCard>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Need Help?</Text>
            <Text style={styles.footerVersion}>WARMPAWS Provider v2.1.0</Text>
            <Text style={styles.footerCopyright}>© 2025 WARMPAWS Inc. All rights reserved</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: spacing.xxl,
  },
  otpScrollContent: {
    flexGrow: 1,
    paddingTop: spacing.xl,
  },
  topSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    alignItems: 'center',
    paddingBottom: spacing.xxl,
  },
  tagline: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  otpTopSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    alignItems: 'center',
    paddingBottom: spacing.xl,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: spacing.lg,
  },
  backButtonText: {
    fontSize: typography.fontSizes.md,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  otpTitle: {
    fontSize: typography.fontSizes['3xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  otpSubtitle: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  phoneNumberText: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
    marginBottom: spacing.sm,
    fontWeight: typography.fontWeights.medium,
  },
  phoneInput: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    fontSize: typography.fontSizes.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  otpInputContainer: {
    marginBottom: spacing.lg,
  },
  otpLabel: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
    marginBottom: spacing.sm,
    fontWeight: typography.fontWeights.medium,
  },
  otpInput: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    fontSize: typography.fontSizes['2xl'],
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    letterSpacing: 8,
    fontWeight: typography.fontWeights.bold,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    marginBottom: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
  },
  errorContainer: {
    backgroundColor: '#fee',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.fontSizes.sm,
    textAlign: 'center',
  },
  otpLinksContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
  linkText: {
    fontSize: typography.fontSizes.md,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  linkSeparator: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  termsContainer: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  termsText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  termsLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  signInText: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
  },
  signInLink: {
    fontSize: typography.fontSizes.md,
    color: colors.primary,
    fontWeight: typography.fontWeights.semibold,
  },
  footer: {
    padding: spacing.lg,
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  footerText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  footerVersion: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  footerCopyright: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
  },
});

