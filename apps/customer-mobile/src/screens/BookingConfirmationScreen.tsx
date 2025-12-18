/**
 * Booking Confirmation Screen - Customer Mobile App
 * Booking confirmation and next steps
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import NotificationService from '../../services/NotificationService';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface BookingConfirmationScreenProps {
  route?: {
    params?: {
      bookingId?: string;
      bookingData?: any;
    };
  };
  navigation?: any;
}

export default function BookingConfirmationScreen({
  route,
  navigation,
}: BookingConfirmationScreenProps) {
  const bookingId = route?.params?.bookingId;
  const bookingData = route?.params?.bookingData;

  React.useEffect(() => {
    // Send booking confirmation notification
    if (bookingId) {
      NotificationService.showLocalNotification({
        type: 'booking',
        title: 'Booking Confirmed!',
        message: `Your booking has been confirmed. Booking ID: ${bookingId}`,
        bookingId,
        action: bookingData?.serviceType === 'home' ? 'track_service' : 'view_booking',
        data: {
          serviceType: bookingData?.serviceType,
          scheduledDate: bookingData?.scheduledDate,
          scheduledTime: bookingData?.scheduledTime,
        },
      });

      // Schedule reminder notification (1 hour before)
      if (bookingData?.scheduledDate && bookingData?.scheduledTime) {
        const [hours, minutes] = bookingData.scheduledTime.split(':');
        const reminderDate = new Date(bookingData.scheduledDate);
        reminderDate.setHours(parseInt(hours) - 1, parseInt(minutes), 0, 0);
        
        if (reminderDate > new Date()) {
          NotificationService.scheduleNotification(
            {
              type: 'reminder',
              title: 'Booking Reminder',
              message: `Your booking is in 1 hour at ${bookingData.scheduledTime}`,
              bookingId,
              action: 'view_booking',
            },
            reminderDate
          );
        }
      }
    }
  }, [bookingId, bookingData]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Icon name="check-circle" size={64} color={BrandColors.semantic.success} />
          </View>
          <Text style={[Typography.h2, styles.successTitle]}>Booking Confirmed!</Text>
          <Text style={[Typography.body, styles.successMessage]}>
            Your booking has been confirmed. You'll receive a confirmation notification shortly.
          </Text>
        </View>

        {bookingId && (
          <View style={styles.bookingInfo}>
            <Text style={[Typography.bodySmall, styles.bookingLabel]}>Booking ID</Text>
            <Text style={[Typography.h4, styles.bookingId]}>{bookingId}</Text>
          </View>
        )}

        <View style={styles.actions}>
          {bookingData?.serviceType === 'home' && bookingData?.address && (
            <BrandedButton
              title="Track Service Provider"
              onPress={() => {
                navigation?.navigate('StaffTracking', {
                  bookingId: bookingId || '',
                  staffId: bookingData?.staffId || '',
                  destination: {
                    latitude: bookingData.address.lat || bookingData.address.latitude || 0,
                    longitude: bookingData.address.lng || bookingData.address.longitude || 0,
                  },
                  staffName: bookingData?.vendorName || 'Service Provider',
                });
              }}
              fullWidth
              style={styles.actionButton}
            />
          )}
          <BrandedButton
            title="View Booking"
            onPress={() => navigation?.navigate('Bookings')}
            fullWidth
            style={styles.actionButton}
          />
          <TouchableOpacity
            style={styles.homeButton}
            onPress={() => navigation?.navigate('Home')}
          >
            <Text style={[Typography.body, { color: BrandColors.primary.orange }]}>
              Back to Home
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  successIcon: {
    marginBottom: Spacing.base,
  },
  successTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.sm,
  },
  successMessage: {
    color: BrandColors.neutral.gray600,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  bookingInfo: {
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  bookingLabel: {
    color: BrandColors.neutral.gray600,
    marginBottom: Spacing.xs,
  },
  bookingId: {
    color: BrandColors.neutral.gray900,
  },
  actions: {
    gap: Spacing.base,
  },
  actionButton: {
    marginTop: Spacing.base,
  },
  homeButton: {
    padding: Spacing.base,
    alignItems: 'center',
  },
});

