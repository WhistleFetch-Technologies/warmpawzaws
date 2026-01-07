/**
 * Staff Earnings Screen
 * Staff-specific earnings view
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
import { StaffApi } from '../../services/api';

interface StaffEarningsScreenProps {
  staffId: string;
  onBack?: () => void;
}

export function StaffEarningsScreen({
  staffId,
  onBack,
}: StaffEarningsScreenProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [earnings, setEarnings] = useState<any>(null);
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');

  useEffect(() => {
    loadEarnings();
  }, [staffId, period]);

  const loadEarnings = async () => {
    try {
      setLoading(true);
      const response = await StaffApi.getEarnings(staffId, period);
      setEarnings(response.earnings || response);
    } catch (error) {
      console.error('Error loading staff earnings:', error);
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
        <Text style={styles.title}>My Earnings</Text>
      </View>

      <View style={styles.periodSelector}>
        {(['day', 'week', 'month', 'year'] as const).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodButton, period === p && styles.periodButtonActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.periodButtonText, period === p && styles.periodButtonTextActive]}>
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
                {formatCurrency(earnings.totalEarnings || earnings.staffRevenue || 0)}
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
                <Text style={styles.statLabel}>Completed Services</Text>
                <Text style={styles.statValue}>
                  {earnings.completedServices || earnings.totalBookings || 0}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Average per Service</Text>
                <Text style={styles.statValue}>
                  {earnings.completedServices > 0
                    ? formatCurrency((earnings.totalEarnings || earnings.staffRevenue || 0) / earnings.completedServices)
                    : formatCurrency(0)}
                </Text>
              </View>
            </View>

            {earnings.recentBookings && earnings.recentBookings.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent Services</Text>
                {earnings.recentBookings.map((booking: any, index: number) => (
                  <View key={index} style={styles.bookingItem}>
                    <View style={styles.bookingInfo}>
                      <Text style={styles.bookingService}>{booking.serviceName || 'Service'}</Text>
                      <Text style={styles.bookingDate}>
                        {new Date(booking.completedAt || booking.completed_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text style={styles.bookingAmount}>
                      {formatCurrency(booking.staffEarnings || booking.amount || 0)}
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: spacing.md,
  },
  backButtonText: {
    ...typography.body,
    color: colors.primary,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  periodSelector: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  periodButton: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginHorizontal: spacing.xs,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: colors.primary,
  },
  periodButtonText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  periodButtonTextActive: {
    color: colors.card,
    fontWeight: '600',
  },
  content: {
    padding: spacing.lg,
  },
  summaryCard: {
    backgroundColor: colors.card,
    padding: spacing.xl,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  summaryTitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  summaryAmount: {
    ...typography.h1,
    color: colors.primary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  statCard: {
    width: '48%',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  statValue: {
    ...typography.h3,
    color: colors.text,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  bookingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  bookingInfo: {
    flex: 1,
  },
  bookingService: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  bookingDate: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  bookingAmount: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primary,
  },
});

