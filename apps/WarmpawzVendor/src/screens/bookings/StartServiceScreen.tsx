/**
 * Start Service Screen
 * Start service session with optional OTP
 * Batch 1 - Screen 5
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { BookingActionsApi, VendorBookingActionsApi } from '../../services/api';

interface StartServiceScreenProps {
  bookingId: string;
  vendorId: string;
  bookingData?: any;
  onBack?: () => void;
  onComplete?: (booking: any) => void;
}

export function StartServiceScreen({
  bookingId,
  vendorId,
  bookingData,
  onBack,
  onComplete,
}: StartServiceScreenProps) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const requiresOTP = bookingData?.requiresStartOTP || bookingData?.startOTP;

  const handleStart = async () => {
    if (requiresOTP && !otp.trim()) {
      Alert.alert('Error', 'Please enter the START OTP');
      return;
    }

    setLoading(true);
    try {
      let response;
      
      // Try start-session endpoint first (for walker services)
      if (bookingData?.serviceType === 'walking' || bookingData?.serviceType === 'walker') {
        response = await BookingActionsApi.startSession(bookingId, undefined, otp);
      } else {
        // Use start endpoint for other services
        response = await BookingActionsApi.startService(bookingId, undefined, otp);
      }

      if (response.success || response.booking || response.startTime) {
        Alert.alert('Success', 'Service started successfully!', [
          {
            text: 'OK',
            onPress: () => {
              if (onComplete) {
                onComplete(response.booking || response);
              }
            },
          },
        ]);
      } else {
        Alert.alert('Error', response.error || 'Failed to start service');
      }
    } catch (error: any) {
      console.error('Error starting service:', error);
      Alert.alert('Error', error.message || 'Failed to start service. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Start Service</Text>
        <Text style={styles.subtitle}>
          {requiresOTP ? 'Enter START OTP to begin service' : 'Start the service session'}
        </Text>
      </View>

      <View style={styles.content}>
        {bookingData && (
          <View style={styles.bookingInfo}>
            <Text style={styles.bookingId}>Booking ID: {bookingId}</Text>
            {bookingData.customerName && (
              <Text style={styles.customerName}>Customer: {bookingData.customerName}</Text>
            )}
            {bookingData.serviceName && (
              <Text style={styles.serviceName}>Service: {bookingData.serviceName}</Text>
            )}
          </View>
        )}

        {requiresOTP ? (
          <View style={styles.otpSection}>
            <Text style={styles.otpLabel}>
              Enter START OTP from customer
            </Text>
            <TextInput
              style={styles.otpInput}
              value={otp}
              onChangeText={setOtp}
              placeholder="Enter START OTP"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <Text style={styles.otpHint}>
              Ask the customer for the 6-digit START OTP code
            </Text>
          </View>
        ) : (
          <View style={styles.noOtpSection}>
            <Text style={styles.noOtpText}>
              This service does not require START OTP.
            </Text>
            <Text style={styles.noOtpSubtext}>
              You can start the service directly.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.startButton, (loading || (requiresOTP && !otp.trim())) && styles.startButtonDisabled]}
          onPress={handleStart}
          disabled={loading || (requiresOTP && !otp.trim())}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.startButtonText}>
              {requiresOTP ? 'Start with OTP' : 'Start Service'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginBottom: spacing.sm,
  },
  backButtonText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  title: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  bookingInfo: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  bookingId: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  customerName: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
  },
  serviceName: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  otpSection: {
    marginBottom: spacing.lg,
  },
  otpLabel: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  otpInput: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    fontSize: typography.fontSizes['2xl'],
    fontWeight: typography.fontWeights.bold,
    textAlign: 'center',
    letterSpacing: spacing.md,
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
  },
  otpHint: {
    fontSize: typography.fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  noOtpSection: {
    backgroundColor: colors.primary.50,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  noOtpText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  noOtpSubtext: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  startButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  startButtonDisabled: {
    opacity: 0.5,
  },
  startButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.white,
  },
});

