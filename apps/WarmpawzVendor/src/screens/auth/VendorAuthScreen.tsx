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
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { VendorApi, ApiService } from '../../services/api';

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
            // Save session token
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
      
      // Save session token
      if (data.session?.accessToken) {
        await ApiService.saveSessionToken(data.session.accessToken);
      }
      
      if (data.user && data.profile) {
        // Existing vendor
        onAuthSuccess({
          phone: cleanPhone,
          user: data.user,
          profile: data.profile,
          state: data.state
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

          <TouchableOpacity
            style={[styles.button, (loading || otpCode.length !== 6) && styles.buttonDisabled]}
            onPress={handleVerifyOtp}
            disabled={loading || otpCode.length !== 6}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Verify</Text>
            )}
          </TouchableOpacity>
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

        <Text style={styles.title}>Vendor Portal</Text>
        <Text style={styles.subtitle}>
          Enter your phone number to continue
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
});

