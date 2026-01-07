/**
 * Performance Metrics Screen
 * Performance tracking and metrics
 * Batch 3 - Screen 6
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
import { PerformanceApi } from '../../services/api';

interface PerformanceMetricsScreenProps {
  vendorId: string;
  onBack?: () => void;
}

export function PerformanceMetricsScreen({ vendorId, onBack }: PerformanceMetricsScreenProps) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    loadMetrics();
  }, [vendorId]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const response = await PerformanceApi.getMetrics(vendorId);
      setMetrics(response.metrics);
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
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
        <Text style={styles.title}>Performance Metrics</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {metrics && (
          <>
            <View style={styles.metricCard}>
              <Text style={styles.metricTitle}>Customer Satisfaction</Text>
              <Text style={styles.metricValue}>
                {metrics.rating?.toFixed(1) || 'N/A'} ⭐
              </Text>
              <Text style={styles.metricLabel}>
                Based on {metrics.totalReviews || 0} reviews
              </Text>
            </View>

            <View style={styles.metricsGrid}>
              <View style={styles.metricBox}>
                <Text style={styles.metricBoxLabel}>Response Time</Text>
                <Text style={styles.metricBoxValue}>
                  {metrics.avgResponseTime || 'N/A'}
                </Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricBoxLabel}>Completion Rate</Text>
                <Text style={styles.metricBoxValue}>
                  {metrics.completionRate || 0}%
                </Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricBoxLabel}>On-Time Rate</Text>
                <Text style={styles.metricBoxValue}>
                  {metrics.onTimeRate || 0}%
                </Text>
              </View>
              <View style={styles.metricBox}>
                <Text style={styles.metricBoxLabel}>Cancellation Rate</Text>
                <Text style={styles.metricBoxValue}>
                  {metrics.cancellationRate || 0}%
                </Text>
              </View>
            </View>

            {metrics.trends && (
              <View style={styles.trendsCard}>
                <Text style={styles.sectionTitle}>Trends</Text>
                {Object.entries(metrics.trends).map(([key, value]: [string, any]) => (
                  <View key={key} style={styles.trendItem}>
                    <Text style={styles.trendLabel}>{key}</Text>
                    <Text style={styles.trendValue}>
                      {value > 0 ? '+' : ''}{value}%
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
  metricCard: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  metricTitle: {
    fontSize: typography.fontSizes.md,
    color: '#ffffff',
    marginBottom: spacing.sm,
  },
  metricValue: {
    fontSize: typography.fontSizes['3xl'],
    fontWeight: typography.fontWeights.bold,
    color: '#ffffff',
    marginBottom: spacing.xs,
  },
  metricLabel: {
    fontSize: typography.fontSizes.sm,
    color: '#ffffff',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  metricBox: {
    width: '48%',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    alignItems: 'center',
  },
  metricBoxLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
  },
  metricBoxValue: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  trendsCard: {
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
  trendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  trendLabel: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
  },
  trendValue: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
});

