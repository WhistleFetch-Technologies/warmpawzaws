/**
 * GPS Tracking Screen - Mobile
 * Real-time GPS tracking for walkers and home services
 * Identical functionality to web app
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
import { colors, spacing, borderRadius } from '../../theme/colors';
import { GPSTrackingApi } from '../../services/api';

interface GPSTrackingScreenProps {
  bookingId: string;
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
}

export function GPSTrackingScreen({
  bookingId,
  phone,
  onBack,
  onNavigate,
}: GPSTrackingScreenProps) {
  const [tracking, setTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationPoint | null>(null);
  const [route, setRoute] = useState<LocationPoint[]>([]);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const mapRef = useRef<MapView>(null);
  const locationSubscription = useRef<any>(null);
  const startTime = useRef<Date | null>(null);

  useEffect(() => {
    loadTrackingData();
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  const loadTrackingData = async () => {
    try {
      setLoading(true);
      const response = await GPSTrackingApi.getLiveLocation(bookingId);
      if (response.location) {
        setCurrentLocation(response.location);
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: response.location.latitude,
            longitude: response.location.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        }
      }
      
      const routeData = await GPSTrackingApi.getRoute(bookingId);
      if (routeData.route) {
        setRoute(routeData.route);
        setDistance(routeData.distance || 0);
        setDuration(routeData.duration || 0);
      }
    } catch (error) {
      console.error('Error loading tracking data:', error);
    } finally {
      setLoading(false);
    }
  };

  const startTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for tracking');
        return;
      }

      await GPSTrackingApi.startTracking(bookingId);
      setTracking(true);
      startTime.current = new Date();

      // Start location updates
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        async (location) => {
          const locationPoint: LocationPoint = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: new Date().toISOString(),
          };

          setCurrentLocation(locationPoint);
          setRoute(prev => [...prev, locationPoint]);

          // Update location on server
          await GPSTrackingApi.updateLocation(bookingId, {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: locationPoint.timestamp,
            accuracy: location.coords.accuracy,
          });

          // Calculate distance
          if (route.length > 0) {
            const lastPoint = route[route.length - 1];
            const newDistance = calculateDistance(
              lastPoint.latitude,
              lastPoint.longitude,
              locationPoint.latitude,
              locationPoint.longitude
            );
            setDistance(prev => prev + newDistance);
          }

          // Update duration
          if (startTime.current) {
            const elapsed = (new Date().getTime() - startTime.current.getTime()) / 1000;
            setDuration(Math.floor(elapsed));
          }

          // Update map
          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
          }
        }
      );
    } catch (error: any) {
      console.error('Error starting tracking:', error);
      Alert.alert('Error', error.message || 'Failed to start tracking');
    }
  };

  const stopTracking = async () => {
    try {
      await GPSTrackingApi.stopTracking(bookingId);
      setTracking(false);
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
      startTime.current = null;
    } catch (error: any) {
      console.error('Error stopping tracking:', error);
      Alert.alert('Error', error.message || 'Failed to stop tracking');
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Tracking</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Map View */}
      <View style={styles.mapContainer}>
        {currentLocation ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            showsUserLocation={true}
            followsUserLocation={tracking}
          >
            {/* Route Polyline */}
            {route.length > 1 && (
              <Polyline
                coordinates={route}
                strokeColor={colors.primary}
                strokeWidth={4}
              />
            )}
            
            {/* Current Location Marker */}
            {currentLocation && (
              <Marker
                coordinate={{
                  latitude: currentLocation.latitude,
                  longitude: currentLocation.longitude,
                }}
                title="Current Location"
                pinColor={colors.primary}
              />
            )}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.mapPlaceholderText}>Loading map...</Text>
          </View>
        )}
      </View>

      {/* Tracking Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Distance</Text>
          <Text style={styles.statValue}>
            {(distance / 1000).toFixed(2)} km
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Duration</Text>
          <Text style={styles.statValue}>
            {formatDuration(duration)}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Status</Text>
          <Text style={[styles.statValue, tracking && styles.statValueActive]}>
            {tracking ? 'Tracking' : 'Stopped'}
          </Text>
        </View>
      </View>

      {/* Control Buttons */}
      <View style={styles.controls}>
        {!tracking ? (
          <TouchableOpacity
            style={styles.startButton}
            onPress={startTracking}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.startButtonText}>▶ Start Tracking</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.stopButton}
            onPress={stopTracking}
          >
            <Text style={styles.stopButtonText}>⏹ Stop Tracking</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  placeholder: {
    width: 60,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray['100'],
  },
  mapPlaceholderText: {
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  statValueActive: {
    color: colors.primary,
  },
  controls: {
    padding: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  startButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  startButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  stopButton: {
    backgroundColor: colors.error,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  stopButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

