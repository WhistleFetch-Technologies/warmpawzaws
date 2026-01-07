/**
 * Commission Breakdown Screen
 * Commission details and breakdown
 * Batch 3 - Screen 3
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
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CommissionApi } from '../../services/api';

interface CommissionBreakdownScreenProps {
  vendorId: string;
  onBack?: () => void;
}

export function CommissionBreakdownScreen({ vendorId, onBack }: CommissionBreakdownScreenProps) {
  const [loading, setLoading] = useState(true);
  const [breakdown, setBreakdown] = useState<any>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');

  useEffect(() => {
    loadBreakdown();
  }, [vendorId, selectedPeriod]);

  const loadBreakdown = async () => {
    try {
      setLoading(true);
      const response = await CommissionApi.getCommissionBreakdown(vendorId, selectedPeriod);
      setBreakdown(response.breakdown || response);
    } catch (error) {
      console.error('Error loading commission breakdown:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => `₹${amount.toFixed(2)}`;

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
        <Text style={styles.title}>Commission Breakdown</Text>
      </View>

      <View style={styles.periodSelector}>
        {(['day', 'week', 'month', 'year'] as const).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodButton, selectedPeriod === p && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod(p)}
          >
            <Text
              style={[
                styles.periodButtonText,
                selectedPeriod === p && styles.periodButtonTextActive,
              ]}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {breakdown && (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Current Tier</Text>
              <Text style={styles.tierName}>
                {breakdown.tier?.name?.charAt(0).toUpperCase() + breakdown.tier?.name?.slice(1) || 'Bronze'}
              </Text>
              <Text style={styles.commissionRate}>
                Commission Rate: {breakdown.tier?.commissionRate || 5.0}%
              </Text>
            </View>

            <View style={styles.statsCard}>
              <Text style={styles.statsTitle}>Total Commission</Text>
              <Text style={styles.statsAmount}>
                {formatCurrency(breakdown.totalCommission || 0)}
              </Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Total Revenue</Text>
                  <Text style={styles.statValue}>
                    {formatCurrency(breakdown.totalRevenue || 0)}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Your Earnings</Text>
                  <Text style={styles.statValue}>
                    {formatCurrency(breakdown.totalEarnings || 0)}
                  </Text>
                </View>
              </View>
            </View>

            {breakdown.byService && breakdown.byService.length > 0 && (
              <View style={styles.servicesCard}>
                <Text style={styles.sectionTitle}>By Service Type</Text>
                {breakdown.byService.map((item: any, index: number) => (
                  <View key={index} style={styles.serviceItem}>
                    <Text style={styles.serviceName}>{item.serviceName}</Text>
                    <View style={styles.serviceDetails}>
                      <Text style={styles.serviceAmount}>
                        {formatCurrency(item.commission)}
                      </Text>
                      <Text style={styles.serviceRate}>{item.rate}%</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {breakdown.history && breakdown.history.length > 0 && (
              <View style={styles.historyCard}>
                <Text style={styles.sectionTitle}>Recent Commissions</Text>
                {breakdown.history.slice(0, 10).map((item: any, index: number) => (
                  <View key={index} style={styles.historyItem}>
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyDate}>
                        {new Date(item.date).toLocaleDateString()}
                      </Text>
                      <Text style={styles.historyBooking}>
                        Booking #{item.bookingId?.substring(0, 8)}
                      </Text>
                    </View>
                    <Text style={styles.historyAmount}>
                      {formatCurrency(item.commission)}
                    </Text>
                  </View>
                ))}
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
    color: '#ffffff',
    marginBottom: spacing.sm,
  },
  tierName: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: typography.fontWeights.bold,
    color: '#ffffff',
    marginBottom: spacing.xs,
  },
  commissionRate: {
    fontSize: typography.fontSizes.sm,
    color: '#ffffff',
  },
  statsCard: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statsTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  statsAmount: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
  },
  statValue: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
  servicesCard: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  serviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  serviceName: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
    flex: 1,
  },
  serviceDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  serviceAmount: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
  serviceRate: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  historyCard: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyInfo: {
    flex: 1,
  },
  historyDate: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
  },
  historyBooking: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
  },
  historyAmount: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
  periodSelector: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    backgroundColor: '#FFF4E6',
  },
  periodButtonText: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
  },
  periodButtonTextActive: {
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
});

