/**
 * Data Export Screen
 * Export data functionality
 * Batch 3 - Screen 5
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { DataExportApi } from '../../services/api';

interface DataExportScreenProps {
  vendorId: string;
  onBack?: () => void;
}

export function DataExportScreen({ vendorId, onBack }: DataExportScreenProps) {
  const [exporting, setExporting] = useState<string | null>(null);

  const exportTypes = [
    { id: 'earnings', label: 'Earnings Data', description: 'Export all earnings records' },
    { id: 'bookings', label: 'Bookings Data', description: 'Export booking history' },
    { id: 'payouts', label: 'Payouts Data', description: 'Export payout history' },
    { id: 'transactions', label: 'Transactions', description: 'Export transaction history' },
    { id: 'reports', label: 'Reports', description: 'Export all reports' },
  ];

  const handleExport = async (exportType: string) => {
    setExporting(exportType);
    try {
      // ✅ API Integration: Use correct API signature (vendorId, format, dataType, dateRange?)
      const response = await DataExportApi.exportData(vendorId, 'csv', exportType);
      
      if (response.fileUrl) {
        // Download and share file
        const fileUri = FileSystem.documentDirectory + `${exportType}_${Date.now()}.csv`;
        const downloadResult = await FileSystem.downloadAsync(response.fileUrl, fileUri);
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadResult.uri);
          Alert.alert('Success', 'Data exported and shared successfully!');
        } else {
          Alert.alert('Success', 'Data exported successfully!');
        }
      } else {
        Alert.alert('Error', 'Failed to export data');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to export data');
    } finally {
      setExporting(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Export Data</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.description}>
          Export your data in CSV format for analysis or record keeping.
        </Text>

        {exportTypes.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={styles.exportCard}
            onPress={() => handleExport(type.id)}
            disabled={exporting !== null}
          >
            <View style={styles.exportCardContent}>
              <Text style={styles.exportLabel}>{type.label}</Text>
              <Text style={styles.exportDescription}>{type.description}</Text>
            </View>
            {exporting === type.id ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.exportIcon}>📥</Text>
            )}
          </TouchableOpacity>
        ))}
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
  description: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  exportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  exportCardContent: {
    flex: 1,
  },
  exportLabel: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  exportDescription: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  exportIcon: {
    fontSize: 24,
    marginLeft: spacing.md,
  },
});

