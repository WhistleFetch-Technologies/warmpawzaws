/**
 * Staff Tracking Screen - Customer Mobile App
 * Real-time tracking of staff location for home services
 * Shows staff location, route, and ETA
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useAuth } from '../../context/AuthContext';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, publicAnonKey, API_BASE_URL } from '../../config/api';
import LocationService, { Location, LocationUpdate } from '../../services/LocationService';
import NotificationService from '../../services/NotificationService';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface StaffTrackingScreenProps {
  route?: {
    params?: {
      bookingId?: string;
      staffId?: string;
      destination?: Location;
      staffName?: string;
    };
  };
  navigation?: any;
}

export default function StaffTrackingScreen({
  route,
  navigation,
}: StaffTrackingScreenProps) {
  const { user } = useAuth();
  const bookingId = route?.params?.bookingId || '';
  const staffId = route?.params?.staffId || '';
  const destination = route?.params?.destination;
  const staffName = route?.params?.staffName || 'Service Provider';

  const [staffLocation, setStaffLocation] = useState<Location | null>(null);
  const [customerLocation, setCustomerLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [distance, setDistance] = useState<number>(0);
  const [eta, setEta] = useState<number>(0);
  const [status, setStatus] = useState<'en_route' | 'arrived' | 'completed'>('en_route');
  const [trackingInterval, setTrackingInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    initializeTracking();
    return () => {
      cleanup();
    };
  }, []);

  const initializeTracking = async () => {
    try {
      setLoading(true);

      // Request location permissions
      const hasPermission = await LocationService.requestPermissions();
      if (!hasPermission) {
        Alert.alert(
          'Location Permission Required',
          'Please enable location access to track the service provider.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      // Get customer location
      const customerLoc = await LocationService.getCurrentLocation();
      if (customerLoc) {
        setCustomerLocation(customerLoc);
      }

      // Start polling for staff location
      startPollingStaffLocation();

      // Get initial staff location
      await updateStaffLocation();

      setLoading(false);
    } catch (error) {
      console.error('Error initializing tracking:', error);
      Alert.alert('Error', 'Failed to initialize tracking');
      setLoading(false);
    }
  };

  const startPollingStaffLocation = () => {
    // Poll every 10 seconds
    const interval = setInterval(async () => {
      await updateStaffLocation();
    }, 10000);

    setTrackingInterval(interval);
  };

  const updateStaffLocation = async () => {
    try {
      const locationUpdate = await LocationService.getStaffLocation(bookingId);
      
      if (locationUpdate) {
        const previousStatus = status;
        setStaffLocation(locationUpdate.location);
        setStatus(locationUpdate.status);

        // Send notification on status change
        if (previousStatus !== locationUpdate.status) {
          if (locationUpdate.status === 'arrived') {
            NotificationService.showLocalNotification({
              type: 'gps',
              title: 'Service Provider Arrived',
              message: `${staffName} has arrived at your location`,
              bookingId,
              action: 'track_service',
              data: {
                staffId,
                staffName,
                status: 'arrived',
              },
            });
          } else if (locationUpdate.status === 'completed') {
            NotificationService.showLocalNotification({
              type: 'booking',
              title: 'Service Completed',
              message: `${staffName} has completed the service`,
              bookingId,
              action: 'view_booking',
              data: {
                staffId,
                staffName,
                status: 'completed',
              },
            });
          }
        }

        // Calculate distance and ETA if destination is available
        if (destination && locationUpdate.location) {
          const dist = LocationService.calculateDistance(
            locationUpdate.location,
            destination
          );
          setDistance(dist);
          const newEta = LocationService.calculateETA(dist);
          setEta(newEta);

          // Send GPS update notification if ETA changed significantly
          if (Math.abs(newEta - eta) > 5) {
            NotificationService.showLocalNotification({
              type: 'gps',
              title: 'Service Provider Update',
              message: `${staffName} is ${dist.toFixed(1)} km away. ETA: ${newEta} minutes`,
              bookingId,
              action: 'track_service',
              data: {
                staffId,
                staffName,
                distance: dist,
                eta: newEta,
              },
            });
          }

          // Update map to show both locations
          if (mapRef.current && customerLocation) {
            mapRef.current.fitToCoordinates(
              [
                {
                  latitude: locationUpdate.location.latitude,
                  longitude: locationUpdate.location.longitude,
                },
                {
                  latitude: destination.latitude,
                  longitude: destination.longitude,
                },
                {
                  latitude: customerLocation.latitude,
                  longitude: customerLocation.longitude,
                },
              ],
              {
                edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                animated: true,
              }
            );
          }
        }
      }
    } catch (error) {
      console.error('Error updating staff location:', error);
    }
  };

  const cleanup = () => {
    if (trackingInterval) {
      clearInterval(trackingInterval);
    }
    LocationService.stopWatchingLocation();
  };

  const getStatusColor = () => {
    switch (status) {
      case 'arrived':
        return BrandColors.semantic.success;
      case 'completed':
        return BrandColors.neutral.gray600;
      default:
        return BrandColors.primary.orange;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'arrived':
        return 'Arrived';
      case 'completed':
        return 'Service Completed';
      default:
        return 'On the way';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Initializing tracking...
        </Text>
      </View>
    );
  }

  if (!staffLocation && !customerLocation) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.errorContainer}>
          <Icon name="location-off" size={64} color={BrandColors.neutral.gray300} />
          <Text style={[Typography.h3, styles.errorText]}>Location Unavailable</Text>
          <Text style={[Typography.bodySmall, styles.errorSubtext]}>
            Unable to track location. Please check your permissions.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={initializeTracking}
          >
            <Text style={[Typography.body, { color: BrandColors.primary.orange }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const mapRegion = staffLocation || customerLocation || {
    latitude: 20.5937,
    longitude: 78.9629,
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Map */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          ...mapRegion,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {/* Staff Location Marker */}
        {staffLocation && (
          <Marker
            coordinate={{
              latitude: staffLocation.latitude,
              longitude: staffLocation.longitude,
            }}
            title={staffName}
            description={getStatusText()}
          >
            <View style={[styles.markerContainer, { backgroundColor: getStatusColor() }]}>
              <Icon name="person" size={24} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {/* Destination Marker */}
        {destination && (
          <Marker
            coordinate={{
              latitude: destination.latitude,
              longitude: destination.longitude,
            }}
            title="Your Location"
            pinColor={BrandColors.primary.orange}
          />
        )}

        {/* Route Polyline */}
        {staffLocation && destination && (
          <Polyline
            coordinates={[
              {
                latitude: staffLocation.latitude,
                longitude: staffLocation.longitude,
              },
              {
                latitude: destination.latitude,
                longitude: destination.longitude,
              },
            ]}
            strokeColor={BrandColors.primary.orange}
            strokeWidth={3}
            lineDashPattern={[5, 5]}
          />
        )}
      </MapView>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <View style={styles.statusIndicator}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
            <Text style={[Typography.body, styles.statusText]}>
              {getStatusText()}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation?.goBack()}
          >
            <Icon name="close" size={24} color={BrandColors.neutral.gray600} />
          </TouchableOpacity>
        </View>

        <View style={styles.infoContent}>
          <View style={styles.infoRow}>
            <Icon name="person" size={20} color={BrandColors.neutral.gray600} />
            <Text style={[Typography.body, styles.infoLabel]}>{staffName}</Text>
          </View>

          {distance > 0 && (
            <View style={styles.infoRow}>
              <Icon name="straighten" size={20} color={BrandColors.neutral.gray600} />
              <Text style={[Typography.body, styles.infoLabel]}>
                {distance.toFixed(1)} km away
              </Text>
            </View>
          )}

          {eta > 0 && status === 'en_route' && (
            <View style={styles.infoRow}>
              <Icon name="schedule" size={20} color={BrandColors.neutral.gray600} />
              <Text style={[Typography.body, styles.infoLabel]}>
                ETA: {eta} minutes
              </Text>
            </View>
          )}

          {status === 'arrived' && (
            <View style={styles.arrivedContainer}>
              <Icon name="check-circle" size={24} color={BrandColors.semantic.success} />
              <Text style={[Typography.body, styles.arrivedText]}>
                Service provider has arrived
              </Text>
            </View>
          )}
        </View>
      </View>
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
  map: {
    flex: 1,
  },
  markerContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  infoCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.base,
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
    color: BrandColors.neutral.gray900,
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    gap: Spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  infoLabel: {
    color: BrandColors.neutral.gray700,
  },
  arrivedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    padding: Spacing.base,
    backgroundColor: BrandColors.semantic.success + '20',
    borderRadius: BorderRadius.md,
  },
  arrivedText: {
    color: BrandColors.semantic.success,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    color: BrandColors.neutral.gray900,
    marginTop: Spacing.base,
    marginBottom: Spacing.xs,
  },
  errorSubtext: {
    color: BrandColors.neutral.gray600,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  retryButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.primary.orange,
  },
});

