/**
 * Reports Screen
 * Analytics and reports
 * Batch 3 - Screen 4
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
import { ReportsApi } from '../../services/api';

interface ReportsScreenProps {
  vendorId: string;
  onBack?: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function ReportsScreen({ vendorId, onBack, onNavigate }: ReportsScreenProps) {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    loadReports();
  }, [vendorId, selectedPeriod]);

  const loadReports = async () => {
    try {
      setLoading(true);
      // Get report history first
      const historyResponse = await ReportsApi.getReportHistory(vendorId, 20);
      if (historyResponse.reports && historyResponse.reports.length > 0) {
        setReports(historyResponse.reports);
      } else {
        // Generate new report for the selected period
        const startDate = new Date();
        const endDate = new Date();
        if (selectedPeriod === 'week') {
          startDate.setDate(startDate.getDate() - 7);
        } else if (selectedPeriod === 'month') {
          startDate.setMonth(startDate.getMonth() - 1);
        } else if (selectedPeriod === 'year') {
          startDate.setFullYear(startDate.getFullYear() - 1);
        }
        
        const response = await ReportsApi.generateReport(vendorId, 'summary', {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });
        // If generateReport returns the report, use it; otherwise fetch all reports
        if (response.report) {
          setReports([response.report]);
        } else {
          const allReports = await ReportsApi.getReports(vendorId);
          setReports(allReports.reports || []);
        }
      }
    } catch (error) {
      console.error('Error loading reports:', error);
      // Fallback: try to get all reports
      try {
        const allReports = await ReportsApi.getReports(vendorId);
        setReports(allReports.reports || []);
      } catch (fallbackError) {
        console.error('Error loading reports (fallback):', fallbackError);
        setReports([]);
      }
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
        <Text style={styles.title}>Reports</Text>
      </View>

      <View style={styles.periodSelector}>
        {(['week', 'month', 'year'] as const).map((p) => (
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
        {reports.map((report, index) => (
          <TouchableOpacity
            key={index}
            style={styles.reportCard}
            onPress={() => {
              if (onNavigate) {
                onNavigate('ReportDetail', { reportId: report.id });
              }
            }}
          >
            <Text style={styles.reportTitle}>{report.title}</Text>
            <Text style={styles.reportDate}>
              {new Date(report.date).toLocaleDateString()}
            </Text>
            {report.summary && (
              <View style={styles.reportSummary}>
                <Text style={styles.reportSummaryText}>{report.summary}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {onNavigate && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onNavigate('DataExport')}
            >
              <Text style={styles.actionButtonText}>Export Data</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onNavigate('PerformanceMetrics')}
            >
              <Text style={styles.actionButtonText}>Performance Metrics</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onNavigate('RevenueAnalytics')}
            >
              <Text style={styles.actionButtonText}>Revenue Analytics</Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: colors.primary.50,
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
  reportCard: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  reportTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  reportDate: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  reportSummary: {
    marginTop: spacing.sm,
  },
  reportSummaryText: {
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

