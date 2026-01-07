/**
 * Earnings Screen
 * Vendor earnings dashboard
 * Batch 3 - Screen 1
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { EarningsApi } from '../../services/api';

interface EarningsScreenProps {
  vendorId: string;
  onBack?: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function EarningsScreen({
  vendorId,
  onBack,
  onNavigate,
}: EarningsScreenProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [earnings, setEarnings] = useState<any>(null);
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'lifetime'>('month');

  useEffect(() => {
    loadEarnings();
  }, [vendorId, period]);

  const loadEarnings = async () => {
    try {
      setLoading(true);
      const response = await EarningsApi.getEarnings(vendorId, period);
      setEarnings(response.earnings);
    } catch (error) {
      console.error('Error loading earnings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadEarnings();
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toFixed(2)}`;
  };

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
        <Text style={styles.title}>Earnings</Text>
      </View>

      <View style={styles.periodSelector}>
        {(['day', 'week', 'month', 'year', 'lifetime'] as const).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodButton, period === p && styles.periodButtonActive]}
            onPress={() => setPeriod(p)}
          >
            <Text
              style={[
                styles.periodButtonText,
                period === p && styles.periodButtonTextActive,
              ]}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {earnings && (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Total Earnings</Text>
              <Text style={styles.summaryAmount}>
                {formatCurrency(earnings.totalEarnings || 0)}
              </Text>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Total Revenue</Text>
                <Text style={styles.statValue}>
                  {formatCurrency(earnings.totalRevenue || 0)}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Platform Fees</Text>
                <Text style={styles.statValue}>
                  {formatCurrency(earnings.platformFees || earnings.totalCommission || 0)}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Total Bookings</Text>
                <Text style={styles.statValue}>
                  {earnings.totalBookings || 0}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Pending</Text>
                <Text style={styles.statValue}>
                  {formatCurrency(earnings.pendingAmount || 0)}
                </Text>
              </View>
            </View>

            {earnings.currentMonth && (
              <View style={styles.monthCard}>
                <Text style={styles.monthTitle}>Current Month</Text>
                <View style={styles.monthStats}>
                  <View style={styles.monthStat}>
                    <Text style={styles.monthStatLabel}>Revenue</Text>
                    <Text style={styles.monthStatValue}>
                      {formatCurrency(earnings.currentMonth.totalRevenue || 0)}
                    </Text>
                  </View>
                  <View style={styles.monthStat}>
                    <Text style={styles.monthStatLabel}>Earnings</Text>
                    <Text style={styles.monthStatValue}>
                      {formatCurrency(earnings.currentMonth.totalEarnings || 0)}
                    </Text>
                  </View>
                  <View style={styles.monthStat}>
                    <Text style={styles.monthStatLabel}>Bookings</Text>
                    <Text style={styles.monthStatValue}>
                      {earnings.currentMonth.totalBookings || 0}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {earnings.tier && (
              <View style={styles.tierCard}>
                <Text style={styles.tierTitle}>Current Tier</Text>
                <Text style={styles.tierValue}>
                  {earnings.tier.current?.charAt(0).toUpperCase() + earnings.tier.current?.slice(1) || 'Bronze'}
                </Text>
                <Text style={styles.tierCommission}>
                  Commission Rate: {earnings.tier.commissionRate || 5.0}%
                </Text>
              </View>
            )}

            {onNavigate && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => onNavigate('Payouts')}
                >
                  <Text style={styles.actionButtonText}>View Payouts</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => onNavigate('CommissionBreakdown')}
                >
                  <Text style={styles.actionButtonText}>Commission Breakdown</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => onNavigate('TransactionHistory')}
                >
                  <Text style={styles.actionButtonText}>Transaction History</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
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
  periodSelector: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  periodButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  periodButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.gradientOrange50,
  },
  periodButtonText: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
  },
  periodButtonTextActive: {
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  content: {
    padding: spacing.lg,
  },
  summaryCard: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  summaryTitle: {
    fontSize: typography.fontSizes.md,
    color: colors.white,
    marginBottom: spacing.sm,
  },
  summaryAmount: {
    fontSize: typography.fontSizes['3xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.white,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    width: '48%',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
  },
  statLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
  },
  statValue: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
  monthCard: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  monthTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  monthStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  monthStat: {
    alignItems: 'center',
  },
  monthStatLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
  },
  monthStatValue: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
  tierCard: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  tierTitle: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  tierValue: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  tierCommission: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  actionButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.white,
  },
});

