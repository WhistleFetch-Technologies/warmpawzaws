/**
 * Route Tracking Screen
 * Route visualization and tracking
 * Batch 1 - Screen 7
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { GPSTrackingScreen } from './GPSTrackingScreen';

interface RouteTrackingScreenProps {
  bookingId: string;
  vendorId: string;
  routeData?: Array<{ latitude: number; longitude: number; timestamp: string }>;
  startLocation?: { latitude: number; longitude: number };
  endLocation?: { latitude: number; longitude: number };
  onBack?: () => void;
}

export function RouteTrackingScreen({
  bookingId,
  vendorId,
  routeData = [],
  startLocation,
  endLocation,
  onBack,
}: RouteTrackingScreenProps) {
  const [showLiveTracking, setShowLiveTracking] = useState(false);

  if (showLiveTracking) {
    return (
      <GPSTrackingScreen
        bookingId={bookingId}
        vendorId={vendorId}
        customerLocation={endLocation}
        onBack={() => setShowLiveTracking(false)}
      />
    );
  }

  const allPoints = routeData.length > 0
    ? routeData
    : startLocation && endLocation
    ? [startLocation, endLocation]
    : [];

  const region = allPoints.length > 0
    ? {
        latitude: allPoints[0].latitude,
        longitude: allPoints[0].longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }
    : {
        latitude: 28.6139,
        longitude: 77.209,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };

  const calculateDistance = (point1: any, point2: any): number => {
    const R = 6371;
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

  const totalDistance =
    allPoints.length > 1
      ? allPoints.reduce((total, point, index) => {
          if (index === 0) return 0;
          return total + calculateDistance(allPoints[index - 1], point);
        }, 0)
      : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Route Tracking</Text>
      </View>

      <View style={styles.mapContainer}>
        <MapView style={styles.map} initialRegion={region}>
          {startLocation && (
            <Marker
              coordinate={startLocation}
              title="Start Location"
              pinColor={colors.success}
            />
          )}
          {endLocation && (
            <Marker
              coordinate={endLocation}
              title="End Location"
              pinColor={colors.error}
            />
          )}
          {routeData.length > 1 && (
            <Polyline
              coordinates={routeData.map((point) => ({
                latitude: point.latitude,
                longitude: point.longitude,
              }))}
              strokeColor={colors.primary}
              strokeWidth={3}
            />
          )}
        </MapView>
      </View>

      <ScrollView style={styles.statsContainer}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Total Distance:</Text>
          <Text style={styles.statValue}>{totalDistance.toFixed(2)} km</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Route Points:</Text>
          <Text style={styles.statValue}>{allPoints.length}</Text>
        </View>
        {routeData.length > 0 && (
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Route Duration:</Text>
            <Text style={styles.statValue}>
              {routeData.length > 1
                ? `${Math.round(
                    (new Date(routeData[routeData.length - 1].timestamp).getTime() -
                      new Date(routeData[0].timestamp).getTime()) /
                      60000
                  )} min`
                : 'N/A'}
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.liveTrackingButton}
          onPress={() => setShowLiveTracking(true)}
        >
          <Text style={styles.liveTrackingButtonText}>Start Live Tracking</Text>
        </TouchableOpacity>
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
    maxHeight: 150,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statLabel: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  statValue: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
  actionsContainer: {
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  liveTrackingButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  liveTrackingButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: '#ffffff',
  },
});

