/**
 * Booking Check-In Screen - Mobile
 * Check-in flow for bookings
 * Identical functionality to web app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

interface BookingCheckInScreenProps {
  bookingId: string;
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: () => void;
}

export function BookingCheckInScreen({
  bookingId,
  phone,
  customerId,
  onBack,
  onNavigate,
  onSuccess,
}: BookingCheckInScreenProps) {
  const [checkingIn, setCheckingIn] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookingDetails();
    checkLocationPermission();
  }, []);

  const loadBookingDetails = async () => {
    try {
      setLoading(true);
      const response = await CustomerApi.getBookingDetails(bookingId);
      setBooking(response.booking || response);
    } catch (error) {
      console.error('Error loading booking:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync();
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    } catch (error) {
      console.error('Error checking location:', error);
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync();
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } else {
        Alert.alert(
          'Location Permission Required',
          'Please enable location permission to check in',
        );
      }
    } catch (error) {
      console.error('Error requesting location:', error);
    }
  };

  const handleCheckIn = async () => {
    if (!locationPermission) {
      await requestLocationPermission();
      return;
    }

    if (!currentLocation) {
      Alert.alert('Error', 'Unable to get your current location');
      return;
    }

    try {
      setCheckingIn(true);
      const response = await CustomerApi.checkInBooking(bookingId, {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        timestamp: new Date().toISOString(),
      });

      Alert.alert(
        'Check-In Successful',
        'You have been checked in successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              if (onSuccess) {
                onSuccess();
              } else if (onNavigate) {
                onNavigate('BookingDetail', { bookingId });
              }
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error checking in:', error);
      Alert.alert('Error', error.message || 'Failed to check in. Please try again.');
    } finally {
      setCheckingIn(false);
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
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Check In</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>📍</Text>
        </View>

        <Text style={styles.title}>Check In to Booking</Text>
        <Text style={styles.subtitle}>
          Verify your location to check in
        </Text>

        {/* Booking Info */}
        {booking && (
          <View style={styles.bookingInfo}>
            <Text style={styles.bookingService}>{booking.serviceName}</Text>
            {booking.vendorName && (
              <Text style={styles.bookingVendor}>{booking.vendorName}</Text>
            )}
            {booking.appointmentDate && (
              <Text style={styles.bookingDate}>
                {new Date(booking.appointmentDate).toLocaleDateString()} at {booking.appointmentTime}
              </Text>
            )}
          </View>
        )}

        {/* Location Status */}
        <View style={styles.locationStatus}>
          {locationPermission ? (
            <View style={styles.locationStatusSuccess}>
              <Text style={styles.locationStatusIcon}>✓</Text>
              <Text style={styles.locationStatusText}>Location Access Granted</Text>
              {currentLocation && (
                <Text style={styles.locationStatusSubtext}>
                  Ready to check in
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.locationStatusWarning}>
              <Text style={styles.locationStatusIcon}>⚠️</Text>
              <Text style={styles.locationStatusText}>Location Permission Required</Text>
              <Text style={styles.locationStatusSubtext}>
                Please enable location to check in
              </Text>
            </View>
          )}
        </View>

        {/* Check In Button */}
        <TouchableOpacity
          style={[
            styles.checkInButton,
            (!locationPermission || checkingIn) && styles.checkInButtonDisabled,
          ]}
          onPress={handleCheckIn}
          disabled={!locationPermission || checkingIn}
        >
          {checkingIn ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.checkInButtonText}>Check In</Text>
          )}
        </TouchableOpacity>

        {/* Manual Check-In Option */}
        <TouchableOpacity
          style={styles.manualCheckInButton}
          onPress={() => {
            Alert.alert(
              'Manual Check-In',
              'Please show your booking confirmation to the staff at the location.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'I\'m at Location',
                  onPress: handleCheckIn,
                },
              ]
            );
          }}
        >
          <Text style={styles.manualCheckInButtonText}>
            Manual Check-In
          </Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#fff',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: spacing.lg,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  bookingInfo: {
    backgroundColor: '#fff',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  bookingService: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  bookingVendor: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  bookingDate: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  locationStatus: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  locationStatusSuccess: {
    backgroundColor: '#dcfce7',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.success,
  },
  locationStatusWarning: {
    backgroundColor: '#fef3c7',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.warning,
  },
  locationStatusIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  locationStatusText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  locationStatusSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  checkInButton: {
    width: '100%',
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  checkInButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  checkInButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  manualCheckInButton: {
    width: '100%',
    padding: spacing.md,
    alignItems: 'center',
  },
  manualCheckInButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});

