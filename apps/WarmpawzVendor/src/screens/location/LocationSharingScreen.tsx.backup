/**
 * Location Sharing Screen
 * Share location with customers
 * Batch 2 - Screen 6
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Switch,
  Alert,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { LocationSharingApi } from '../../services/api';

interface LocationSharingScreenProps {
  bookingId: string;
  vendorId: string;
  customerId: string;
  onBack?: () => void;
}

export function LocationSharingScreen({
  bookingId,
  vendorId,
  customerId,
  onBack,
}: LocationSharingScreenProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    requestLocationPermission();
    if (isSharing) {
      startLocationSharing();
    }
    return () => {
      if (isSharing) {
        stopLocationSharing();
      }
    };
  }, [isSharing]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to share location.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation(location.coords);
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const startLocationSharing = async () => {
    try {
      setLoading(true);
      if (!currentLocation) {
        const location = await Location.getCurrentPositionAsync({});
        setCurrentLocation(location.coords);
      }
      
      await LocationSharingApi.startSharing(bookingId, vendorId, customerId, {
        latitude: currentLocation!.latitude,
        longitude: currentLocation!.longitude,
      });

      // Start updating location periodically
      const interval = setInterval(async () => {
        try {
          const location = await Location.getCurrentPositionAsync({});
          setCurrentLocation(location.coords);
          await LocationSharingApi.updateLocation(bookingId, {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        } catch (error) {
          console.error('Error updating location:', error);
        }
      }, 5000); // Update every 5 seconds

      return () => clearInterval(interval);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to start location sharing');
      setIsSharing(false);
    } finally {
      setLoading(false);
    }
  };

  const stopLocationSharing = async () => {
    try {
      await LocationSharingApi.stopSharing(bookingId);
    } catch (error) {
      console.error('Error stopping location sharing:', error);
    }
  };

  const handleToggleSharing = async () => {
    if (!isSharing) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        return;
      }
    }
    setIsSharing(!isSharing);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Location Sharing</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.sharingControl}>
          <View style={styles.sharingInfo}>
            <Text style={styles.sharingLabel}>Share Location</Text>
            <Text style={styles.sharingDescription}>
              Allow customer to see your real-time location
            </Text>
          </View>
          <Switch
            value={isSharing}
            onValueChange={handleToggleSharing}
            disabled={loading}
          />
        </View>

        {currentLocation && (
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              showsUserLocation
            >
              <Marker
                coordinate={{
                  latitude: currentLocation.latitude,
                  longitude: currentLocation.longitude,
                }}
                title="Your Location"
              />
            </MapView>
          </View>
        )}

        {isSharing && (
          <View style={styles.statusBox}>
            <Text style={styles.statusText}>
              ✓ Location sharing is active. Customer can see your location.
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
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  sharingControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  sharingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  sharingLabel: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  sharingDescription: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
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
  statusBox: {
    backgroundColor: '#E6F7E6',
    borderWidth: 2,
    borderColor: colors.success,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
  },
  statusText: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
    textAlign: 'center',
  },
});

