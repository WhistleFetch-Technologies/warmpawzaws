/**
 * Bookings Screen - Vendor Mobile App
 * Lists all vendor bookings with filters
 * Matches web app VendorBookingManagement
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, publicAnonKey } from '../../config/api';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface Booking {
  id: string;
  bookingId?: string;
  time: string;
  customerName: string;
  petName: string;
  petType: string;
  location: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed' | 'in_progress';
  phone: string;
  date: string;
  price: number;
  serviceName: string;
  communicationType?: 'call' | 'video' | 'clinic' | 'at_home';
}

export default function BookingsScreen({ navigation }: any) {
  const { vendor } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed'>('all');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (vendor?.id) {
      loadBookings();
    }
  }, [vendor, activeFilter, selectedDate]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/bookings/${vendor?.id}?date=${selectedDate}&filter=${activeFilter === 'all' ? 'all' : activeFilter}`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const mappedBookings = (data.bookings || []).map((booking: any) => ({
          id: booking.id,
          bookingId: booking.bookingId || booking.id,
          time: booking.scheduledTime || booking.time || '10:00 AM',
          customerName: booking.customerName || 'Customer',
          petName: booking.petName || 'Pet',
          petType: booking.petType || 'Dog',
          location: booking.location || booking.address || 'N/A',
          status: booking.status || 'pending',
          phone: booking.customerPhone || booking.phone || '',
          date: booking.date || booking.scheduledDate || selectedDate,
          price: booking.price || booking.amount || 0,
          serviceName: booking.serviceName || booking.service?.name || 'Service',
          communicationType: booking.communicationType || booking.serviceType || 'clinic',
        }));
        setBookings(mappedBookings);
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadBookings();
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return BrandColors.semantic.success;
      case 'pending':
        return BrandColors.semantic.warning;
      case 'cancelled':
        return BrandColors.semantic.error;
      case 'completed':
        return BrandColors.semantic.info;
      default:
        return BrandColors.neutral.gray500;
    }
  };

  const renderBookingItem = ({ item }: { item: Booking }) => (
    <TouchableOpacity
      style={styles.bookingCard}
      onPress={() => navigation?.navigate('BookingDetail', { bookingId: item.bookingId || item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.bookingHeader}>
        <View style={styles.bookingTimeContainer}>
          <Icon name="schedule" size={20} color={BrandColors.primary.orange} />
          <Text style={[Typography.body, styles.bookingTime]}>{item.time}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) + '20' },
          ]}
        >
          <Text
            style={[
              Typography.bodyTiny,
              { color: getStatusColor(item.status) },
            ]}
          >
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.bookingContent}>
        <Text style={[Typography.h4, styles.customerName]}>
          {item.customerName}
        </Text>
        <View style={styles.bookingInfoRow}>
          <Icon name="pets" size={16} color={BrandColors.neutral.gray600} />
          <Text style={[Typography.bodySmall, styles.bookingInfo]}>
            {item.petName} ({item.petType})
          </Text>
        </View>
        <View style={styles.bookingInfoRow}>
          <Icon name="business-center" size={16} color={BrandColors.neutral.gray600} />
          <Text style={[Typography.bodySmall, styles.bookingInfo]}>
            {item.serviceName}
          </Text>
        </View>
        <View style={styles.bookingInfoRow}>
          <Icon name="place" size={16} color={BrandColors.neutral.gray600} />
          <Text style={[Typography.bodySmall, styles.bookingInfo]} numberOfLines={1}>
            {item.location}
          </Text>
        </View>
        <View style={styles.bookingInfoRow}>
          <Icon name="attach-money" size={16} color={BrandColors.semantic.success} />
          <Text style={[Typography.body, styles.bookingPrice]}>
            ₹{item.price}
          </Text>
        </View>
      </View>

      <View style={styles.bookingActions}>
        {item.communicationType === 'video' && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              // Navigate to video call
              navigation?.navigate('VideoCall', {
                bookingId: item.bookingId || item.id,
                userId: vendor?.id || '',
                userName: vendor?.businessName || 'Vendor',
                otherUserName: item.customerName,
              });
            }}
          >
            <Icon name="videocam" size={20} color={BrandColors.primary.orange} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            navigation?.navigate('Chat', {
              chatId: `chat-${item.id}`,
              recipientId: item.customerName,
            });
          }}
        >
          <Icon name="message" size={20} color={BrandColors.primary.orange} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading && bookings.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Loading bookings...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        >
          {(['all', 'pending', 'confirmed', 'completed'] as const).map((filter) => (
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
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Bookings List */}
      {bookings.length > 0 ? (
        <FlatList
          data={bookings}
          renderItem={renderBookingItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={BrandColors.primary.orange}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Icon name="event-busy" size={64} color={BrandColors.neutral.gray300} />
          <Text style={[Typography.h3, styles.emptyTitle]}>No Bookings</Text>
          <Text style={[Typography.bodySmall, styles.emptyText]}>
            {activeFilter === 'all'
              ? "You don't have any bookings yet"
              : `No ${activeFilter} bookings found`}
          </Text>
        </View>
      )}
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
  filtersContainer: {
    backgroundColor: BrandColors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
    paddingVertical: Spacing.base,
  },
  filtersContent: {
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
  },
  filterButton: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: BrandColors.neutral.gray100,
    marginRight: Spacing.sm,
  },
  filterButtonActive: {
    backgroundColor: BrandColors.primary.orange,
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  listContent: {
    padding: Spacing.base,
  },
  bookingCard: {
    backgroundColor: BrandColors.neutral.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  bookingTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  bookingTime: {
    color: BrandColors.neutral.gray900,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  bookingContent: {
    marginBottom: Spacing.base,
  },
  customerName: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.sm,
  },
  bookingInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  bookingInfo: {
    color: BrandColors.neutral.gray600,
    flex: 1,
  },
  bookingPrice: {
    color: BrandColors.semantic.success,
    fontWeight: '600',
  },
  bookingActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.base,
    paddingTop: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: BrandColors.primary.orange + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyTitle: {
    color: BrandColors.neutral.gray900,
    marginTop: Spacing.base,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    color: BrandColors.neutral.gray600,
    textAlign: 'center',
  },
});

