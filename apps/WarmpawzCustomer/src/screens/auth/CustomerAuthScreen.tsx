/**
 * Customer Authentication Screen
 * Redesigned to match design reference with orange/white split layout
 * Identical functionality to web app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Linking,
  Dimensions,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CustomerApi, ApiService } from '../../services/api';

const { width, height } = Dimensions.get('window');

interface CustomerAuthScreenProps {
  onAuthSuccess: (session: any) => void;
}

export function CustomerAuthScreen({ onAuthSuccess }: CustomerAuthScreenProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showReferralInput, setShowReferralInput] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setError('');
      setLoading(false);
    };
  }, []);

  // Resend timer
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

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

      const data = await CustomerApi.generateOtp(cleanPhone);
      
      if (data.uatMode) {
        Alert.alert('UAT Testing Mode', 'OTP: 123456');
      } else {
        Alert.alert('Success', 'OTP sent to your phone');
      }
      
      setShowOtpScreen(true);
      setResendTimer(60);
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
      
      const data = await CustomerApi.verifyOtp(cleanPhone, otpCode, referralCode || undefined);
      if (referralCode?.trim()) {
        await AsyncStorage.setItem('pendingReferralCode', referralCode.trim().toUpperCase());
      }
      
      // Save session token
      if (data.sessionToken) {
        await ApiService.saveSessionToken(data.sessionToken);
      }
      
      const hasCompletedOnboarding = data.customer.onboardingComplete;
      const hasPets = data.customer.petIds && data.customer.petIds.length > 0;
      
      onAuthSuccess({
        phone: cleanPhone,
        customerId: data.customer.id,
        customer: data.customer,
        sessionToken: data.sessionToken,
        verified: true,
        isNewUser: data.isNewUser,
        hasCompletedOnboarding,
        hasPets
      });
      
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP');
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendTimer > 0) return;
    
    try {
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
      await CustomerApi.generateOtp(cleanPhone);
      setResendTimer(60);
      Alert.alert('Success', 'OTP resent to your phone');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to resend OTP');
    }
  };

  const formatPhoneNumber = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length <= 10) {
      if (cleaned.length > 0) {
        return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
      }
      return '+91 ';
    }
    return phoneNumber;
  };

  // OTP Verification Screen
  if (showOtpScreen) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Orange Top Section (2/3) */}
        <View style={styles.orangeSection}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../assets/images/logo.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.verifyTitle}>Verify Your Number</Text>
        </View>

        {/* White Bottom Card (1/3) */}
        <View style={styles.whiteCard}>
          <ScrollView 
            contentContainerStyle={styles.whiteCardContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.otpInstruction}>
              Enter the OTP sent to{'\n'}
              <Text style={styles.phoneNumberText}>+91 {phoneNumber}</Text>
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Verification Code</Text>
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

            {showReferralInput && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Referral Code (Optional)</Text>
                <TextInput
                  style={styles.referralInput}
                  placeholder="Enter referral code"
                  value={referralCode}
                  onChangeText={setReferralCode}
                  autoCapitalize="characters"
                />
              </View>
            )}

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.verifyButton, (loading || otpCode.length !== 6) && styles.buttonDisabled]}
              onPress={handleVerifyOtp}
              disabled={loading || otpCode.length !== 6}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.verifyButtonText}>Verify & Continue</Text>
              )}
            </TouchableOpacity>

            <View style={styles.otpLinks}>
              <TouchableOpacity
                onPress={handleResendCode}
                disabled={resendTimer > 0}
              >
                <Text style={[styles.linkText, styles.blueLink, resendTimer > 0 && styles.linkDisabled]}>
                  {resendTimer > 0 ? `Resend Code (${resendTimer}s)` : 'Resend Code'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.linkSeparator}> • </Text>
              <TouchableOpacity onPress={() => Alert.alert('Help', 'Contact support for assistance')}>
                <Text style={[styles.linkText, styles.orangeLink]}>Get Help</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => {
                setShowOtpScreen(false);
                setOtpCode('');
                setError('');
              }}
              style={styles.changeNumberLink}
            >
              <Text style={[styles.linkText, styles.blueLink]}>← Change phone number</Text>
            </TouchableOpacity>

            {!showReferralInput && (
              <TouchableOpacity
                onPress={() => setShowReferralInput(true)}
                style={styles.referralLink}
              >
                <Text style={[styles.linkText, styles.orangeLink]}>Have a referral code?</Text>
              </TouchableOpacity>
            )}

            <View style={styles.appInfo}>
              <Text style={styles.appInfoText}>WARMPAWS Provider v2.1.0</Text>
              <Text style={styles.copyrightText}>© 2025 WARMPAWS Inc. All rights reserved</Text>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Phone Number Input Screen
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Orange Top Section (2/3) */}
      <View style={styles.orangeSection}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/images/logo.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.welcomeText}>Welcome to</Text>
        <Text style={styles.welcomeTitle}>WARMPAWZ!</Text>
      </View>

      {/* White Bottom Card (1/3) */}
      <View style={styles.whiteCard}>
        <ScrollView 
          contentContainerStyle={styles.whiteCardContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.introText}>
            Join our community of pet lovers and access{'\n'}
            the best care for your furry friends
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={styles.phoneInput}
              placeholder="+91 74493 38923"
              value={formatPhoneNumber(phoneNumber)}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9]/g, '');
                if (cleaned.length <= 10) {
                  setPhoneNumber(cleaned);
                }
              }}
              keyboardType="phone-pad"
              maxLength={15}
            />
          </View>

          {showReferralInput && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Referral Code (Optional)</Text>
              <TextInput
                style={styles.referralInput}
                placeholder="Enter referral code"
                value={referralCode}
                onChangeText={setReferralCode}
                autoCapitalize="characters"
              />
            </View>
          )}

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.sendCodeButton, (loading || phoneNumber.length !== 10) && styles.buttonDisabled]}
            onPress={handleSendCode}
            disabled={loading || phoneNumber.length !== 10}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.sendCodeButtonText}>Send Verification Code</Text>
            )}
          </TouchableOpacity>

          <View style={styles.legalLinks}>
            <Text style={styles.legalText}>
              By continuing, you agree to our{' '}
              <Text 
                style={styles.legalLink}
                onPress={() => Linking.openURL('https://warmpawz.com/terms')}
              >
                Terms of Service
              </Text>
              {' '}and{' '}
              <Text 
                style={styles.legalLink}
                onPress={() => Linking.openURL('https://warmpawz.com/privacy')}
              >
                Privacy Policy
              </Text>
            </Text>
          </View>

          {!showReferralInput && (
            <TouchableOpacity
              onPress={() => setShowReferralInput(true)}
              style={styles.referralLink}
            >
              <Text style={[styles.linkText, styles.orangeLink]}>Have a referral code?</Text>
            </TouchableOpacity>
          )}

          <View style={styles.appInfo}>
            <TouchableOpacity
              onPress={() => Linking.openURL('https://warmpawz.com/help')}
              accessibilityRole="link"
              accessibilityLabel="Need help? Open help center"
            >
              <Text style={[styles.helpText, styles.orangeLink]}>Need Help?</Text>
            </TouchableOpacity>
            <Text style={styles.appInfoText}>WARMPAWS Provider v2.1.0</Text>
            <Text style={styles.copyrightText}>© 2025 WARMPAWS Inc. All rights reserved</Text>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  // Orange Section (Top 2/3)
  orangeSection: {
    flex: 2,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.xl * 2,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoImage: {
    width: 120,
    height: 120,
  },
  welcomeText: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  welcomeTitle: {
    fontSize: typography.fontSizes['3xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  verifyTitle: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginTop: spacing.lg,
  },
  // White Card (Bottom 1/3)
  whiteCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl * 2,
    borderTopRightRadius: borderRadius.xl * 2,
    paddingTop: spacing.lg,
  },
  whiteCardContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  introText: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  otpInstruction: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  phoneNumberText: {
    fontWeight: typography.fontWeights.semibold,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  phoneInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSizes.md,
    color: colors.text,
  },
  otpInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSizes.xl,
    textAlign: 'center',
    color: colors.text,
    letterSpacing: 4,
  },
  referralInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.fontSizes.md,
    color: colors.text,
  },
  sendCodeButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  sendCodeButtonText: {
    color: colors.white,
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
  },
  verifyButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  verifyButtonText: {
    color: colors.white,
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  errorContainer: {
    backgroundColor: '#fee',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.fontSizes.sm,
    textAlign: 'center',
  },
  legalLinks: {
    marginBottom: spacing.md,
  },
  legalText: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 20,
  },
  legalLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
    fontWeight: typography.fontWeights.semibold,
  },
  otpLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  linkText: {
    fontSize: typography.fontSizes.sm,
  },
  blueLink: {
    color: '#3b82f6',
    textDecorationLine: 'underline',
  },
  orangeLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  linkDisabled: {
    opacity: 0.5,
  },
  linkSeparator: {
    color: colors.textSecondary,
    fontSize: typography.fontSizes.sm,
  },
  changeNumberLink: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  referralLink: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  appInfo: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  helpText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  appInfoText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
  },
  copyrightText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
});
