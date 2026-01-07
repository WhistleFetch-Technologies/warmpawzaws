/**
 * Maps Route Screen - Mobile
 * Maps and route visualization with directions
 * Identical functionality to web app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { GPSTrackingApi } from '../../services/api';

interface MapsRouteScreenProps {
  bookingId?: string;
  origin?: { latitude: number; longitude: number };
  destination?: { latitude: number; longitude: number };
  route?: Array<{ latitude: number; longitude: number }>;
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
}

export function MapsRouteScreen({
  bookingId,
  origin,
  destination,
  route: initialRoute,
  phone,
  onBack,
  onNavigate,
}: MapsRouteScreenProps) {
  const [route, setRoute] = useState<Array<{ latitude: number; longitude: number }>>(
    initialRoute || []
  );
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);
  const [eta, setEta] = useState(0);
  const [distance, setDistance] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (bookingId) {
      loadRoute();
    } else if (origin && destination) {
      calculateRoute();
    }
  }, [bookingId, origin, destination]);

  const loadRoute = async () => {
    try {
      setLoading(true);
      if (bookingId) {
        const response = await GPSTrackingApi.getRoute(bookingId);
        if (response.route) {
          setRoute(response.route);
          setDistance(response.distance || 0);
          setEta(response.eta || 0);
          generateRouteSteps(response.route);
        }
      }
    } catch (error) {
      console.error('Error loading route:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateRoute = () => {
    if (!origin || !destination) return;
    
    // Simple route calculation (in production, use Google Maps Directions API)
    const calculatedRoute = [origin, destination];
    setRoute(calculatedRoute);
    
    const dist = calculateDistance(
      origin.latitude,
      origin.longitude,
      destination.latitude,
      destination.longitude
    );
    setDistance(dist);
    setEta(Math.floor(dist / 1000 * 3)); // Assume 3 min per km
    
    generateRouteSteps(calculatedRoute);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const generateRouteSteps = (routePoints: Array<{ latitude: number; longitude: number }>) => {
    const steps: RouteStep[] = [];
    for (let i = 0; i < routePoints.length - 1; i++) {
      const dist = calculateDistance(
        routePoints[i].latitude,
        routePoints[i].longitude,
        routePoints[i + 1].latitude,
        routePoints[i + 1].longitude
      );
      steps.push({
        instruction: `Continue to point ${i + 1}`,
        distance: dist,
        duration: Math.floor(dist / 1000 * 3),
      });
    }
    setRouteSteps(steps);
  };

  const getRegion = () => {
    if (route.length === 0) {
      return {
        latitude: origin?.latitude || 19.0760,
        longitude: origin?.longitude || 72.8777,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };
    }

    const lats = route.map(p => p.latitude);
    const lngs = route.map(p => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: (maxLat - minLat) * 1.5,
      longitudeDelta: (maxLng - minLng) * 1.5,
    };
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Route</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Map View */}
      <View style={styles.mapContainer}>
        {loading ? (
          <View style={styles.mapPlaceholder}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.mapPlaceholderText}>Loading route...</Text>
          </View>
        ) : route.length > 0 ? (
          <MapView
            style={styles.map}
            initialRegion={getRegion()}
            showsUserLocation={true}
          >
            {/* Route Polyline */}
            {route.length > 1 && (
              <Polyline
                coordinates={route}
                strokeColor={colors.primary}
                strokeWidth={4}
              />
            )}

            {/* Origin Marker */}
            {origin && (
              <Marker
                coordinate={origin}
                title="Origin"
                pinColor={colors.primary}
              />
            )}

            {/* Destination Marker */}
            {destination && (
              <Marker
                coordinate={destination}
                title="Destination"
                pinColor={colors.error}
              />
            )}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapPlaceholderText}>No route available</Text>
          </View>
        )}
      </View>

      {/* Route Info */}
      <View style={styles.routeInfo}>
        <View style={styles.routeStats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValue}>
              {(distance / 1000).toFixed(2)} km
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>ETA</Text>
            <Text style={styles.statValue}>
              {Math.floor(eta / 60)} min
            </Text>
          </View>
        </View>

        {/* Route Steps */}
        {routeSteps.length > 0 && (
          <ScrollView style={styles.stepsContainer}>
            <Text style={styles.stepsTitle}>Directions</Text>
            {routeSteps.map((step, index) => (
              <View key={index} style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepInstruction}>{step.instruction}</Text>
                  <Text style={styles.stepDistance}>
                    {(step.distance / 1000).toFixed(2)} km • {step.duration} min
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
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
    backgroundColor: colors.gray.100,
  },
  mapPlaceholderText: {
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.textSecondary,
  },
  routeInfo: {
    maxHeight: 300,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  routeStats: {
    flexDirection: 'row',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statItem: {
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
    color: colors.primary,
  },
  stepsContainer: {
    maxHeight: 200,
    padding: spacing.md,
  },
  stepsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  stepNumberText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  stepContent: {
    flex: 1,
  },
  stepInstruction: {
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  stepDistance: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});

