/**
 * Route Optimization Screen
 * Route planning and optimization
 * Batch 2 - Screen 7
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { RouteOptimizationApi } from '../../services/api';

interface RouteOptimizationScreenProps {
  bookingIds: string[];
  vendorId: string;
  onBack?: () => void;
  onRouteOptimized?: (route: any) => void;
}

export function RouteOptimizationScreen({
  bookingIds,
  vendorId,
  onBack,
  onRouteOptimized,
}: RouteOptimizationScreenProps) {
  const [optimizing, setOptimizing] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState<any>(null);
  const [waypoints, setWaypoints] = useState<any[]>([]);

  const handleOptimize = async () => {
    if (bookingIds.length < 2) {
      Alert.alert('Error', 'Need at least 2 bookings to optimize route');
      return;
    }

    setOptimizing(true);
    try {
      const response = await RouteOptimizationApi.optimizeRoute(vendorId, bookingIds);
      if (response.success) {
        setOptimizedRoute(response.route);
        setWaypoints(response.waypoints || []);
        if (onRouteOptimized) {
          onRouteOptimized(response.route);
        }
      } else {
        Alert.alert('Error', response.error || 'Failed to optimize route');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to optimize route');
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Route Optimization</Text>
        <Text style={styles.subtitle}>{bookingIds.length} bookings</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.mapContainer}>
          {optimizedRoute && waypoints.length > 0 ? (
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: waypoints[0].latitude,
                longitude: waypoints[0].longitude,
                latitudeDelta: 0.1,
                longitudeDelta: 0.1,
              }}
            >
              <Polyline
                coordinates={waypoints}
                strokeWidth={4}
                strokeColor={colors.primary}
              />
              {waypoints.map((point, index) => (
                <Marker
                  key={index}
                  coordinate={point}
                  title={`Stop ${index + 1}`}
                  description={point.address}
                />
              ))}
            </MapView>
          ) : (
            <View style={styles.mapPlaceholder}>
              <Text style={styles.mapPlaceholderText}>
                Optimize route to see map
              </Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.optimizeButton, optimizing && styles.optimizeButtonDisabled]}
            onPress={handleOptimize}
            disabled={optimizing}
          >
            {optimizing ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.optimizeButtonText}>Optimize Route</Text>
            )}
          </TouchableOpacity>
        </View>

        {optimizedRoute && (
          <View style={styles.routeInfo}>
            <Text style={styles.routeInfoTitle}>Optimized Route</Text>
            <Text style={styles.routeInfoText}>
              Distance: {optimizedRoute.totalDistance?.toFixed(2) || 'N/A'} km
            </Text>
            <Text style={styles.routeInfoText}>
              Estimated Time: {optimizedRoute.estimatedTime || 'N/A'} minutes
            </Text>
            <Text style={styles.routeInfoText}>
              Stops: {waypoints.length}
            </Text>
          </View>
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
  subtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  mapContainer: {
    height: 400,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPlaceholderText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  actions: {
    marginBottom: spacing.md,
  },
  optimizeButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  optimizeButtonDisabled: {
    opacity: 0.5,
  },
  optimizeButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: '#ffffff',
  },
  routeInfo: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
  },
  routeInfoTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  routeInfoText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
});

