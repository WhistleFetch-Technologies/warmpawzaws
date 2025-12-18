/**
 * Start Service Screen - Vendor Mobile App
 * For home services: Start GPS tracking when staff begins service
 * Shows booking details and start tracking button
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
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, publicAnonKey, API_BASE_URL } from '../../config/api';
import LocationService from '../../services/LocationService';
import NotificationService from '../../services/NotificationService';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface StartServiceScreenProps {
  route?: {
    params?: {
      bookingId?: string;
      booking?: any;
    };
  };
  navigation?: any;
}

export default function StartServiceScreen({
  route,
  navigation,
}: StartServiceScreenProps) {
  const bookingId = route?.params?.bookingId || '';
  const booking = route?.params?.booking || {};

  const [loading, setLoading] = useState(false);
  const [trackingStarted, setTrackingStarted] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<any>(null);

  useEffect(() => {
    checkTrackingStatus();
  }, [bookingId]);

  const checkTrackingStatus = async () => {
    try {
      // Check if tracking is already started
      const response = await fetch(
        `${API_BASE_URL}/vendor/booking/${encodeURIComponent(bookingId)}/tracking-status`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTrackingStarted(data.isTracking || false);
      }
    } catch (error) {
      console.error('Error checking tracking status:', error);
    }
  };

  const handleStartTracking = async () => {
    try {
      setLoading(true);

      // Request location permissions
      const hasPermission = await LocationService.requestPermissions();
      if (!hasPermission) {
        Alert.alert(
          'Location Permission Required',
          'Please enable location access to start service tracking.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      // Get current location
      const location = await LocationService.getCurrentLocation();
      if (!location) {
        Alert.alert('Error', 'Unable to get your location. Please try again.');
        setLoading(false);
        return;
      }

      setCurrentLocation(location);

      // Start tracking on server
      const response = await fetch(
        `${API_BASE_URL}/vendor/location/start`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            bookingId,
            staffId: booking.staffId || booking.staff_id,
            latitude: location.latitude,
            longitude: location.longitude,
            status: 'en_route',
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to start tracking');
      }

      // Start sending location updates
      LocationService.startLocationUpdates(
        bookingId,
        booking.staffId || booking.staff_id,
        30000 // Update every 30 seconds
      );

      // Start watching location
      LocationService.startWatchingLocation((loc) => {
        setCurrentLocation(loc);
      });

      setTrackingStarted(true);
      
      // Send notification
      NotificationService.showLocalNotification({
        type: 'booking',
        title: 'Service Started',
        message: `GPS tracking started for booking ${bookingId}`,
        bookingId,
        action: 'view_booking',
      });

      Alert.alert('Success', 'Service tracking started. Customer will be notified.');
    } catch (error: any) {
      console.error('Error starting tracking:', error);
      Alert.alert('Error', error.message || 'Failed to start tracking');
    } finally {
      setLoading(false);
    }
  };

  const handleStopTracking = async () => {
    try {
      setLoading(true);

      // Stop tracking on server
      const response = await fetch(
        `${API_BASE_URL}/vendor/location/stop`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            bookingId,
            status: 'arrived',
          }),
        }
      );

      if (response.ok) {
        LocationService.stopLocationUpdates();
        LocationService.stopWatchingLocation();
        setTrackingStarted(false);
        Alert.alert('Success', 'Tracking stopped');
      }
    } catch (error: any) {
      console.error('Error stopping tracking:', error);
      Alert.alert('Error', 'Failed to stop tracking');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation?.goBack()}
          >
            <Icon name="arrow-back" size={24} color={BrandColors.primary.orange} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[Typography.h2, styles.headerTitle]}>Start Service</Text>
            <Text style={[Typography.bodySmall, styles.headerSubtitle]}>
              Begin GPS tracking for home service
            </Text>
          </View>
        </View>

        {/* Booking Details */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Booking Details</Text>
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={[Typography.bodySmall, styles.detailLabel]}>Customer</Text>
              <Text style={[Typography.body, styles.detailValue]}>
                {booking.customerName || 'Customer'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[Typography.bodySmall, styles.detailLabel]}>Service</Text>
              <Text style={[Typography.body, styles.detailValue]}>
                {booking.serviceName || 'Service'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[Typography.bodySmall, styles.detailLabel]}>Address</Text>
              <Text style={[Typography.body, styles.detailValue]} numberOfLines={2}>
                {booking.address?.addressLine1 || booking.address || 'Address not available'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[Typography.bodySmall, styles.detailLabel]}>Scheduled Time</Text>
              <Text style={[Typography.body, styles.detailValue]}>
                {booking.scheduledDate} at {booking.scheduledTime}
              </Text>
            </View>
          </View>
        </View>

        {/* Tracking Status */}
        {trackingStarted && (
          <View style={styles.section}>
            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <View style={styles.statusIndicator}>
                  <View style={[styles.statusDot, { backgroundColor: BrandColors.primary.orange }]} />
                  <Text style={[Typography.body, styles.statusText]}>Tracking Active</Text>
                </View>
              </View>
              {currentLocation && (
                <View style={styles.locationInfo}>
                  <Icon name="my-location" size={20} color={BrandColors.primary.orange} />
                  <Text style={[Typography.bodySmall, styles.locationText]}>
                    {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Instructions */}
        <View style={styles.section}>
          <View style={styles.instructionsCard}>
            <Icon name="info" size={24} color={BrandColors.primary.orange} />
            <View style={styles.instructionsContent}>
              <Text style={[Typography.body, styles.instructionsTitle]}>
                GPS Tracking Instructions
              </Text>
              <Text style={[Typography.bodySmall, styles.instructionsText]}>
                • Enable location permissions when prompted{'\n'}
                • Tracking will start automatically{'\n'}
                • Customer will receive real-time location updates{'\n'}
                • Stop tracking when service is completed
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Action Button */}
      <View style={styles.footer}>
        {!trackingStarted ? (
          <BrandedButton
            title={loading ? 'Starting...' : 'Start GPS Tracking'}
            onPress={handleStartTracking}
            disabled={loading}
            loading={loading}
            fullWidth
          />
        ) : (
          <BrandedButton
            title={loading ? 'Stopping...' : 'Stop Tracking'}
            onPress={handleStopTracking}
            disabled={loading}
            loading={loading}
            fullWidth
            variant="secondary"
          />
        )}
      </View>
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
    paddingBottom: Spacing.xl + 80,
  },
  header: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    color: BrandColors.neutral.gray600,
  },
  section: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.base,
  },
  detailsCard: {
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    gap: Spacing.base,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detailLabel: {
    color: BrandColors.neutral.gray600,
    flex: 1,
  },
  detailValue: {
    color: BrandColors.neutral.gray900,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  statusCard: {
    backgroundColor: BrandColors.primary.orange + '10',
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: BrandColors.primary.orange + '30',
  },
  statusHeader: {
    marginBottom: Spacing.sm,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusText: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  locationText: {
    color: BrandColors.neutral.gray700,
    fontFamily: 'monospace',
  },
  instructionsCard: {
    flexDirection: 'row',
    gap: Spacing.base,
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
  },
  instructionsContent: {
    flex: 1,
  },
  instructionsTitle: {
    color: BrandColors.neutral.gray900,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  instructionsText: {
    color: BrandColors.neutral.gray600,
    lineHeight: 20,
  },
  footer: {
    padding: Spacing.lg,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
  },
});

