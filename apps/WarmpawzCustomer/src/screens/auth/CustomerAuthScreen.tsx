/**
 * Customer Authentication Screen
 * Migrated from web app with identical functionality
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
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi, ApiService } from '../../services/api';

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

      const data = await CustomerApi.generateOtp(cleanPhone);
      
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
      
      const data = await CustomerApi.verifyOtp(cleanPhone, otpCode);
      
      // Apply referral code if provided
      if (referralCode && data.isNewUser) {
        try {
          await ApiService.post('/loyalty/referral/apply', {
            referralCode: referralCode,
            newUserId: data.customer.id,
            userType: 'customer'
          });
        } catch (refError) {
          console.error('Referral code error:', refError);
        }
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

  // OTP Verification Screen
  if (showOtpScreen) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
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

          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>🐾</Text>
            </View>
          </View>

          <Text style={styles.title}>Enter Verification Code</Text>
          <Text style={styles.subtitle}>
            We sent a code to {phoneNumber}
          </Text>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TextInput
            style={styles.otpInput}
            placeholder="Enter 6-digit code"
            value={otpCode}
            onChangeText={setOtpCode}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />

          {showReferralInput && (
            <TextInput
              style={styles.referralInput}
              placeholder="Referral Code (Optional)"
              value={referralCode}
              onChangeText={setReferralCode}
              autoCapitalize="characters"
            />
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleVerifyOtp}
            disabled={loading || otpCode.length !== 6}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Verify</Text>
            )}
          </TouchableOpacity>

          {!showReferralInput && (
            <TouchableOpacity
              onPress={() => setShowReferralInput(true)}
              style={styles.referralLink}
            >
              <Text style={styles.referralLinkText}>Have a referral code?</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Phone Number Input Screen
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>🐾</Text>
          </View>
        </View>

        <Text style={styles.title}>Welcome to Warmpawz</Text>
        <Text style={styles.subtitle}>
          Enter your phone number to get started
        </Text>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TextInput
          style={styles.phoneInput}
          placeholder="Enter 10-digit phone number"
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

        <TouchableOpacity
          style={[styles.button, (loading || phoneNumber.length !== 10) && styles.buttonDisabled]}
          onPress={handleSendCode}
          disabled={loading || phoneNumber.length !== 10}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send Code</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: spacing.lg,
  },
  backButtonText: {
    fontSize: typography.fontSizes.md,
    color: colors.primary,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 40,
  },
  title: {
    fontSize: typography.fontSizes['3xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  phoneInput: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    fontSize: typography.fontSizes.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  otpInput: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    fontSize: typography.fontSizes['2xl'],
    textAlign: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    letterSpacing: 8,
  },
  referralInput: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    fontSize: typography.fontSizes.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
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
  referralLink: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  referralLinkText: {
    color: colors.primary,
    fontSize: typography.fontSizes.sm,
  },
});

