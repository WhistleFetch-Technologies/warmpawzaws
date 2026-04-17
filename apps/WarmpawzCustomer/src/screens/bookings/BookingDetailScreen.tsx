/**
 * Booking Detail Screen - Mobile
 * View detailed booking information with actions
 * Identical functionality to web app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Clipboard,
} from 'react-native';
import { ScreenShell } from '../../components/layout/ScreenShell';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

interface BookingDetailScreenProps {
  bookingId: string;
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onReschedule?: (bookingId: string) => void;
  onCancel?: (bookingId: string) => void;
}

export function BookingDetailScreen({
  bookingId,
  phone,
  onBack,
  onNavigate,
  onReschedule,
  onCancel,
}: BookingDetailScreenProps) {
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedOtp, setCopiedOtp] = useState<string | null>(null);

  useEffect(() => {
    loadBookingDetails();
  }, [bookingId]);

  const loadBookingDetails = async () => {
    try {
      setLoading(true);
      const response = await CustomerApi.getBookingDetails(bookingId);
      setBooking(response.booking || response);
    } catch (error) {
      console.error('Error loading booking details:', error);
      Alert.alert('Error', 'Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyOtp = (otp: string) => {
    Clipboard.setString(otp);
    setCopiedOtp(otp);
    Alert.alert('Copied', 'OTP copied to clipboard');
    setTimeout(() => setCopiedOtp(null), 2000);
  };

  const handleReschedule = () => {
    if (onReschedule) {
      onReschedule(bookingId);
    } else if (onNavigate) {
      onNavigate('RescheduleBooking', {
        bookingId,
        currentDate: booking?.date || booking?.appointmentDate,
        currentTime: booking?.time || booking?.timeSlot,
      });
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel(bookingId);
    } else if (onNavigate) {
      onNavigate('CancelBooking', {
        bookingId,
        bookingData: {
          date: booking?.date || booking?.appointmentDate,
          time: booking?.time || booking?.timeSlot,
          price: booking?.price || booking?.amount,
        },
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '#3B82F6';
      case 'in_progress':
      case 'active':
        return colors.success;
      case 'completed':
        return '#6B7280';
      case 'cancelled':
      case 'cancelled_by_customer':
      case 'cancelled_by_vendor':
        return '#EF4444';
      default:
        return '#F59E0B';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const serviceStyle = String(
    booking?.service_style || booking?.serviceStyle || booking?.service_type || booking?.serviceType || ''
  ).toLowerCase();
  const isTeleService = ['tele', 'video_consultation', 'teleconsultation', 'video'].includes(serviceStyle);

  const handleJoinVideo = () => {
    if (onNavigate) {
      onNavigate('VideoConsultation', { bookingId });
    }
  };

  if (loading) {
    return (
      <ScreenShell style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading booking details...</Text>
        </View>
      </ScreenShell>
    );
  }

  if (!booking) {
    return (
      <ScreenShell style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Booking Details</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Booking not found</Text>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Details</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(booking.status) + '20' },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(booking.status) },
              ]}
            >
              {booking.status === 'in_progress'
                ? 'In Progress'
                : booking.status.charAt(0).toUpperCase() +
                  booking.status.slice(1)}
            </Text>
          </View>
          <Text style={styles.bookingId}>
            Booking #{booking.id?.slice(0, 8) || bookingId.slice(0, 8)}
          </Text>
        </View>

        {/* Start OTP Section */}
        {booking.requiresStartOTP &&
          booking.startOTP &&
          booking.status === 'confirmed' && (
            <View style={styles.otpCard}>
              <View style={styles.otpHeader}>
                <Text style={styles.otpIcon}>▶️</Text>
                <View>
                  <Text style={styles.otpTitle}>Service Start OTP</Text>
                  <Text style={styles.otpSubtitle}>
                    Share with vendor to START service
                  </Text>
                </View>
              </View>
              <View style={styles.otpDisplay}>
                <Text style={styles.otpCode}>{booking.startOTP}</Text>
              </View>
              <TouchableOpacity
                style={styles.otpButton}
                onPress={() => handleCopyOtp(booking.startOTP)}
              >
                <Text style={styles.otpButtonText}>
                  {copiedOtp === booking.startOTP ? '✓ Copied!' : 'Copy Start OTP'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

        {/* Completion OTP Section */}
        {booking.requiresOTP &&
          booking.completionOTP &&
          booking.status !== 'completed' &&
          booking.status !== 'cancelled' &&
          (!booking.requiresStartOTP ||
            booking.status === 'in_progress' ||
            booking.status === 'active') && (
            <View style={[styles.otpCard, styles.completionOtpCard]}>
              <View style={styles.otpHeader}>
                <Text style={styles.otpIcon}>🔐</Text>
                <View>
                  <Text style={styles.otpTitle}>Service Completion OTP</Text>
                  <Text style={styles.otpSubtitle}>
                    Share with vendor to END service
                  </Text>
                </View>
              </View>
              <View style={styles.otpDisplay}>
                <Text style={styles.otpCode}>{booking.completionOTP}</Text>
              </View>
              <TouchableOpacity
                style={[styles.otpButton, styles.completionOtpButton]}
                onPress={() => handleCopyOtp(booking.completionOTP)}
              >
                <Text style={styles.otpButtonText}>
                  {copiedOtp === booking.completionOTP
                    ? '✓ Copied!'
                    : 'Copy OTP'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.otpWarning}>
                ⚠️ Keep this OTP safe. The vendor will enter this to mark your
                service as complete.
              </Text>
            </View>
          )}

        {/* OTP Verified Badge */}
        {booking.status === 'completed' && booking.otpVerifiedAt && (
          <View style={styles.verifiedCard}>
            <Text style={styles.verifiedIcon}>✓</Text>
            <View style={styles.verifiedInfo}>
              <Text style={styles.verifiedTitle}>Service Completed</Text>
              <Text style={styles.verifiedText}>
                Verified on {formatDate(booking.otpVerifiedAt)} at{' '}
                {formatTime(booking.otpVerifiedAt)}
              </Text>
            </View>
          </View>
        )}

        {/* Service Information */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Service Information</Text>
          <View style={styles.serviceItem}>
            <View style={styles.serviceIcon}>
              <Text style={styles.serviceIconText}>
                {booking.serviceType === 'walker'
                  ? '🐕'
                  : booking.serviceType === 'grooming'
                  ? '✂️'
                  : booking.serviceType === 'vet'
                  ? '🏥'
                  : booking.serviceType === 'boarding'
                  ? '🏠'
                  : '🐾'}
              </Text>
            </View>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>
                {booking.serviceName || 'Service'}
              </Text>
              <Text style={styles.serviceDetails}>
                {booking.duration ? `${booking.duration} min` : ''}
                {booking.serviceStyle &&
                  ` • ${booking.serviceStyle.replace('_', ' ')}`}
              </Text>
            </View>
            <Text style={styles.servicePrice}>₹{booking.price ?? booking.amount ?? booking.totalAmount ?? 0}</Text>
          </View>
        </View>

        {/* Pet Information */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Pet Information</Text>
          <View style={styles.petItem}>
            <View style={styles.petIcon}>
              <Text style={styles.petIconText}>🐾</Text>
            </View>
            <View style={styles.petInfo}>
              <Text style={styles.petName}>
                {booking.petName || 'Pet Name'}
              </Text>
              <Text style={styles.petDetails}>
                {booking.petBreed || 'Breed'} • {booking.petAge || 'Age'}
              </Text>
            </View>
          </View>
        </View>

        {/* Vendor Information */}
        {booking.vendorName && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Vendor Information</Text>
            <View style={styles.vendorItem}>
              <View style={styles.vendorIcon}>
                <Text style={styles.vendorIconText}>🏪</Text>
              </View>
              <View style={styles.vendorInfo}>
                <Text style={styles.vendorName}>{booking.vendorName}</Text>
                {booking.vendorAddress && (
                  <Text style={styles.vendorAddress}>
                    {booking.vendorAddress}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {booking.vendorName && onNavigate && (
          <TouchableOpacity
            style={styles.chatCardButton}
            onPress={() =>
              onNavigate('Chat', {
                bookingId,
                recipientName: booking.vendorName,
              })
            }
          >
            <Text style={styles.chatCardButtonIcon}>💬</Text>
            <Text style={styles.chatCardButtonText}>Message provider</Text>
          </TouchableOpacity>
        )}

        {/* Date & Time Information */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Date & Time</Text>
          <View style={styles.dateTimeItem}>
            <Text style={styles.dateTimeIcon}>📅</Text>
            <View style={styles.dateTimeInfo}>
              <Text style={styles.dateTimeLabel}>Date</Text>
              <Text style={styles.dateTimeValue}>
                {formatDate(booking.date || booking.appointmentDate)}
              </Text>
            </View>
          </View>
          {booking.time && (
            <View style={styles.dateTimeItem}>
              <Text style={styles.dateTimeIcon}>🕐</Text>
              <View style={styles.dateTimeInfo}>
                <Text style={styles.dateTimeLabel}>Time</Text>
                <Text style={styles.dateTimeValue}>
                  {booking.time || formatTime(booking.appointmentDate)}
                </Text>
              </View>
            </View>
          )}
          {booking.address && (
            <View style={styles.dateTimeItem}>
              <Text style={styles.dateTimeIcon}>📍</Text>
              <View style={styles.dateTimeInfo}>
                <Text style={styles.dateTimeLabel}>Address</Text>
                <Text style={styles.dateTimeValue}>{booking.address}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Actions */}
        {booking.status !== 'completed' &&
          booking.status !== 'cancelled' && (
            <View style={styles.actionsContainer}>
              {isTeleService && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.videoCallButton]}
                  onPress={handleJoinVideo}
                >
                  <Text style={[styles.actionButtonText, styles.videoCallButtonText]}>Join Video Call</Text>
                </TouchableOpacity>
              )}
              {booking.status === 'confirmed' && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleReschedule}
                >
                  <Text style={styles.actionButtonText}>Reschedule</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={handleCancel}
              >
                <Text
                  style={[styles.actionButtonText, styles.cancelButtonText]}
                >
                  Cancel Booking
                </Text>
              </TouchableOpacity>
            </View>
          )}

        {/* Notes */}
        {booking.notes && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{booking.notes}</Text>
          </View>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  backButton: {
    fontSize: typography.body,
    color: colors.white,
    marginRight: spacing.md,
  },
  headerTitle: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: colors.white,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: typography.body,
    fontWeight: 'bold',
  },
  bookingId: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  otpCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.success,
  },
  completionOtpCard: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  otpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  otpIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  otpTitle: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: '#065F46',
    marginBottom: spacing.xs,
  },
  otpSubtitle: {
    fontSize: typography.caption,
    color: '#047857',
  },
  otpDisplay: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  otpCode: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.success,
    letterSpacing: 8,
    fontFamily: 'monospace',
  },
  otpButton: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  completionOtpButton: {
    backgroundColor: '#F59E0B',
  },
  otpButtonText: {
    color: colors.white,
    fontSize: typography.body,
    fontWeight: 'bold',
  },
  otpWarning: {
    fontSize: typography.caption,
    color: '#92400E',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  verifiedCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.success,
  },
  verifiedIcon: {
    fontSize: 24,
    color: colors.success,
    marginRight: spacing.md,
  },
  verifiedInfo: {
    flex: 1,
  },
  verifiedTitle: {
    fontSize: typography.body,
    fontWeight: 'bold',
    color: '#065F46',
    marginBottom: spacing.xs,
  },
  verifiedText: {
    fontSize: typography.caption,
    color: '#047857',
  },
  sectionCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  sectionTitle: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.error + 20% opacity,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  serviceIconText: {
    fontSize: 24,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  serviceDetails: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  servicePrice: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.primary,
  },
  petItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  petIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  petIconText: {
    fontSize: 24,
  },
  petInfo: {
    flex: 1,
  },
  petName: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  petDetails: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  vendorItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vendorIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  vendorIconText: {
    fontSize: 24,
  },
  vendorInfo: {
    flex: 1,
  },
  chatCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  chatCardButtonIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  chatCardButtonText: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.primary,
  },
  vendorName: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  vendorAddress: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  dateTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dateTimeIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  dateTimeInfo: {
    flex: 1,
  },
  dateTimeLabel: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  dateTimeValue: {
    fontSize: typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  videoCallButton: {
    backgroundColor: colors.primary + '10',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  cancelButton: {
    backgroundColor: colors.error + 20% opacity,
  },
  actionButtonText: {
    color: colors.white,
    fontSize: typography.body,
    fontWeight: 'bold',
  },
  videoCallButtonText: {
    color: colors.primary,
  },
  cancelButtonText: {
    color: '#EF4444',
  },
  notesText: {
    fontSize: typography.body,
    color: colors.text,
    lineHeight: 20,
  },
});
