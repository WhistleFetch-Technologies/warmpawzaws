/**
 * Booking Confirmation Screen - Mobile
 * Booking confirmation after creation
 * Identical functionality to web app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

interface BookingConfirmationScreenProps {
  bookingId: string;
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function BookingConfirmationScreen({
  bookingId,
  phone,
  customerId,
  onBack,
  onNavigate,
}: BookingConfirmationScreenProps) {
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookingDetails();
  }, [bookingId]);

  const loadBookingDetails = async () => {
    try {
      setLoading(true);
      const response = await CustomerApi.getBookingDetails(bookingId);
      setBooking(response.booking || response);
    } catch (error) {
      console.error('Error loading booking:', error);
      Alert.alert('Error', 'Failed to load booking details');
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

  if (!booking) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Booking not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Success Icon */}
        <View style={styles.successIconContainer}>
          <View style={styles.successIcon}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
        </View>

        {/* Success Message */}
        <Text style={styles.successTitle}>Booking Confirmed!</Text>
        <Text style={styles.successSubtitle}>
          Your booking has been confirmed successfully.
        </Text>

        {/* Booking Details */}
        <View style={styles.bookingDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Booking ID</Text>
            <Text style={styles.detailValue}>#{bookingId}</Text>
          </View>
          {booking.serviceName && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Service</Text>
              <Text style={styles.detailValue}>{booking.serviceName}</Text>
            </View>
          )}
          {booking.petName && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Pet</Text>
              <Text style={styles.detailValue}>{booking.petName}</Text>
            </View>
          )}
          {booking.appointmentDate && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>
                {new Date(booking.appointmentDate).toLocaleDateString()}
              </Text>
            </View>
          )}
          {booking.appointmentTime && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Time</Text>
              <Text style={styles.detailValue}>{booking.appointmentTime}</Text>
            </View>
          )}
          {booking.vendorName && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Vendor</Text>
              <Text style={styles.detailValue}>{booking.vendorName}</Text>
            </View>
          )}
          {booking.totalAmount && (
            <View style={[styles.detailRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>₹{booking.totalAmount.toLocaleString()}</Text>
            </View>
          )}
        </View>

        {/* Payment Status */}
        {booking.paymentStatus && (
          <View style={styles.paymentStatusCard}>
            <Text style={styles.paymentStatusLabel}>Payment Status</Text>
            <View style={[
              styles.paymentStatusBadge,
              booking.paymentStatus === 'paid' && styles.paymentStatusPaid,
            ]}>
              <Text style={[
                styles.paymentStatusText,
                booking.paymentStatus === 'paid' && styles.paymentStatusTextPaid,
              ]}>
                {booking.paymentStatus.toUpperCase()}
              </Text>
            </View>
          </View>
        )}

        {/* Next Steps */}
        <View style={styles.nextStepsCard}>
          <Text style={styles.nextStepsTitle}>What's Next?</Text>
          <View style={styles.nextStepItem}>
            <Text style={styles.nextStepIcon}>1️⃣</Text>
            <Text style={styles.nextStepText}>
              You'll receive a confirmation SMS shortly
            </Text>
          </View>
          <View style={styles.nextStepItem}>
            <Text style={styles.nextStepIcon}>2️⃣</Text>
            <Text style={styles.nextStepText}>
              Arrive 10 minutes before your appointment
            </Text>
          </View>
          <View style={styles.nextStepItem}>
            <Text style={styles.nextStepIcon}>3️⃣</Text>
            <Text style={styles.nextStepText}>
              You can track your booking in the app
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.viewBookingButton}
            onPress={() => onNavigate && onNavigate('BookingDetail', { bookingId })}
          >
            <Text style={styles.viewBookingButtonText}>View Booking Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.homeButton}
            onPress={() => onNavigate && onNavigate('Home')}
          >
            <Text style={styles.homeButtonText}>Go to Home</Text>
          </TouchableOpacity>
        </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  backButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  successIconContainer: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#16a34a',
  },
  checkIcon: {
    fontSize: 48,
    color: '#16a34a',
    fontWeight: 'bold',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  bookingDetails: {
    width: '100%',
    backgroundColor: '#fff',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.md,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  paymentStatusCard: {
    width: '100%',
    backgroundColor: '#fff',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentStatusLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  paymentStatusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: '#fee2e2',
  },
  paymentStatusPaid: {
    backgroundColor: '#dcfce7',
  },
  paymentStatusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  paymentStatusTextPaid: {
    color: '#16a34a',
  },
  nextStepsCard: {
    width: '100%',
    backgroundColor: '#fff',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nextStepsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  nextStepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  nextStepIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  nextStepText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  actions: {
    width: '100%',
    gap: spacing.md,
  },
  viewBookingButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  viewBookingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  homeButton: {
    backgroundColor: '#fff',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  homeButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
