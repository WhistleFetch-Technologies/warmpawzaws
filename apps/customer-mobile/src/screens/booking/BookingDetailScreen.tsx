/**
 * Booking Detail Screen - Customer Mobile App
 * View booking details with options to cancel or reschedule
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, publicAnonKey } from '../../config/api';
import PrescriptionService from '../../services/PrescriptionService';
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
  const { user } = useAuth();
  const bookingId = route?.params?.bookingId || '';
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<any>(null);
  const [prescription, setPrescription] = useState<any>(null);

  useEffect(() => {
    if (bookingId) {
      loadBookingDetails();
    }
  }, [bookingId]);

  const loadBookingDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/booking/${encodeURIComponent(bookingId)}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setBooking(data.booking || data);
        
        // Load prescription if exists
        const presc = await PrescriptionService.getPrescriptionByBooking(bookingId);
        if (presc) {
          setPrescription(presc);
        }
      } else {
        Alert.alert('Error', 'Failed to load booking details');
      }
    } catch (error) {
      console.error('Error loading booking:', error);
      Alert.alert('Error', 'Cannot connect to server');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return BrandColors.semantic.success;
      case 'pending':
        return BrandColors.semantic.warning;
      case 'cancelled':
        return BrandColors.semantic.error;
      case 'completed':
        return BrandColors.neutral.gray600;
      default:
        return BrandColors.neutral.gray400;
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
      <View style={styles.errorContainer}>
        <Icon name="error-outline" size={64} color={BrandColors.semantic.error} />
        <Text style={[Typography.h3, styles.errorText]}>Booking not found</Text>
        <BrandedButton
          title="Go Back"
          onPress={() => navigation?.goBack()}
          variant="primary"
          fullWidth
        />
      </View>
    );
  }

  const canCancel = ['pending', 'confirmed'].includes(booking.status);
  const canReschedule = ['pending', 'confirmed'].includes(booking.status);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.headerCard}>
          <View style={styles.statusRow}>
            <Text style={[Typography.h3, styles.bookingId]}>
              Booking #{bookingId.substring(0, 12)}...
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(booking.status) + '20' },
              ]}
            >
              <Text
                style={[Typography.bodySmall, { color: getStatusColor(booking.status) }]}
              >
                {booking.status.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={[Typography.bodySmall, styles.dateText]}>
            {booking.scheduledDate} at {booking.scheduledTime}
          </Text>
        </View>

        {/* Service Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="business-center" size={24} color={BrandColors.primary.orange} />
            <Text style={[Typography.h4, styles.sectionTitle]}>Service</Text>
          </View>
          <Text style={[Typography.body, styles.infoText]}>
            {booking.serviceName || 'N/A'}
          </Text>
          <Text style={[Typography.bodySmall, styles.infoSubtext]}>
            ₹{booking.amount || booking.price || 0}
          </Text>
        </View>

        {/* Vendor Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="store" size={24} color={BrandColors.primary.orange} />
            <Text style={[Typography.h4, styles.sectionTitle]}>Provider</Text>
          </View>
          <Text style={[Typography.body, styles.infoText]}>
            {booking.vendorName || 'N/A'}
          </Text>
        </View>

        {/* Pet Info */}
        {booking.petName && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="pets" size={24} color={BrandColors.primary.orange} />
              <Text style={[Typography.h4, styles.sectionTitle]}>Pet</Text>
            </View>
            <Text style={[Typography.body, styles.infoText]}>{booking.petName}</Text>
            {booking.petBreed && (
              <Text style={[Typography.bodySmall, styles.infoSubtext]}>
                {booking.petBreed}
              </Text>
            )}
          </View>
        )}

        {/* Address */}
        {booking.address && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="place" size={24} color={BrandColors.primary.orange} />
              <Text style={[Typography.h4, styles.sectionTitle]}>Address</Text>
            </View>
            <Text style={[Typography.body, styles.infoText]}>{booking.address}</Text>
          </View>
        )}

        {/* Prescription */}
        {prescription && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="description" size={24} color={BrandColors.primary.orange} />
              <Text style={[Typography.h4, styles.sectionTitle]}>Prescription</Text>
            </View>
            <TouchableOpacity
              style={styles.prescriptionCard}
              onPress={() =>
                navigation?.navigate('PrescriptionView', { prescriptionId: prescription.id })
              }
            >
              <Text style={[Typography.body, styles.prescriptionText]}>
                View Prescription
              </Text>
              <Icon name="chevron-right" size={24} color={BrandColors.neutral.gray400} />
            </TouchableOpacity>
          </View>
        )}

        {/* Actions */}
        {(canCancel || canReschedule) && (
          <View style={styles.actionsContainer}>
            {canReschedule && (
              <BrandedButton
                title="Reschedule"
                onPress={() =>
                  navigation?.navigate('Reschedule', {
                    bookingId,
                    booking,
                  })
                }
                variant="secondary"
                fullWidth
              />
            )}
            {canCancel && (
              <BrandedButton
                title="Cancel Booking"
                onPress={() =>
                  navigation?.navigate('Cancellation', {
                    bookingId,
                    booking,
                  })
                }
                variant="destructive"
                fullWidth
              />
            )}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    color: BrandColors.semantic.error,
    marginTop: Spacing.base,
    marginBottom: Spacing.xl,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
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
  prescriptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  prescriptionText: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  actionsContainer: {
    padding: Spacing.lg,
    gap: Spacing.base,
  },
});

