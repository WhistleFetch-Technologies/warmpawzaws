/**
 * Login Screen - Vendor Mobile App
 * Matches web app VendorAuth component exactly
 * Includes: Phone OTP, Staff/Vendor detection, All web features
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
  ScrollView,
  StatusBar,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, publicAnonKey } from '../../config/api';
import { authService } from '../../services/authService';

interface LoginScreenProps {
  navigation?: any;
  onAuthSuccess?: (session: any) => void;
}

export default function LoginScreen({ navigation, onAuthSuccess }: LoginScreenProps) {
  const { login } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendCode = async () => {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    
    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await authService.sendOTP(cleanPhone);
      
      if (response.uatMode) {
        Alert.alert('UAT Testing Mode', 'OTP: 123456', [{ text: 'OK' }]);
      } else {
        Alert.alert('Success', 'OTP sent to your phone');
      }
      
      setShowOtpScreen(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
      console.error('Send code error:', err);
    } finally {
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
      const response = await authService.verifyOTP(cleanPhone, otpCode);

      if (response.success && response.session) {
        await login(response.session);
        
        if (onAuthSuccess) {
          onAuthSuccess(response.session);
        }

        // Navigation will be handled by App.tsx based on vendor status
      } else {
        throw new Error(response.error || 'Login failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify code');
      console.error('Verify OTP error:', err);
    } finally {
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
            {/* Logo */}
            <View style={styles.logoContainer}>
              <View style={styles.pawLogo}>
                <View style={styles.pawPad} />
                <View style={styles.heart} />
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
          {/* Logo - Large */}
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
            Vendor Portal - Manage your pet care business
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
            {__DEV__ && (
              <Text style={[Typography.bodyTiny, styles.helperText]}>
                🔐 UAT Mode: OTP is 123456 for all numbers
              </Text>
            )}

            <BrandedButton
              title={loading ? 'Sending code...' : 'Continue'}
              onPress={handleSendCode}
              disabled={loading || phoneNumber.length !== 10}
              fullWidth
            />
          </View>
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
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: Spacing.base,
    marginTop: Spacing.base,
  },
  backButtonText: {
    ...Typography.body,
    color: BrandColors.primary.orange,
  },
  logoContainer: {
    width: 64,
    height: 64,
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
    width: 60,
    height: 60,
    position: 'relative',
  },
  pawLogoLarge: {
    width: 120,
    height: 120,
    position: 'relative',
  },
  pawPad: {
    position: 'absolute',
    width: 33,
    height: 39,
    borderRadius: 16.5,
    backgroundColor: BrandColors.neutral.black,
    bottom: 0,
    left: '50%',
    marginLeft: -16.5,
  },
  pawPadLarge: {
    position: 'absolute',
    width: 66,
    height: 78,
    borderRadius: 33,
    backgroundColor: BrandColors.neutral.black,
    bottom: 0,
    left: '50%',
    marginLeft: -33,
  },
  heart: {
    position: 'absolute',
    width: 12,
    height: 12,
    backgroundColor: BrandColors.primary.orange,
    borderRadius: 6,
    bottom: 15,
    left: '50%',
    marginLeft: -6,
    transform: [{ rotate: '45deg' }],
  },
  heartLarge: {
    position: 'absolute',
    width: 24,
    height: 24,
    backgroundColor: BrandColors.primary.orange,
    borderRadius: 12,
    bottom: 30,
    left: '50%',
    marginLeft: -12,
    transform: [{ rotate: '45deg' }],
  },
  toe: {
    position: 'absolute',
    width: 15,
    height: 21,
    borderRadius: 7.5,
    backgroundColor: BrandColors.neutral.black,
  },
  toeLarge: {
    position: 'absolute',
    width: 30,
    height: 42,
    borderRadius: 15,
    backgroundColor: BrandColors.neutral.black,
  },
  toeTopLeft: {
    top: 7.5,
    left: 7.5,
    transform: [{ rotate: '-15deg' }],
  },
  toeTopLeftLarge: {
    top: 15,
    left: 15,
    transform: [{ rotate: '-15deg' }],
  },
  toeTopCenterLeft: {
    top: 0,
    left: 15,
    transform: [{ rotate: '-5deg' }],
  },
  toeTopCenterLeftLarge: {
    top: 0,
    left: 30,
    transform: [{ rotate: '-5deg' }],
  },
  toeTopCenterRight: {
    top: 0,
    right: 15,
    transform: [{ rotate: '5deg' }],
  },
  toeTopCenterRightLarge: {
    top: 0,
    right: 30,
    transform: [{ rotate: '5deg' }],
  },
  toeTopRight: {
    top: 7.5,
    right: 7.5,
    transform: [{ rotate: '15deg' }],
  },
  toeTopRightLarge: {
    top: 15,
    right: 15,
    transform: [{ rotate: '15deg' }],
  },
  title: {
    color: BrandColors.neutral.gray900,
    textAlign: 'center',
    marginBottom: Spacing.sm,
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
    fontWeight: '600',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.base,
  },
  countryCode: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
    backgroundColor: BrandColors.neutral.gray100,
    borderTopLeftRadius: BorderRadius.sm,
    borderBottomLeftRadius: BorderRadius.sm,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: BrandColors.neutral.gray300,
    justifyContent: 'center',
  },
  phoneInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray300,
    borderTopRightRadius: BorderRadius.sm,
    borderBottomRightRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.base,
    ...Typography.body,
    color: BrandColors.neutral.gray900,
  },
  otpInput: {
    height: 56,
    borderWidth: 2,
    borderColor: BrandColors.primary.orange,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
    ...Typography.h2,
    color: BrandColors.neutral.gray900,
    letterSpacing: 8,
  },
  helperText: {
    color: BrandColors.neutral.gray500,
    textAlign: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.base,
  },
  errorContainer: {
    backgroundColor: BrandColors.semantic.error + '20',
    padding: Spacing.base,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.base,
    width: '100%',
  },
  errorText: {
    ...Typography.bodySmall,
    color: BrandColors.semantic.error,
    textAlign: 'center',
  },
  resendButton: {
    marginTop: Spacing.base,
    alignSelf: 'center',
  },
  resendText: {
    ...Typography.body,
    color: BrandColors.primary.orange,
  },
});

