/**
 * Live Tracking Dashboard Screen - Mobile
 * Real-time tracking dashboard for active bookings
 * Identical functionality to web app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { ScreenShell } from '../../components/layout/ScreenShell';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { GPSTrackingApi, CustomerApi } from '../../services/api';

interface LiveTrackingDashboardScreenProps {
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface ActiveBooking {
  id: string;
  bookingId: string;
  serviceName: string;
  petName: string;
  vendorName: string;
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  route?: Array<{ latitude: number; longitude: number }>;
  eta?: number;
  distance?: number;
  status: string;
}

export function LiveTrackingDashboardScreen({
  phone,
  customerId,
  onBack,
  onNavigate,
}: LiveTrackingDashboardScreenProps) {
  const [activeBookings, setActiveBookings] = useState<ActiveBooking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<ActiveBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadActiveBookings();
    const interval = setInterval(() => {
      loadActiveBookings();
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const loadActiveBookings = async () => {
    try {
      setLoading(true);
      if (customerId) {
        const bookings = await CustomerApi.getBookings(customerId);
        const bookingsData = Array.isArray(bookings) ? bookings : (bookings as any).bookings || [];
        const active = bookingsData.filter((b: any) => 
          ['confirmed', 'in_progress', 'on_the_way'].includes(b.status)
        );

        const bookingsWithTracking = await Promise.all(
          active.map(async (booking: any) => {
            try {
              const tracking = await GPSTrackingApi.getLiveLocation(booking.id);
              return {
                ...booking,
                currentLocation: tracking.location,
                route: tracking.route,
                eta: tracking.eta,
                distance: tracking.distance,
              };
            } catch {
              return booking;
            }
          })
        );

        setActiveBookings(bookingsWithTracking);
        if (bookingsWithTracking.length > 0 && !selectedBooking) {
          setSelectedBooking(bookingsWithTracking[0]);
        }
      }
    } catch (error) {
      console.error('Error loading active bookings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadActiveBookings();
  };

  const getRegion = () => {
    if (selectedBooking?.currentLocation) {
      return {
        latitude: selectedBooking.currentLocation.latitude,
        longitude: selectedBooking.currentLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    return {
      latitude: 19.0760,
      longitude: 72.8777,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    };
  };

  const renderBookingItem = ({ item }: { item: ActiveBooking }) => (
    <TouchableOpacity
      style={[
        styles.bookingCard,
        selectedBooking?.id === item.id && styles.bookingCardSelected,
      ]}
      onPress={() => setSelectedBooking(item)}
    >
      <View style={styles.bookingHeader}>
        <View style={styles.bookingInfo}>
          <Text style={styles.serviceName}>{item.serviceName}</Text>
          <Text style={styles.petName}>For {item.petName}</Text>
          <Text style={styles.vendorName}>{item.vendorName}</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>
      {item.eta && (
        <View style={styles.etaContainer}>
          <Text style={styles.etaLabel}>ETA:</Text>
          <Text style={styles.etaValue}>{Math.floor(item.eta / 60)} min</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading && activeBookings.length === 0) {
    return (
      <ScreenShell style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Tracking</Text>
        <View style={styles.placeholder} />
      </View>

      {activeBookings.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📍</Text>
          <Text style={styles.emptyTitle}>No Active Bookings</Text>
          <Text style={styles.emptySubtitle}>
            You don't have any active bookings to track
          </Text>
        </View>
      ) : (
        <>
          {/* Map View */}
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              initialRegion={getRegion()}
              showsUserLocation={true}
            >
              {selectedBooking?.currentLocation && (
                <>
                  <Marker
                    coordinate={selectedBooking.currentLocation}
                    title={selectedBooking.serviceName}
                    pinColor={colors.primary}
                  />
                  {selectedBooking.route && selectedBooking.route.length > 1 && (
                    <Polyline
                      coordinates={selectedBooking.route}
                      strokeColor={colors.primary}
                      strokeWidth={4}
                    />
                  )}
                </>
              )}
            </MapView>
          </View>

          {/* Active Bookings List */}
          <View style={styles.bookingsList}>
            <Text style={styles.listTitle}>Active Bookings ({activeBookings.length})</Text>
            <FlatList
              data={activeBookings}
              renderItem={renderBookingItem}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            />
          </View>

          {/* Quick Actions */}
          {selectedBooking && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() =>
                  onNavigate &&
                  onNavigate('Chat', {
                    bookingId: selectedBooking.bookingId,
                    recipientName: selectedBooking.vendorName || 'Provider',
                  })
                }
              >
                <Text style={styles.actionButtonIcon}>💬</Text>
                <Text style={styles.actionButtonText}>Message</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onNavigate && onNavigate('GPSTracking', { bookingId: selectedBooking.bookingId })}
              >
                <Text style={styles.actionButtonIcon}>📍</Text>
                <Text style={styles.actionButtonText}>Track</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onNavigate && onNavigate('BookingDetail', { bookingId: selectedBooking.bookingId })}
              >
                <Text style={styles.actionButtonIcon}>📋</Text>
                <Text style={styles.actionButtonText}>Details</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </ScreenShell>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapContainer: {
    height: 400,
  },
  map: {
    flex: 1,
  },
  bookingsList: {
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  bookingCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginLeft: spacing.md,
    width: 280,
    borderWidth: 2,
    borderColor: colors.border,
  },
  bookingCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.gradientOrange50,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  bookingInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  petName: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  vendorName: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  statusBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.primary,
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  etaLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  etaValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
  },
  actions: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  actionButtonIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  actionButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

