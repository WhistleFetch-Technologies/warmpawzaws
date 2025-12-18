/**
 * Bookings Screen - Customer Mobile App
 * List of all customer bookings
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, publicAnonKey } from '../../config/api';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface Booking {
  id: string;
  serviceName: string;
  vendorName: string;
  scheduledDate: string;
  scheduledTime: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  amount: number;
}

interface BookingsScreenProps {
  navigation?: any;
}

export default function BookingsScreen({ navigation }: BookingsScreenProps) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'upcoming' | 'past'>('all');

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      setLoading(true);
      if (!user?.id) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/${encodeURIComponent(user.id)}/bookings`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setBookings(data.bookings || []);
      } else {
        console.error('Failed to load bookings');
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadBookings();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return BrandColors.semantic.success;
      case 'pending':
        return BrandColors.semantic.warning;
      case 'cancelled':
        return BrandColors.semantic.error;
      case 'completed':
        return BrandColors.neutral.gray600;
      default:
        return BrandColors.neutral.gray400;
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <Text style={[Typography.h2, styles.title]}>My Bookings</Text>
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {(['all', 'upcoming', 'past'] as const).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterButton,
              activeFilter === filter && styles.filterButtonActive,
            ]}
            onPress={() => setActiveFilter(filter)}
          >
            <Text
              style={[
                Typography.bodySmall,
                activeFilter === filter && styles.filterButtonTextActive,
              ]}
            >
              {filter === 'all' ? 'All' : filter === 'upcoming' ? 'Upcoming' : 'Past'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BrandColors.primary.orange}
          />
        }
      >
        {bookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="calendar-today" size={64} color={BrandColors.neutral.gray300} />
            <Text style={[Typography.h3, styles.emptyText]}>No bookings yet</Text>
            <Text style={[Typography.bodySmall, styles.emptySubtext]}>
              Book a service to see it here
            </Text>
            <TouchableOpacity
              style={styles.bookButton}
              onPress={() => navigation?.navigate('Home')}
            >
              <Text style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                Book a Service
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          bookings.map((booking) => (
            <TouchableOpacity
              key={booking.id}
              style={styles.bookingCard}
              onPress={() => navigation?.navigate('BookingDetail', { bookingId: booking.id })}
            >
              <View style={styles.bookingHeader}>
                <View style={styles.bookingInfo}>
                  <Text style={[Typography.h4, styles.serviceName]}>{booking.serviceName}</Text>
                  <Text style={[Typography.bodySmall, styles.vendorName]}>{booking.vendorName}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) + '20' }]}>
                  <Text style={[Typography.bodyTiny, { color: getStatusColor(booking.status) }]}>
                    {booking.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={styles.bookingDetails}>
                <View style={styles.detailRow}>
                  <Icon name="calendar-today" size={16} color={BrandColors.neutral.gray500} />
                  <Text style={[Typography.bodySmall, styles.detailText]}>
                    {booking.scheduledDate} at {booking.scheduledTime}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Icon name="currency-rupee" size={16} color={BrandColors.neutral.gray500} />
                  <Text style={[Typography.bodySmall, styles.detailText]}>
                    ₹{booking.amount}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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
  header: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
  },
  title: {
    color: BrandColors.neutral.gray900,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.base,
    gap: Spacing.sm,
  },
  filterButton: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: BrandColors.neutral.gray100,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  filterButtonActive: {
    backgroundColor: BrandColors.primary.orange,
    borderColor: BrandColors.primary.orange,
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    minHeight: 400,
  },
  emptyText: {
    color: BrandColors.neutral.gray900,
    marginTop: Spacing.base,
    marginBottom: Spacing.xs,
  },
  emptySubtext: {
    color: BrandColors.neutral.gray600,
    marginBottom: Spacing.lg,
  },
  bookButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.base,
    backgroundColor: BrandColors.primary.orange,
    borderRadius: BorderRadius.md,
  },
  bookingCard: {
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  bookingInfo: {
    flex: 1,
  },
  serviceName: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  vendorName: {
    color: BrandColors.neutral.gray600,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  bookingDetails: {
    gap: Spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  detailText: {
    color: BrandColors.neutral.gray700,
  },
});

