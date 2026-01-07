/**
 * Payment Failure Recovery Screen - Mobile
 * Handle payment failures and retry
 * Identical functionality to web app
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { CustomerApi, PaymentApi } from '../../services/api';

interface PaymentFailureRecoveryScreenProps {
  paymentId: string;
  orderId?: string;
  bookingId?: string;
  amount: number;
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: () => void;
}

export function PaymentFailureRecoveryScreen({
  paymentId,
  orderId,
  bookingId,
  amount,
  phone,
  onBack,
  onNavigate,
  onSuccess,
}: PaymentFailureRecoveryScreenProps) {
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'razorpay' | 'wallet'>('razorpay');

  const handleRetryPayment = async () => {
    try {
      setRetrying(true);

      // ✅ WIRED: Using actual payment retry API
      const response = await PaymentApi.retryPayment(paymentId, orderId, bookingId, selectedMethod);
      
      if (response.success || response.paymentUrl || response.razorpayOrderId) {
        // If payment URL is returned, navigate to payment screen
        if (response.paymentUrl && onNavigate) {
          onNavigate('Payment', {
            paymentUrl: response.paymentUrl,
            orderId: orderId || bookingId,
            amount,
            onSuccess: () => {
              if (onSuccess) {
                onSuccess();
              }
            },
          });
        } else {
          Alert.alert(
            'Payment Successful',
            'Your payment has been processed successfully.',
            [
              {
                text: 'OK',
                onPress: () => {
                  if (onSuccess) {
                    onSuccess();
                  } else if (onNavigate) {
                    if (bookingId) {
                      onNavigate('BookingDetail', { bookingId });
                    } else if (orderId) {
                      onNavigate('OrderDetail', { orderId });
                    }
                  }
                },
              },
            ]
          );
        }
      } else {
        Alert.alert('Payment Failed', response.error || 'Failed to process payment. Please try again.');
      }
    } catch (error: any) {
      console.error('Error retrying payment:', error);
      Alert.alert('Payment Failed', error.message || 'Failed to process payment. Please try again.');
    } finally {
      setRetrying(false);
    }
  };

  const handleChangeMethod = () => {
    setSelectedMethod(selectedMethod === 'razorpay' ? 'wallet' : 'razorpay');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Failed</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Error Banner */}
        <View style={styles.errorBanner}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <View style={styles.errorContent}>
            <Text style={styles.errorTitle}>Payment Failed</Text>
            <Text style={styles.errorSubtitle}>
              We couldn't process your payment. Please try again.
            </Text>
          </View>
        </View>

        {/* Payment Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Details</Text>
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payment ID</Text>
              <Text style={styles.detailValue}>{paymentId}</Text>
            </View>
            {orderId && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Order ID</Text>
                <Text style={styles.detailValue}>{orderId}</Text>
              </View>
            )}
            {bookingId && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Booking ID</Text>
                <Text style={styles.detailValue}>{bookingId}</Text>
              </View>
            )}
            <View style={[styles.detailRow, styles.amountRow]}>
              <Text style={styles.amountLabel}>Amount</Text>
              <Text style={styles.amountValue}>₹{amount.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Payment Method Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <TouchableOpacity
            style={[
              styles.methodCard,
              selectedMethod === 'razorpay' && styles.methodCardSelected,
            ]}
            onPress={() => setSelectedMethod('razorpay')}
          >
            <Text style={styles.methodIcon}>💳</Text>
            <View style={styles.methodInfo}>
              <Text style={styles.methodName}>Razorpay</Text>
              <Text style={styles.methodDescription}>Credit/Debit Card, UPI, Net Banking</Text>
            </View>
            {selectedMethod === 'razorpay' && (
              <View style={styles.selectedIndicator}>
                <Text style={styles.selectedCheck}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.methodCard,
              selectedMethod === 'wallet' && styles.methodCardSelected,
            ]}
            onPress={() => setSelectedMethod('wallet')}
          >
            <Text style={styles.methodIcon}>💰</Text>
            <View style={styles.methodInfo}>
              <Text style={styles.methodName}>Wallet</Text>
              <Text style={styles.methodDescription}>Use your Warmpawz wallet balance</Text>
            </View>
            {selectedMethod === 'wallet' && (
              <View style={styles.selectedIndicator}>
                <Text style={styles.selectedCheck}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Common Reasons */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Common Reasons for Failure</Text>
          <View style={styles.reasonsCard}>
            <Text style={styles.reasonItem}>• Insufficient funds</Text>
            <Text style={styles.reasonItem}>• Network connectivity issues</Text>
            <Text style={styles.reasonItem}>• Card expired or blocked</Text>
            <Text style={styles.reasonItem}>• Bank server timeout</Text>
          </View>
        </View>

        {/* Retry Button */}
        <TouchableOpacity
          style={[styles.retryButton, retrying && styles.retryButtonDisabled]}
          onPress={handleRetryPayment}
          disabled={retrying}
        >
          {retrying ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.retryButtonText}>Retry Payment</Text>
          )}
        </TouchableOpacity>

        {/* Support */}
        <TouchableOpacity
          style={styles.supportButton}
          onPress={() => onNavigate && onNavigate('HelpSupport')}
        >
          <Text style={styles.supportButtonText}>Need Help? Contact Support</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  errorBanner: {
    flexDirection: 'row',
    backgroundColor: colors.error + 20% opacity,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  errorIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  errorContent: {
    flex: 1,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.error,
    marginBottom: spacing.xs,
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#991b1b',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  detailsCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  amountRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  amountLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  amountValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
  },
  methodCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.gradientOrange50,
  },
  methodIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  methodDescription: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCheck: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  reasonsCard: {
    backgroundColor: colors.gray['100'],
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  reasonItem: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  retryButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  retryButtonDisabled: {
    backgroundColor: colors.gray['400'],
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  supportButton: {
    padding: spacing.md,
    alignItems: 'center',
  },
  supportButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});

