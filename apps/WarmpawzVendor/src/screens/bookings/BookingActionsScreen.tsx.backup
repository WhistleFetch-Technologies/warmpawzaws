/**
 * Booking Actions Screen
 * Combined booking actions hub
 * Batch 1 - Screen 10
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { BookingDetailScreen } from './BookingDetailScreen';

interface BookingActionsScreenProps {
  bookingId: string;
  vendorId: string;
  bookingData?: any;
  onBack?: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function BookingActionsScreen({
  bookingId,
  vendorId,
  bookingData,
  onBack,
  onNavigate,
}: BookingActionsScreenProps) {
  const handleAction = (action: string) => {
    if (onNavigate) {
      onNavigate(action, { bookingId, vendorId, bookingData });
    }
  };

  const actions = [
    {
      id: 'detail',
      label: 'View Details',
      icon: '📋',
      screen: 'BookingDetail',
      color: colors.info,
    },
    {
      id: 'assign-staff',
      label: 'Assign Staff',
      icon: '👥',
      screen: 'StaffAssignment',
      color: colors.primary,
      available: bookingData?.status === 'pending' || bookingData?.status === 'confirmed',
    },
    {
      id: 'check-in',
      label: 'Check In',
      icon: '✅',
      screen: 'CheckIn',
      color: colors.success,
      available: bookingData?.status === 'confirmed' && 
                 (bookingData?.serviceType === 'boarding' || bookingData?.serviceType === 'resort'),
    },
    {
      id: 'start-service',
      label: 'Start Service',
      icon: '▶️',
      screen: 'StartService',
      color: colors.primary,
      available: bookingData?.status === 'confirmed',
    },
    {
      id: 'gps-tracking',
      label: 'GPS Tracking',
      icon: '📍',
      screen: 'GPSTracking',
      color: colors.info,
      available: bookingData?.serviceType === 'walking' || bookingData?.serviceType === 'home',
    },
    {
      id: 'upload-file',
      label: 'Upload Prescription',
      icon: '📄',
      screen: 'FileUpload',
      color: colors.warning,
      available: bookingData?.status === 'in_progress' || bookingData?.status === 'completed',
    },
    {
      id: 'complete',
      label: 'Complete Booking',
      icon: '✓',
      screen: 'BookingCompletion',
      color: colors.success,
      available: bookingData?.status === 'confirmed' || bookingData?.status === 'in_progress',
    },
  ];

  const availableActions = actions.filter((action) => action.available !== false);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Booking Actions</Text>
        {bookingData && (
          <Text style={styles.subtitle}>
            Booking ID: {bookingId} • Status: {bookingData.status}
          </Text>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {availableActions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={[styles.actionCard, { borderLeftColor: action.color }]}
            onPress={() => handleAction(action.screen)}
          >
            <Text style={styles.actionIcon}>{action.icon}</Text>
            <View style={styles.actionInfo}>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </View>
            <Text style={styles.actionArrow}>→</Text>
          </TouchableOpacity>
        ))}

        {availableActions.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No actions available for this booking</Text>
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
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  content: {
    padding: spacing.lg,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  actionIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  actionInfo: {
    flex: 1,
  },
  actionLabel: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
  },
  actionArrow: {
    fontSize: typography.fontSizes.lg,
    color: colors.textSecondary,
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

