/**
 * Revenue Analytics Screen
 * Revenue analysis and trends
 * Batch 3 - Screen 7
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
import { RevenueApi } from '../../services/api';

interface RevenueAnalyticsScreenProps {
  vendorId: string;
  onBack?: () => void;
}

export function RevenueAnalyticsScreen({ vendorId, onBack }: RevenueAnalyticsScreenProps) {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    loadAnalytics();
  }, [vendorId, period]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await RevenueApi.getAnalytics(vendorId, period);
      setAnalytics(response.analytics);
    } catch (error) {
      console.error('Error loading analytics:', error);
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
        <Text style={styles.title}>Revenue Analytics</Text>
      </View>

      <View style={styles.periodSelector}>
        {(['week', 'month', 'year'] as const).map((p) => (
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

      <ScrollView contentContainerStyle={styles.content}>
        {analytics && (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Total Revenue</Text>
              <Text style={styles.summaryAmount}>
                {formatCurrency(analytics.totalRevenue || 0)}
              </Text>
              {analytics.growth && (
                <Text style={styles.growthText}>
                  {analytics.growth > 0 ? '↑' : '↓'} {Math.abs(analytics.growth)}% vs previous period
                </Text>
              )}
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Avg per Booking</Text>
                <Text style={styles.statValue}>
                  {formatCurrency(analytics.avgPerBooking || 0)}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Total Bookings</Text>
                <Text style={styles.statValue}>
                  {analytics.totalBookings || 0}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Peak Day</Text>
                <Text style={styles.statValue}>
                  {analytics.peakDay || 'N/A'}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Growth Rate</Text>
                <Text style={styles.statValue}>
                  {analytics.growthRate || 0}%
                </Text>
              </View>
            </View>

            {analytics.byService && analytics.byService.length > 0 && (
              <View style={styles.servicesCard}>
                <Text style={styles.sectionTitle}>Revenue by Service</Text>
                {analytics.byService.map((item: any, index: number) => (
                  <View key={index} style={styles.serviceItem}>
                    <Text style={styles.serviceName}>{item.serviceName}</Text>
                    <Text style={styles.serviceAmount}>
                      {formatCurrency(item.revenue)}
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
  summaryAmount: {
    fontSize: typography.fontSizes['3xl'],
    fontWeight: typography.fontWeights.bold,
    color: '#ffffff',
    marginBottom: spacing.xs,
  },
  growthText: {
    fontSize: typography.fontSizes.sm,
    color: '#ffffff',
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
  servicesCard: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
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
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  serviceName: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
  },
  serviceAmount: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
});

