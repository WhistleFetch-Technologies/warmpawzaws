/**
 * Live Tracking Dashboard
 * Real-time tracking dashboard
 * Batch 2 - Screen 5
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
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { GPSTrackingApi } from '../../services/api';

interface LiveTrackingDashboardProps {
  vendorId: string;
  onBack?: () => void;
  onSelectBooking?: (bookingId: string) => void;
}

interface ActiveTracking {
  bookingId: string;
  customerName: string;
  serviceName: string;
  currentLocation: { latitude: number; longitude: number };
  route: Array<{ latitude: number; longitude: number }>;
  status: string;
  startTime: string;
}

export function LiveTrackingDashboard({
  vendorId,
  onBack,
  onSelectBooking,
}: LiveTrackingDashboardProps) {
  const [activeTrackings, setActiveTrackings] = useState<ActiveTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTracking, setSelectedTracking] = useState<ActiveTracking | null>(null);

  useEffect(() => {
    loadActiveTrackings();
    const interval = setInterval(loadActiveTrackings, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [vendorId]);

  const loadActiveTrackings = async () => {
    try {
      const response = await GPSTrackingApi.getActiveTrackings(vendorId);
      setActiveTrackings(response.trackings || []);
      if (response.trackings && response.trackings.length > 0 && !selectedTracking) {
        setSelectedTracking(response.trackings[0]);
      }
    } catch (error) {
      console.error('Error loading active trackings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Live Tracking</Text>
        <Text style={styles.subtitle}>{activeTrackings.length} active</Text>
      </View>

      <View style={styles.content}>
        {selectedTracking ? (
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: selectedTracking.currentLocation.latitude,
                longitude: selectedTracking.currentLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              {selectedTracking.route.length > 1 && (
                <Polyline
                  coordinates={selectedTracking.route}
                  strokeWidth={4}
                  strokeColor={colors.primary}
                />
              )}
              <Marker
                coordinate={selectedTracking.currentLocation}
                title={selectedTracking.customerName}
                description={selectedTracking.serviceName}
              />
            </MapView>
          </View>
        ) : (
          <View style={styles.noTrackingContainer}>
            <Text style={styles.noTrackingText}>No active tracking</Text>
          </View>
        )}

        <ScrollView style={styles.trackingList}>
          {activeTrackings.map((tracking) => (
            <TouchableOpacity
              key={tracking.bookingId}
              style={[
                styles.trackingCard,
                selectedTracking?.bookingId === tracking.bookingId && styles.trackingCardSelected,
              ]}
              onPress={() => {
                setSelectedTracking(tracking);
                if (onSelectBooking) {
                  onSelectBooking(tracking.bookingId);
                }
              }}
            >
              <View style={styles.trackingCardContent}>
                <Text style={styles.trackingCustomerName}>{tracking.customerName}</Text>
                <Text style={styles.trackingServiceName}>{tracking.serviceName}</Text>
                <Text style={styles.trackingStatus}>{tracking.status}</Text>
                <Text style={styles.trackingTime}>
                  Started: {new Date(tracking.startTime).toLocaleTimeString()}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  mapContainer: {
    height: 300,
    margin: spacing.md,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.border,
  },
  map: {
    flex: 1,
  },
  noTrackingContainer: {
    height: 300,
    margin: spacing.md,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noTrackingText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  trackingList: {
    flex: 1,
    padding: spacing.md,
  },
  trackingCard: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  trackingCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF4E6',
  },
  trackingCardContent: {
    flex: 1,
  },
  trackingCustomerName: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  trackingServiceName: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
  },
  trackingStatus: {
    fontSize: typography.fontSizes.xs,
    color: colors.primary,
    marginBottom: spacing.xs / 2,
  },
  trackingTime: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
  },
});

