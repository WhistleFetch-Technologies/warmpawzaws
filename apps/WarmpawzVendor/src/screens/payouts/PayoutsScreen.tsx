/**
 * Payouts Screen
 * Payout tracking and history
 * Batch 3 - Screen 2
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { PayoutsApi } from '../../services/api';

interface PayoutsScreenProps {
  vendorId: string;
  onBack?: () => void;
}

interface Payout {
  id: string;
  amount: number;
  status: string;
  scheduledAt: string;
  processedAt?: string;
  completedAt?: string;
  razorpayPayoutId?: string;
  failureReason?: string;
}

export function PayoutsScreen({ vendorId, onBack }: PayoutsScreenProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    loadPayouts();
  }, [vendorId]);

  const loadPayouts = async () => {
    try {
      setLoading(true);
      const response = await PayoutsApi.getPayouts(vendorId);
      setPayouts(response.payouts || []);
      setSummary(response.summary);
    } catch (error) {
      console.error('Error loading payouts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPayouts();
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toFixed(2)}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return colors.success;
      case 'processing':
        return colors.info;
      case 'failed':
        return colors.error;
      case 'pending':
      case 'scheduled':
        return colors.warning;
      default:
        return colors.textSecondary;
    }
  };

  const renderPayout = ({ item }: { item: Payout }) => (
    <View style={styles.payoutCard}>
      <View style={styles.payoutHeader}>
        <Text style={styles.payoutAmount}>{formatCurrency(item.amount)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>
      <Text style={styles.payoutDate}>
        Scheduled: {new Date(item.scheduledAt).toLocaleDateString()}
      </Text>
      {item.processedAt && (
        <Text style={styles.payoutDate}>
          Processed: {new Date(item.processedAt).toLocaleDateString()}
        </Text>
      )}
      {item.completedAt && (
        <Text style={styles.payoutDate}>
          Completed: {new Date(item.completedAt).toLocaleDateString()}
        </Text>
      )}
      {item.razorpayPayoutId && (
        <Text style={styles.payoutId}>Payout ID: {item.razorpayPayoutId}</Text>
      )}
      {item.failureReason && (
        <Text style={styles.failureReason}>Failed: {item.failureReason}</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Payouts</Text>
      </View>

      {summary && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Summary</Text>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>Total Paid</Text>
              <Text style={styles.summaryStatValue}>
                {formatCurrency(summary.totalPaid || 0)}
              </Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>Pending</Text>
              <Text style={styles.summaryStatValue}>
                {formatCurrency(summary.pending || 0)}
              </Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>Processing</Text>
              <Text style={styles.summaryStatValue}>
                {formatCurrency(summary.processing || 0)}
              </Text>
            </View>
          </View>
        </View>
      )}

      <FlatList
        data={payouts}
        keyExtractor={(item) => item.id}
        renderItem={renderPayout}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No payouts found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  summaryCard: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    margin: spacing.md,
  },
  summaryTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryStat: {
    alignItems: 'center',
  },
  summaryStatLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
  },
  summaryStatValue: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
  listContent: {
    padding: spacing.md,
  },
  payoutCard: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  payoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  payoutAmount: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.medium,
    color: '#ffffff',
  },
  payoutDate: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
  },
  payoutId: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
    marginTop: spacing.xs / 2,
  },
  failureReason: {
    fontSize: typography.fontSizes.sm,
    color: colors.error,
    marginTop: spacing.xs / 2,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
});

