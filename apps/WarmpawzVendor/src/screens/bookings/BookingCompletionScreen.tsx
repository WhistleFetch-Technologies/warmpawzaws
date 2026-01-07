/**
 * Booking Completion Screen
 * Complete booking with OTP verification
 * Batch 1 - Screen 1
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { VendorBookingActionsApi, AppointmentDetailApi } from '../../services/api';

interface BookingCompletionScreenProps {
  bookingId: string;
  vendorId: string;
  bookingData?: any;
  onComplete?: (booking: any) => void;
  onBack?: () => void;
}

export function BookingCompletionScreen({
  bookingId,
  vendorId,
  bookingData,
  onComplete,
  onBack,
}: BookingCompletionScreenProps) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<any>(bookingData);

  useEffect(() => {
    if (!booking && bookingId) {
      loadBookingDetails();
    }
  }, [bookingId]);

  const loadBookingDetails = async () => {
    try {
      setLoading(true);
      const response = await AppointmentDetailApi.getBookingDetails(bookingId);
      setBooking(response.booking || response);
    } catch (error) {
      console.error('Error loading booking:', error);
      Alert.alert('Error', 'Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!otp.trim()) {
      Alert.alert('Error', 'Please enter the OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await VendorBookingActionsApi.completeBooking(vendorId, bookingId, otp);
      
      if (response.success) {
        Alert.alert('Success', 'Booking completed successfully!', [
          {
            text: 'OK',
            onPress: () => {
              if (onComplete) {
                onComplete(response.booking);
              }
            },
          },
        ]);
      } else {
        Alert.alert('Error', response.error || 'Failed to complete booking');
      }
    } catch (error: any) {
      console.error('Error completing booking:', error);
      Alert.alert('Error', error.message || 'Failed to complete booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const requiresOTP = booking?.metadata?.requiresOTP !== false;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Complete Booking</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {booking && (
          <View style={styles.bookingInfo}>
            <Text style={styles.bookingId}>Booking ID: {bookingId}</Text>
            {booking.customerName && (
              <Text style={styles.customerName}>Customer: {booking.customerName}</Text>
            )}
            {booking.serviceName && (
              <Text style={styles.serviceName}>Service: {booking.serviceName}</Text>
            )}
            {booking.amount && (
              <Text style={styles.amount}>Amount: ₹{booking.amount}</Text>
            )}
          </View>
        )}

        {requiresOTP ? (
          <View style={styles.otpSection}>
            <Text style={styles.otpLabel}>
              Enter OTP from customer to complete booking
            </Text>
            <TextInput
              style={styles.otpInput}
              value={otp}
              onChangeText={setOtp}
              placeholder="Enter OTP"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <Text style={styles.otpHint}>
              Ask the customer for the 6-digit OTP code
            </Text>
          </View>
        ) : (
          <View style={styles.noOtpSection}>
            <Text style={styles.noOtpText}>
              This booking does not require OTP verification.
            </Text>
            <Text style={styles.noOtpSubtext}>
              You can complete it directly.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.completeButton, loading && styles.completeButtonDisabled]}
          onPress={handleComplete}
          disabled={loading || (requiresOTP && !otp.trim())}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.completeButtonText}>
              {requiresOTP ? 'Complete with OTP' : 'Complete Booking'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
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
    marginBottom: spacing.xs / 2,
  },
  amount: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
    marginTop: spacing.xs,
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
    backgroundColor: colors.gradientOrange50,
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
  completeButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  completeButtonDisabled: {
    opacity: 0.5,
  },
  completeButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.white,
  },
});

