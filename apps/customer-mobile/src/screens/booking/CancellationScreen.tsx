/**
 * Cancellation Screen - Customer Mobile App
 * Handle booking cancellation with refund calculation
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import RefundService, { RefundEstimate, RefundPolicy } from '../../services/RefundService';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface CancellationScreenProps {
  route?: {
    params?: {
      bookingId: string;
      booking?: any;
    };
  };
  navigation?: any;
}

export default function CancellationScreen({
  route,
  navigation,
}: CancellationScreenProps) {
  const { user } = useAuth();
  const bookingId = route?.params?.bookingId || '';
  const booking = route?.params?.booking || {};

  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [refundEstimate, setRefundEstimate] = useState<RefundEstimate | null>(null);
  const [policy, setPolicy] = useState<RefundPolicy | null>(null);
  const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<'wallet' | 'original'>('wallet');

  useEffect(() => {
    loadRefundInfo();
  }, [bookingId]);

  const loadRefundInfo = async () => {
    try {
      setLoading(true);
      const [estimate, policyData] = await Promise.all([
        RefundService.getRefundEstimate(bookingId),
        RefundService.getRefundPolicy(bookingId),
      ]);

      if (estimate) {
        setRefundEstimate(estimate);
      }

      if (policyData) {
        setPolicy(policyData.policy);
        if (policyData.currentRefund) {
          setRefundEstimate(policyData.currentRefund);
        }
      }
    } catch (error) {
      console.error('Error loading refund info:', error);
      Alert.alert('Error', 'Failed to load refund information');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!reason.trim()) {
      Alert.alert('Required', 'Please provide a reason for cancellation');
      return;
    }

    Alert.alert(
      'Confirm Cancellation',
      `Are you sure you want to cancel this booking? ${refundEstimate?.refundable ? `You will receive ₹${refundEstimate.estimatedRefund.toFixed(2)} as refund.` : 'No refund will be issued as per policy.'}`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setCancelling(true);
              const result = await RefundService.requestRefund({
                bookingId,
                reason,
                refundMethod,
              });

              if (result) {
                Alert.alert(
                  'Booking Cancelled',
                  result.message || 'Your booking has been cancelled successfully.',
                  [
                    {
                      text: 'OK',
                      onPress: () => navigation?.goBack(),
                    },
                  ]
                );
              } else {
                Alert.alert('Error', 'Failed to cancel booking');
              }
            } catch (error) {
              console.error('Error cancelling booking:', error);
              Alert.alert('Error', 'Failed to cancel booking');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Loading refund information...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation?.goBack()}
          >
            <Icon name="arrow-back" size={24} color={BrandColors.primary.orange} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[Typography.h2, styles.headerTitle]}>Cancel Booking</Text>
            <Text style={[Typography.bodySmall, styles.headerSubtitle]}>
              Booking ID: {bookingId.substring(0, 12)}...
            </Text>
          </View>
        </View>

        {/* Refund Estimate */}
        {refundEstimate && (
          <View style={styles.refundCard}>
            <Text style={[Typography.h3, styles.refundTitle]}>Refund Estimate</Text>
            <View style={styles.refundRow}>
              <Text style={[Typography.body, styles.refundLabel]}>Paid Amount:</Text>
              <Text style={[Typography.body, styles.refundValue]}>
                ₹{refundEstimate.paidAmount.toFixed(2)}
              </Text>
            </View>
            <View style={styles.refundRow}>
              <Text style={[Typography.body, styles.refundLabel]}>Hours Until Service:</Text>
              <Text style={[Typography.body, styles.refundValue]}>
                {refundEstimate.hoursUntilService.toFixed(1)} hours
              </Text>
            </View>
            <View style={styles.refundRow}>
              <Text style={[Typography.body, styles.refundLabel]}>Refund Percentage:</Text>
              <Text style={[Typography.body, styles.refundValue]}>
                {refundEstimate.refundPercentage}%
              </Text>
            </View>
            {refundEstimate.cancellationFee > 0 && (
              <View style={styles.refundRow}>
                <Text style={[Typography.body, styles.refundLabel]}>Cancellation Fee:</Text>
                <Text style={[Typography.body, styles.refundValue]}>
                  -₹{refundEstimate.cancellationFee.toFixed(2)}
                </Text>
              </View>
            )}
            <View style={[styles.refundRow, styles.refundTotal]}>
              <Text style={[Typography.h4, styles.refundLabel]}>Estimated Refund:</Text>
              <Text style={[Typography.h4, styles.refundTotalValue]}>
                ₹{refundEstimate.estimatedRefund.toFixed(2)}
              </Text>
            </View>
            {!refundEstimate.refundable && refundEstimate.reason && (
              <View style={styles.warningBox}>
                <Icon name="warning" size={20} color={BrandColors.semantic.warning} />
                <Text style={[Typography.bodySmall, styles.warningText]}>
                  {refundEstimate.reason}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Refund Policy */}
        {policy && (
          <View style={styles.policyCard}>
            <Text style={[Typography.h3, styles.policyTitle]}>Refund Policy</Text>
            {policy.rules.map((rule, index) => (
              <View key={index} style={styles.policyRule}>
                <Icon name="check-circle" size={16} color={BrandColors.primary.orange} />
                <Text style={[Typography.bodySmall, styles.policyRuleText]}>{rule}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Refund Method */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Refund Method</Text>
          <View style={styles.refundMethodButtons}>
            <TouchableOpacity
              style={[
                styles.refundMethodButton,
                refundMethod === 'wallet' && styles.refundMethodButtonActive,
              ]}
              onPress={() => setRefundMethod('wallet')}
            >
              <Icon
                name={refundMethod === 'wallet' ? 'radio-button-checked' : 'radio-button-unchecked'}
                size={24}
                color={refundMethod === 'wallet' ? BrandColors.primary.orange : BrandColors.neutral.gray400}
              />
              <View style={styles.refundMethodInfo}>
                <Text
                  style={[
                    Typography.body,
                    refundMethod === 'wallet' && styles.refundMethodTextActive,
                  ]}
                >
                  Wallet (Instant)
                </Text>
                <Text style={[Typography.bodyTiny, styles.refundMethodSubtext]}>
                  Refund credited immediately to your wallet
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.refundMethodButton,
                refundMethod === 'original' && styles.refundMethodButtonActive,
              ]}
              onPress={() => setRefundMethod('original')}
            >
              <Icon
                name={refundMethod === 'original' ? 'radio-button-checked' : 'radio-button-unchecked'}
                size={24}
                color={refundMethod === 'original' ? BrandColors.primary.orange : BrandColors.neutral.gray400}
              />
              <View style={styles.refundMethodInfo}>
                <Text
                  style={[
                    Typography.body,
                    refundMethod === 'original' && styles.refundMethodTextActive,
                  ]}
                >
                  Original Source (5-7 days)
                </Text>
                <Text style={[Typography.bodyTiny, styles.refundMethodSubtext]}>
                  Refund processed to original payment method
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cancellation Reason */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Reason for Cancellation</Text>
          <TextInput
            style={styles.reasonInput}
            placeholder="Please provide a reason for cancellation..."
            placeholderTextColor={BrandColors.neutral.gray400}
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={4}
          />
        </View>
      </ScrollView>

      {/* Cancel Button */}
      <View style={styles.footer}>
        <BrandedButton
          title={cancelling ? 'Cancelling...' : 'Cancel Booking'}
          onPress={handleCancel}
          disabled={cancelling || !reason.trim()}
          variant="destructive"
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl + 80,
  },
  header: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    color: BrandColors.neutral.gray600,
  },
  refundCard: {
    margin: Spacing.lg,
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  refundTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.base,
  },
  refundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  refundTotal: {
    marginTop: Spacing.base,
    paddingTop: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
  },
  refundLabel: {
    color: BrandColors.neutral.gray700,
  },
  refundValue: {
    color: BrandColors.neutral.gray900,
    fontWeight: '600',
  },
  refundTotalValue: {
    color: BrandColors.primary.orange,
    fontWeight: '700',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.base,
    padding: Spacing.base,
    backgroundColor: BrandColors.semantic.warning + '20',
    borderRadius: BorderRadius.sm,
  },
  warningText: {
    color: BrandColors.semantic.warning,
    flex: 1,
  },
  policyCard: {
    margin: Spacing.lg,
    marginTop: 0,
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  policyTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.base,
  },
  policyRule: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  policyRuleText: {
    color: BrandColors.neutral.gray700,
    flex: 1,
  },
  section: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
  },
  sectionTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.base,
  },
  refundMethodButtons: {
    gap: Spacing.base,
  },
  refundMethodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: BrandColors.neutral.gray200,
  },
  refundMethodButtonActive: {
    borderColor: BrandColors.primary.orange,
    backgroundColor: BrandColors.primary.orange + '10',
  },
  refundMethodInfo: {
    flex: 1,
  },
  refundMethodTextActive: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  refundMethodSubtext: {
    color: BrandColors.neutral.gray600,
    marginTop: Spacing.xs,
  },
  reasonInput: {
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
    ...Typography.body,
    color: BrandColors.neutral.gray900,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
    backgroundColor: '#FFFFFF',
  },
});

