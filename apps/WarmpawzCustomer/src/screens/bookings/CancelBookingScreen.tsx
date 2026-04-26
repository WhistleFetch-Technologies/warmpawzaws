/**
 * Cancel Booking Screen - Mobile
 * Allow customers to cancel their bookings with refund calculation
 * Identical functionality to web app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { OrangeBrandedScreenLayout } from '../../components/layout/OrangeBrandedScreenLayout';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

interface CancelBookingScreenProps {
  bookingId: string;
  phone: string;
  bookingData?: {
    date?: string;
    time?: string;
    price?: number;
    amount?: number;
  };
  onBack: () => void;
  onSuccess?: () => void;
}

interface RefundPreview {
  refundAmount: number;
  deductionAmount: number;
  refundPolicy: string;
  platformFeeApplies?: boolean;
}

export function CancelBookingScreen({
  bookingId,
  phone,
  bookingData,
  onBack,
  onSuccess,
}: CancelBookingScreenProps) {
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [refundPreview, setRefundPreview] = useState<RefundPreview | null>(
    null
  );
  const [booking, setBooking] = useState<any>(null);

  useEffect(() => {
    loadBookingAndRefund();
  }, [bookingId]);

  const loadBookingAndRefund = async () => {
    try {
      setLoading(true);
      const bookingResponse = await CustomerApi.getBookingDetails(bookingId);
      const bookingDetails = bookingResponse.booking || bookingResponse;
      setBooking(bookingDetails);

      const paidTotal =
        Number(bookingDetails?.total_amount ?? bookingDetails?.totalAmount ?? bookingData?.price ?? bookingData?.amount ?? 0) || 0;

      try {
        const calc = (await CustomerApi.calculateBookingRefund(bookingId)) as any;
        const refundBlock = calc?.refund ?? calc?.data?.refund;
        const refundAmount = Number(refundBlock?.refundAmount ?? refundBlock?.totalRefund ?? 0) || 0;
        const refundPct = Number(refundBlock?.refundPercentage ?? 0) || 0;
        const platformFeeApplies =
          refundBlock?.platformFeeApplies === true ||
          (typeof refundBlock?.platformFeeNonRefundable === 'number' && refundBlock.platformFeeNonRefundable > 0);
        const src = (refundBlock?.refundSource || refundBlock?.source || '') as string;
        const refundPolicy =
          refundAmount > 0
            ? `Estimated ${refundPct}% refund per policy${src ? ` (${String(src).replace(/_/g, ' ')})` : ''}.`
            : 'No refund under current policy for this booking.';

        setRefundPreview({
          refundAmount,
          deductionAmount: Math.max(0, paidTotal - refundAmount),
          refundPolicy,
          platformFeeApplies,
        });
      } catch {
        const price =
          paidTotal ||
          Number(bookingData?.price || bookingData?.amount || bookingDetails?.price || 0) ||
          0;
        const bookingDate = bookingData?.date || bookingDetails?.date || bookingDetails?.appointmentDate;
        if (bookingDate && price > 0) {
          const bookingDateTime = new Date(bookingDate);
          const now = new Date();
          const hoursUntilBooking = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
          let refundAmount = 0;
          let deductionAmount = 0;
          let refundPolicy = '';
          if (hoursUntilBooking > 24) {
            refundAmount = price;
            refundPolicy = 'Full refund as cancellation is 24+ hours before booking';
          } else if (hoursUntilBooking > 12) {
            refundAmount = price * 0.5;
            deductionAmount = price * 0.5;
            refundPolicy = '50% refund as cancellation is 12-24 hours before booking';
          } else {
            refundAmount = 0;
            deductionAmount = price;
            refundPolicy = 'No refund as cancellation is less than 12 hours before booking';
          }
          setRefundPreview({ refundAmount, deductionAmount, refundPolicy, platformFeeApplies: false });
        } else {
          setRefundPreview({
            refundAmount: 0,
            deductionAmount: price,
            refundPolicy: 'Refund policy not available',
            platformFeeApplies: false,
          });
        }
      }
    } catch (error) {
      console.error('Error loading booking:', error);
      Alert.alert('Error', 'Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancellationReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for cancellation');
      return;
    }

    Alert.alert(
      'Confirm Cancellation',
      refundPreview && refundPreview.refundAmount > 0
        ? `This booking will be cancelled. ₹${refundPreview.refundAmount} will be refunded.`
        : 'This booking will be cancelled. No refund will be issued.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setCancelling(true);
              await CustomerApi.cancelBooking(bookingId, cancellationReason);

              Alert.alert(
                'Booking Cancelled',
                refundPreview && refundPreview.refundAmount > 0
                  ? `Your booking has been cancelled. ₹${refundPreview.refundAmount} will be refunded within 5-7 business days.`
                  : 'Your booking has been cancelled.',
                [{ text: 'OK', onPress: () => onSuccess?.() || onBack() }]
              );
            } catch (error) {
              console.error('Error cancelling booking:', error);
              Alert.alert('Error', 'Failed to cancel booking. Please try again.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <OrangeBrandedScreenLayout title="Cancel Booking" onBack={onBack} bodyBackgroundColor={colors.white}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </OrangeBrandedScreenLayout>
    );
  }

  const price = bookingData?.price || bookingData?.amount || booking?.price || 0;

  return (
    <OrangeBrandedScreenLayout title="Cancel Booking" onBack={onBack} bodyBackgroundColor={colors.white}>
      <ScrollView style={styles.content}>
        {/* Booking Details */}
        <View style={styles.bookingDetailsCard}>
          <Text style={styles.bookingDetailsLabel}>Booking Details</Text>
          {(bookingData?.date || booking?.date) && (
            <Text style={styles.bookingDetailsText}>
              {formatDate(bookingData?.date || booking?.date)}
            </Text>
          )}
          {bookingData?.time && (
            <Text style={styles.bookingDetailsText}>{bookingData.time}</Text>
          )}
          <Text style={styles.bookingDetailsAmount}>
            Amount Paid: ₹{price}
          </Text>
        </View>

        {/* Refund Preview */}
        {refundPreview && (
          <View
            style={[
              styles.refundCard,
              refundPreview.refundAmount > 0
                ? styles.refundCardPositive
                : styles.refundCardNegative,
            ]}
          >
            <View style={styles.refundHeader}>
              <Text
                style={[
                  styles.refundIcon,
                  refundPreview.refundAmount > 0
                    ? styles.refundIconPositive
                    : styles.refundIconNegative,
                ]}
              >
                {refundPreview.refundAmount > 0 ? '💰' : '⚠️'}
              </Text>
              <Text
                style={[
                  styles.refundAmount,
                  refundPreview.refundAmount > 0
                    ? styles.refundAmountPositive
                    : styles.refundAmountNegative,
                ]}
              >
                Refund Amount: ₹{refundPreview.refundAmount}
              </Text>
            </View>
            <Text
              style={[
                styles.refundPolicy,
                refundPreview.refundAmount > 0
                  ? styles.refundPolicyPositive
                  : styles.refundPolicyNegative,
              ]}
            >
              {refundPreview.refundPolicy}
            </Text>
            {refundPreview.deductionAmount > 0 && (
              <Text style={styles.deductionText}>
                Cancellation charges: ₹{refundPreview.deductionAmount}
              </Text>
            )}
            {refundPreview.platformFeeApplies && (
              <Text style={styles.platformFeeNote}>Platform fee is not refundable.</Text>
            )}
          </View>
        )}

        {/* Cancellation Reason */}
        <View style={styles.reasonCard}>
          <Text style={styles.reasonTitle}>
            Reason for Cancellation *
          </Text>
          <TextInput
            style={styles.reasonInput}
            value={cancellationReason}
            onChangeText={setCancellationReason}
            placeholder="Please tell us why you're cancelling..."
            multiline
            numberOfLines={6}
          />
        </View>

        {/* Warning Message */}
        <View style={styles.warningCard}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningText}>
            {refundPreview && refundPreview.refundAmount > 0
              ? 'Refunds will be processed within 5-7 business days to your original payment method.'
              : 'This cancellation is not eligible for a refund as per our cancellation policy.'}
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.cancelButton, styles.cancelButtonSecondary]}
            onPress={onBack}
            disabled={cancelling}
          >
            <Text style={styles.cancelButtonTextSecondary}>Go Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.cancelButton,
              !cancellationReason.trim() && styles.cancelButtonDisabled,
            ]}
            onPress={handleCancel}
            disabled={!cancellationReason.trim() || cancelling}
          >
            {cancelling ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.cancelButtonText}>Confirm Cancellation</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </OrangeBrandedScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  bookingDetailsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  bookingDetailsLabel: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  bookingDetailsText: {
    fontSize: typography.body,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  bookingDetailsAmount: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.xs,
  },
  refundCard: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  refundCardPositive: {
    backgroundColor: '#F0FDF4',
    borderColor: colors.success,
  },
  refundCardNegative: {
    backgroundColor: colors.error + 20% opacity,
    borderColor: '#EF4444',
  },
  refundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  refundIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  refundIconPositive: {
    // Green color handled by emoji
  },
  refundIconNegative: {
    // Red color handled by emoji
  },
  refundAmount: {
    fontSize: typography.body,
    fontWeight: 'bold',
  },
  refundAmountPositive: {
    color: '#065F46',
  },
  refundAmountNegative: {
    color: '#991B1B',
  },
  refundPolicy: {
    fontSize: typography.caption,
    marginBottom: spacing.xs,
    lineHeight: 18,
  },
  refundPolicyPositive: {
    color: '#047857',
  },
  refundPolicyNegative: {
    color: colors.error,
  },
  deductionText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  platformFeeNote: {
    fontSize: typography.caption,
    color: '#92400E',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.sm,
  },
  reasonCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  reasonTitle: {
    fontSize: typography.body,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  reasonInput: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
    fontSize: typography.body,
    color: colors.text,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  warningCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#FCD34D',
    flexDirection: 'row',
  },
  warningIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  warningText: {
    fontSize: typography.caption,
    color: '#92400E',
    flex: 1,
    lineHeight: 18,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#EF4444',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  cancelButtonSecondary: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  cancelButtonDisabled: {
    backgroundColor: colors.gray['200'],
  },
  cancelButtonText: {
    color: colors.white,
    fontSize: typography.body,
    fontWeight: 'bold',
  },
  cancelButtonTextSecondary: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: 'bold',
  },
});

