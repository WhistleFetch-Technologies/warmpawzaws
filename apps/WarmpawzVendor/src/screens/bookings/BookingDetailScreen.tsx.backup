/**
 * Booking Detail Screen
 * Full booking details with actions
 * Batch 1 - Screen 2
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { AppointmentDetailApi } from '../../services/api';
import { BookingCompletionScreen } from './BookingCompletionScreen';
import { canAcceptRejectBookings, canAssignStaff } from '../../utils/permissions';

interface BookingDetailScreenProps {
  bookingId: string;
  vendorId?: string;
  staffId?: string;
  session?: any;
  onBack?: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function BookingDetailScreen({
  bookingId,
  vendorId,
  staffId,
  session,
  onBack,
  onNavigate,
}: BookingDetailScreenProps) {
  const canAcceptReject = canAcceptRejectBookings(session || {});
  const canAssign = canAssignStaff(session || {});
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<any>(null);
  const [showComplete, setShowComplete] = useState(false);

  useEffect(() => {
    loadBookingDetails();
  }, [bookingId]);

  const loadBookingDetails = async () => {
    try {
      setLoading(true);
      const response = await AppointmentDetailApi.getBookingDetails(bookingId);
      setBooking(response.booking || response);
    } catch (error) {
      console.error('Error loading booking details:', error);
      Alert.alert('Error', 'Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    setShowComplete(true);
  };

  const handleAssignStaff = () => {
    if (onNavigate) {
      onNavigate('StaffAssignment', { bookingId, vendorId });
    }
  };

  const handleCheckIn = () => {
    if (onNavigate) {
      onNavigate('CheckIn', { bookingId, vendorId });
    }
  };

  const handleStartService = () => {
    if (onNavigate) {
      onNavigate('StartService', { bookingId, vendorId });
    }
  };

  if (showComplete) {
    return (
      <BookingCompletionScreen
        bookingId={bookingId}
        vendorId={vendorId}
        bookingData={booking}
        onComplete={(completedBooking) => {
          setBooking(completedBooking);
          setShowComplete(false);
        }}
        onBack={() => setShowComplete(false)}
      />
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Booking not found</Text>
          {onBack && (
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const canComplete = booking.status === 'confirmed' || booking.status === 'in_progress';
  const canAssignStaffToBooking = booking.status === 'pending' || booking.status === 'confirmed';
  const canCheckIn = booking.status === 'confirmed';
  const canStartService = booking.status === 'confirmed';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Booking Details</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Booking Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Booking ID:</Text>
            <Text style={styles.infoValue}>{booking.id || bookingId}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status:</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>
                {booking.status?.toUpperCase() || 'UNKNOWN'}
              </Text>
            </View>
          </View>
          {booking.customerName && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Customer:</Text>
              <Text style={styles.infoValue}>{booking.customerName}</Text>
            </View>
          )}
          {booking.serviceName && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Service:</Text>
              <Text style={styles.infoValue}>{booking.serviceName}</Text>
            </View>
          )}
          {booking.scheduledDate && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date:</Text>
              <Text style={styles.infoValue}>
                {new Date(booking.scheduledDate).toLocaleDateString()}
              </Text>
            </View>
          )}
          {booking.scheduledTime && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Time:</Text>
              <Text style={styles.infoValue}>{booking.scheduledTime}</Text>
            </View>
          )}
          {booking.amount && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Amount:</Text>
              <Text style={[styles.infoValue, styles.amountText]}>₹{booking.amount}</Text>
            </View>
          )}
        </View>

        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Actions</Text>
          
          {canAssign && canAssignStaffToBooking && (
            <TouchableOpacity style={styles.actionButton} onPress={handleAssignStaff}>
              <Text style={styles.actionButtonText}>Assign Staff</Text>
            </TouchableOpacity>
          )}

          {canCheckIn && (
            <TouchableOpacity style={styles.actionButton} onPress={handleCheckIn}>
              <Text style={styles.actionButtonText}>Check In</Text>
            </TouchableOpacity>
          )}

          {canStartService && (
            <TouchableOpacity style={styles.actionButton} onPress={handleStartService}>
              <Text style={styles.actionButtonText}>Start Service</Text>
            </TouchableOpacity>
          )}

          {canComplete && (
            <TouchableOpacity
              style={[styles.actionButton, styles.completeButton]}
              onPress={handleComplete}
            >
              <Text style={[styles.actionButtonText, styles.completeButtonText]}>
                Complete Booking
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'confirmed':
    case 'in_progress':
      return colors.success;
    case 'completed':
      return colors.info;
    case 'cancelled':
      return colors.error;
    default:
      return colors.warning;
  }
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
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorText: {
    fontSize: typography.fontSizes.md,
    color: colors.error,
    marginBottom: spacing.md,
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
  section: {
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
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  infoLabel: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
  },
  amountText: {
    color: colors.primary,
    fontWeight: typography.fontWeights.semibold,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.md,
  },
  statusText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.medium,
  },
  actionsSection: {
    marginTop: spacing.md,
  },
  actionButton: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
  },
  completeButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  completeButtonText: {
    color: '#ffffff',
  },
});

