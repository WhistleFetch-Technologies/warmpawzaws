/**
 * GPS Tracking Screen
 * Live GPS tracking for home services
 * Batch 1 - Screen 6
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { GPSTrackingApi } from '../../services/api';

interface GPSTrackingScreenProps {
  bookingId: string;
  vendorId: string;
  customerLocation?: { latitude: number; longitude: number; address?: string };
  onBack?: () => void;
  onComplete?: () => void;
}

interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
}

export function GPSTrackingScreen({
  bookingId,
  vendorId,
  customerLocation,
  onBack,
  onComplete,
}: GPSTrackingScreenProps) {
  const [tracking, setTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationPoint | null>(null);
  const [route, setRoute] = useState<LocationPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    requestLocationPermission();
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied');
        Alert.alert('Permission Required', 'Location permission is required for GPS tracking');
        return;
      }
    } catch (err) {
      console.error('Error requesting location permission:', err);
      setError('Failed to request location permission');
    }
  };

  const startTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is required');
        return;
      }

      // Get initial location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const initialPoint: LocationPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: new Date().toISOString(),
      };

      setCurrentLocation(initialPoint);
      setRoute([initialPoint]);
      setTracking(true);
      setError(null);

      // Generate tracking ID
      const id = `track_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      setTrackingId(id);

      // Start location updates
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Update every 10 meters
        },
        async (location) => {
          const point: LocationPoint = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: new Date().toISOString(),
          };

          setCurrentLocation(point);
          setRoute((prev) => [...prev, point]);

          // Update map to show current location
          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: point.latitude,
              longitude: point.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
          }

          // Send location update to backend
          try {
            await GPSTrackingApi.updateLocation(bookingId, {
              latitude: point.latitude,
              longitude: point.longitude,
              accuracy: location.coords.accuracy,
              speed: location.coords.speed || undefined,
              heading: location.coords.heading || undefined,
            });
          } catch (error) {
            console.error('Error updating location on backend:', error);
            // Don't stop tracking on backend error
          }
        }
      );

      // Notify backend that tracking started
      try {
        await GPSTrackingApi.startTracking(bookingId, vendorId, {
          latitude: initialPoint.latitude,
          longitude: initialPoint.longitude,
        });
      } catch (error) {
        console.error('Error starting tracking on backend:', error);
        // Continue with local tracking even if backend fails
      }
    } catch (err: any) {
      console.error('Error starting tracking:', err);
      setError(err.message || 'Failed to start GPS tracking');
      Alert.alert('Error', 'Failed to start GPS tracking');
    }
  };

  const stopTracking = async () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    setTracking(false);
    // Notify backend that tracking stopped
    try {
      await GPSTrackingApi.stopTracking(bookingId, vendorId);
    } catch (error) {
      console.error('Error stopping tracking on backend:', error);
    }
  };

  const calculateDistance = (point1: LocationPoint, point2: LocationPoint): number => {
    // Haversine formula
    const R = 6371; // Earth radius in km
    const dLat = (point2.latitude - point1.latitude) * (Math.PI / 180);
    const dLon = (point2.longitude - point1.longitude) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(point1.latitude * (Math.PI / 180)) *
        Math.cos(point2.latitude * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const totalDistance = route.length > 1
    ? route.reduce((total, point, index) => {
        if (index === 0) return 0;
        return total + calculateDistance(route[index - 1], point);
      }, 0)
    : 0;

  const region = currentLocation
    ? {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : customerLocation
    ? {
        latitude: customerLocation.latitude,
        longitude: customerLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : {
        latitude: 28.6139, // Default to Delhi
        longitude: 77.209,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>GPS Tracking</Text>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, tracking && styles.statusDotActive]} />
          <Text style={styles.statusText}>
            {tracking ? 'Tracking Active' : 'Tracking Stopped'}
          </Text>
        </View>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={region}
          showsUserLocation={true}
          showsMyLocationButton={true}
          followsUserLocation={tracking}
        >
          {currentLocation && (
            <Marker
              coordinate={{
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
              }}
              title="Your Location"
              pinColor={colors.primary}
            />
          )}
          {customerLocation && (
            <Marker
              coordinate={{
                latitude: customerLocation.latitude,
                longitude: customerLocation.longitude,
              }}
              title="Customer Location"
              pinColor={colors.success}
            />
          )}
          {route.length > 1 && (
            <Polyline
              coordinates={route.map((point) => ({
                latitude: point.latitude,
                longitude: point.longitude,
              }))}
              strokeColor={colors.primary}
              strokeWidth={3}
            />
          )}
        </MapView>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Distance</Text>
          <Text style={styles.statValue}>{totalDistance.toFixed(2)} km</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Points</Text>
          <Text style={styles.statValue}>{route.length}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Status</Text>
          <Text style={[styles.statValue, tracking && styles.statValueActive]}>
            {tracking ? 'Active' : 'Stopped'}
          </Text>
        </View>
      </View>

      <View style={styles.actionsContainer}>
        {!tracking ? (
          <TouchableOpacity style={styles.startButton} onPress={startTracking}>
            <Text style={styles.startButtonText}>Start Tracking</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.stopButton} onPress={stopTracking}>
            <Text style={styles.stopButtonText}>Stop Tracking</Text>
          </TouchableOpacity>
        )}
        {onComplete && tracking && (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => {
              stopTracking();
              onComplete();
            }}
          >
            <Text style={styles.completeButtonText}>Complete</Text>
          </TouchableOpacity>
        )}
      </View>
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
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
    marginRight: spacing.xs,
  },
  statusDotActive: {
    backgroundColor: colors.success,
  },
  statusText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  errorContainer: {
    backgroundColor: '#FEE',
    padding: spacing.md,
    margin: spacing.md,
    borderRadius: borderRadius.md,
  },
  errorText: {
    fontSize: typography.fontSizes.sm,
    color: colors.error,
  },
  mapContainer: {
    flex: 1,
    margin: spacing.md,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
  },
  statValue: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
  statValueActive: {
    color: colors.success,
  },
  actionsContainer: {
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  startButton: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  startButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.white,
  },
  stopButton: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  stopButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.white,
  },
  completeButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  completeButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.white,
  },
});

