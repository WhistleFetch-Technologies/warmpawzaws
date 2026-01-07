/**
 * Financial Summary Screen
 * Financial overview and summary
 * Batch 3 - Screen 9
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
import { FinancialApi } from '../../services/api';

interface FinancialSummaryScreenProps {
  vendorId: string;
  onBack?: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function FinancialSummaryScreen({ vendorId, onBack, onNavigate }: FinancialSummaryScreenProps) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    loadSummary();
  }, [vendorId]);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const response = await FinancialApi.getSummary(vendorId);
      setSummary(response.summary);
    } catch (error) {
      console.error('Error loading summary:', error);
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
        <Text style={styles.title}>Financial Summary</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {summary && (
          <>
            <View style={styles.overviewCard}>
              <Text style={styles.overviewTitle}>Total Earnings</Text>
              <Text style={styles.overviewAmount}>
                {formatCurrency(summary.totalEarnings || 0)}
              </Text>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Total Revenue</Text>
                <Text style={styles.statValue}>
                  {formatCurrency(summary.totalRevenue || 0)}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Total Paid Out</Text>
                <Text style={styles.statValue}>
                  {formatCurrency(summary.totalPaidOut || 0)}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Pending</Text>
                <Text style={styles.statValue}>
                  {formatCurrency(summary.pending || 0)}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Platform Fees</Text>
                <Text style={styles.statValue}>
                  {formatCurrency(summary.platformFees || 0)}
                </Text>
              </View>
            </View>

            <View style={styles.periodCard}>
              <Text style={styles.periodTitle}>This Month</Text>
              <View style={styles.periodStats}>
                <View style={styles.periodStat}>
                  <Text style={styles.periodStatLabel}>Revenue</Text>
                  <Text style={styles.periodStatValue}>
                    {formatCurrency(summary.thisMonth?.revenue || 0)}
                  </Text>
                </View>
                <View style={styles.periodStat}>
                  <Text style={styles.periodStatLabel}>Earnings</Text>
                  <Text style={styles.periodStatValue}>
                    {formatCurrency(summary.thisMonth?.earnings || 0)}
                  </Text>
                </View>
                <View style={styles.periodStat}>
                  <Text style={styles.periodStatLabel}>Bookings</Text>
                  <Text style={styles.periodStatValue}>
                    {summary.thisMonth?.bookings || 0}
                  </Text>
                </View>
              </View>
            </View>

            {onNavigate && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => onNavigate('Earnings')}
                >
                  <Text style={styles.actionButtonText}>View Earnings</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => onNavigate('Payouts')}
                >
                  <Text style={styles.actionButtonText}>View Payouts</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => onNavigate('TransactionHistory')}
                >
                  <Text style={styles.actionButtonText}>Transaction History</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => onNavigate('TaxDocuments')}
                >
                  <Text style={styles.actionButtonText}>Tax Documents</Text>
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
  content: {
    padding: spacing.lg,
  },
  overviewCard: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  overviewTitle: {
    fontSize: typography.fontSizes.md,
    color: colors.white,
    marginBottom: spacing.sm,
  },
  overviewAmount: {
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
    alignItems: 'center',
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
  periodCard: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  periodTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  periodStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  periodStat: {
    alignItems: 'center',
  },
  periodStatLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
  },
  periodStatValue: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
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

