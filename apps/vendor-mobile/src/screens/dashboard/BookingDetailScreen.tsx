/**
 * Booking Detail Screen - Vendor Mobile App
 * View and manage individual booking details
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, publicAnonKey } from '../../config/api';
import NotificationService from '../../services/NotificationService';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface BookingDetailScreenProps {
  route?: {
    params?: {
      bookingId: string;
    };
  };
  navigation?: any;
}

export default function BookingDetailScreen({
  route,
  navigation,
}: BookingDetailScreenProps) {
  const bookingId = route?.params?.bookingId;
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<any>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (bookingId) {
      fetchBookingDetails();
    }
  }, [bookingId]);

  const fetchBookingDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/booking/${bookingId}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setBooking(data.booking || data);
      } else {
        throw new Error('Failed to fetch booking details');
      }
    } catch (error) {
      console.error('Error fetching booking:', error);
      Alert.alert('Error', 'Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    try {
      setUpdating(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/booking/${bookingId}/update`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ status }),
        }
      );

      if (response.ok) {
        // Send notification based on status
        if (status === 'confirmed') {
          NotificationService.showLocalNotification({
            type: 'booking',
            title: 'Booking Confirmed',
            message: `You confirmed booking ${bookingId}`,
            bookingId,
            action: 'view_booking',
          });
        } else if (status === 'completed') {
          NotificationService.showLocalNotification({
            type: 'booking',
            title: 'Service Completed',
            message: `Booking ${bookingId} marked as completed`,
            bookingId,
            action: 'view_booking',
          });
        }

        Alert.alert('Success', `Booking ${status} successfully`);
        fetchBookingDetails();
        if (navigation) {
          navigation.goBack();
        }
      } else {
        throw new Error('Failed to update booking');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update booking status');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Loading booking details...
        </Text>
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.emptyContainer}>
          <Icon name="error-outline" size={48} color={BrandColors.neutral.gray400} />
          <Text style={[Typography.body, styles.emptyText]}>
            Booking not found
          </Text>
        </View>
      </View>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return BrandColors.semantic.success;
      case 'pending':
        return BrandColors.semantic.warning;
      case 'cancelled':
        return BrandColors.semantic.error;
      default:
        return BrandColors.neutral.gray500;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.statusRow}>
            <Text style={[Typography.h3, styles.bookingId]}>
              Booking #{booking.id || bookingId}
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(booking.status) + '20' },
              ]}
            >
              <Text
                style={[
                  Typography.bodyTiny,
                  { color: getStatusColor(booking.status) },
                ]}
              >
                {booking.status?.toUpperCase() || 'PENDING'}
              </Text>
            </View>
          </View>
          <Text style={[Typography.bodySmall, styles.dateText]}>
            {booking.date || booking.createdAt
              ? new Date(booking.date || booking.createdAt).toLocaleDateString()
              : 'Date not available'}
          </Text>
        </View>

        {/* Customer Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="person" size={24} color={BrandColors.primary.orange} />
            <Text style={[Typography.h4, styles.sectionTitle]}>Customer</Text>
          </View>
          <Text style={[Typography.body, styles.infoText]}>
            {booking.customerName || booking.customer?.name || 'N/A'}
          </Text>
          <Text style={[Typography.bodySmall, styles.infoSubtext]}>
            {booking.customerPhone || booking.customer?.phone || ''}
          </Text>
        </View>

        {/* Service Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="business-center" size={24} color={BrandColors.primary.orange} />
            <Text style={[Typography.h4, styles.sectionTitle]}>Service</Text>
          </View>
          <Text style={[Typography.body, styles.infoText]}>
            {booking.serviceName || booking.service?.name || 'N/A'}
          </Text>
          <Text style={[Typography.bodySmall, styles.infoSubtext]}>
            ₹{booking.price || booking.amount || 0}
          </Text>
        </View>

        {/* Time Slot */}
        {booking.timeSlot && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="schedule" size={24} color={BrandColors.primary.orange} />
              <Text style={[Typography.h4, styles.sectionTitle]}>Time</Text>
            </View>
            <Text style={[Typography.body, styles.infoText]}>
              {booking.timeSlot}
            </Text>
          </View>
        )}

        {/* Location */}
        {booking.address && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="place" size={24} color={BrandColors.primary.orange} />
              <Text style={[Typography.h4, styles.sectionTitle]}>Location</Text>
            </View>
            <Text style={[Typography.body, styles.infoText]}>
              {booking.address}
            </Text>
          </View>
        )}

        {/* Actions */}
        {booking.status === 'pending' && (
          <View style={styles.actionsContainer}>
            <BrandedButton
              title={updating ? 'Updating...' : 'Accept Booking'}
              onPress={() => handleUpdateStatus('confirmed')}
              disabled={updating}
              loading={updating}
              fullWidth
              variant="primary"
            />
            <BrandedButton
              title="Reject Booking"
              onPress={() => {
                Alert.alert(
                  'Reject Booking',
                  'Are you sure you want to reject this booking?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Reject',
                      style: 'destructive',
                      onPress: () => handleUpdateStatus('cancelled'),
                    },
                  ]
                );
              }}
              disabled={updating}
              fullWidth
              variant="destructive"
            />
          </View>
        )}

        {booking.status === 'confirmed' && (
          <View style={styles.actionsContainer}>
            {booking.serviceStyle === 'at_home' || booking.serviceType === 'home' ? (
              <BrandedButton
                title="Start Service & GPS Tracking"
                onPress={() => {
                  navigation?.navigate('StartService', {
                    bookingId: bookingId || '',
                    booking: booking,
                  });
                }}
                disabled={updating}
                fullWidth
                variant="primary"
              />
            ) : null}
            <BrandedButton
              title="Mark as Completed"
              onPress={() => handleUpdateStatus('completed')}
              disabled={updating}
              loading={updating}
              fullWidth
            />
          </View>
        )}

        {/* Prescription Builder (for vets) */}
        {(booking.status === 'completed' || booking.status === 'confirmed') && 
         (booking.vendorType === 'vet' || booking.serviceType === 'vet' || booking.serviceType === 'veterinary') && (
          <View style={styles.actionsContainer}>
            <BrandedButton
              title="Create Prescription"
              onPress={() => {
                navigation?.navigate('PrescriptionBuilder', {
                  bookingId: bookingId || '',
                  booking: booking,
                });
              }}
              fullWidth
              variant="secondary"
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyText: {
    color: BrandColors.neutral.gray600,
    marginTop: Spacing.base,
  },
  scrollView: {
    flex: 1,
  },
  headerCard: {
    backgroundColor: BrandColors.primary.orange + '10',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  bookingId: {
    color: BrandColors.neutral.gray900,
  },
  statusBadge: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  dateText: {
    color: BrandColors.neutral.gray600,
  },
  section: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  sectionTitle: {
    color: BrandColors.neutral.gray900,
  },
  infoText: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  infoSubtext: {
    color: BrandColors.neutral.gray600,
  },
  actionsContainer: {
    padding: Spacing.lg,
    gap: Spacing.base,
  },
});

