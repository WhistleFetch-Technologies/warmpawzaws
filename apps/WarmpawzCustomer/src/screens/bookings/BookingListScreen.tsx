/**
 * Booking List Screen
 * View all bookings
 * Identical functionality to web app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

interface BookingListScreenProps {
  phone: string;
  onSelectBooking: (bookingId: string) => void;
  onBack?: () => void;
  /** Root stack navigate; tab roots use `MainTabs` + `{ screen }`; Profile from this screen uses stack `CustomerProfile` so Back returns here. */
  onNavigate?: (screen: string, data?: any) => void;
}

export function BookingListScreen({
  phone,
  onSelectBooking,
  onBack,
  onNavigate,
}: BookingListScreenProps) {
  const insets = useSafeAreaInsets();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past' | 'cancelled'>('all');

  useEffect(() => {
    loadBookings();
  }, [filter]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const response = await CustomerApi.getBookings(phone);
      const bookingsData = Array.isArray(response) ? response : response.bookings || [];
      
      let filtered = bookingsData;
      if (filter === 'upcoming') {
        filtered = bookingsData.filter((b: any) => 
          ['pending', 'confirmed', 'in_progress'].includes(b.status)
        );
      } else if (filter === 'past') {
        filtered = bookingsData.filter((b: any) => b.status === 'completed');
      } else if (filter === 'cancelled') {
        filtered = bookingsData.filter((b: any) => 
          ['cancelled', 'cancelled_by_customer', 'cancelled_by_vendor'].includes(b.status)
        );
      }
      
      setBookings(filtered);
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
      case 'in_progress':
        return colors.success;
      case 'completed':
        return colors.info;
      case 'cancelled':
      case 'cancelled_by_customer':
      case 'cancelled_by_vendor':
        return colors.error;
      default:
        return colors.warning;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderBookingItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.bookingCard}
      onPress={() => onSelectBooking(item.id)}
    >
      <View style={styles.bookingHeader}>
        <View style={styles.bookingInfo}>
          <Text style={styles.serviceName}>{item.serviceName || 'Service'}</Text>
          <Text style={styles.vendorName}>{item.vendorName || 'Vendor'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
      </View>
      
      {item.scheduledDate && (
        <View style={styles.bookingDetails}>
          <Text style={styles.detailText}>📅 {formatDate(item.scheduledDate)}</Text>
          {item.scheduledTime && (
            <Text style={styles.detailText}>⏰ {item.scheduledTime}</Text>
          )}
        </View>
      )}
      
      {item.amount && (
        <Text style={styles.amount}>₹{item.amount}</Text>
      )}
    </TouchableOpacity>
  );

  const footerPad = 52 + Math.max(insets.bottom, spacing.sm);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>My Bookings</Text>
      </View>

      <View style={styles.filters}>
        {(['all', 'upcoming', 'past', 'cancelled'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterButton, filter === f && styles.filterButtonActive]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.filterText,
                filter === f && styles.filterTextActive,
              ]}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.body}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            style={styles.list}
            data={bookings}
            keyExtractor={(item) => item.id}
            renderItem={renderBookingItem}
            contentContainerStyle={[styles.listContent, { paddingBottom: onNavigate ? footerPad : spacing.md }]}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No bookings found</Text>
              </View>
            }
          />
        )}
      </View>

      {onNavigate ? (
        <View
          style={[
            styles.bookingFooter,
            {
              paddingBottom: Math.max(insets.bottom, spacing.sm),
              borderTopColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.footerItem}
            onPress={() => onNavigate('MainTabs', { screen: 'Home' })}
            accessibilityRole="button"
            accessibilityLabel="Home"
          >
            <Icon name="home-outline" size={22} color={colors.textMuted} />
            <Text style={styles.footerLabel}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.footerItem}
            onPress={() => onNavigate('MainTabs', { screen: 'Store' })}
            accessibilityRole="button"
            accessibilityLabel="Store"
          >
            <Icon name="shopping-outline" size={22} color={colors.textMuted} />
            <Text style={styles.footerLabel}>Store</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.footerItem}
            onPress={() => onNavigate('ShoppingCart')}
            accessibilityRole="button"
            accessibilityLabel="Cart"
          >
            <Icon name="cart-outline" size={22} color={colors.textMuted} />
            <Text style={styles.footerLabel}>Cart</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerItem} accessibilityRole="button" accessibilityLabel="Bookings">
            <Icon name="calendar-check" size={22} color={colors.primary} />
            <Text style={[styles.footerLabel, styles.footerLabelActive]}>Bookings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.footerItem}
            onPress={() => onNavigate('CustomerProfile')}
            accessibilityRole="button"
            accessibilityLabel="Profile"
          >
            <Icon name="account-outline" size={22} color={colors.textMuted} />
            <Text style={styles.footerLabel}>Profile</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
  },
  list: {
    flex: 1,
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
  filters: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  filterButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.gradientOrange50,
  },
  filterText: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
  },
  filterTextActive: {
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: spacing.md,
  },
  bookingCard: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  bookingInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  vendorName: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.md,
  },
  statusText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.medium,
  },
  bookingDetails: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  detailText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  amount: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginTop: spacing.xs,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  bookingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: 1,
  },
  footerItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
    paddingVertical: spacing.xs,
  },
  footerLabel: {
    marginTop: 2,
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
    fontWeight: typography.fontWeights.medium,
  },
  footerLabelActive: {
    color: colors.primary,
  },
});

