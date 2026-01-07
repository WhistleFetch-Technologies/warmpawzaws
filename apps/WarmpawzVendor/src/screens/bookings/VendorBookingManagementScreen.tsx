/**
 * Vendor Booking Management Screen
 * Booking handling
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
  Alert,
  RefreshControl,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { VendorApi, StaffApi } from '../../services/api';

interface VendorBookingManagementScreenProps {
  vendorId?: string;
  staffId?: string;
  onBack?: () => void;
  onSelectBooking?: (bookingId: string) => void;
}

export function VendorBookingManagementScreen({
  vendorId,
  staffId,
  onBack,
  onSelectBooking,
}: VendorBookingManagementScreenProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'>('all');
  const isStaff = !!staffId;

  useEffect(() => {
    loadBookings();
  }, [vendorId, staffId, filter]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      
      // If staff, load staff appointments instead of vendor bookings
      if (isStaff && staffId) {
        const response = await StaffApi.getAppointments(staffId);
        const appointments = response.appointments || [];
        
        let filtered = appointments;
        if (filter !== 'all') {
          filtered = appointments.filter((b: any) => {
            if (filter === 'pending') return b.status === 'pending';
            if (filter === 'confirmed') return b.status === 'confirmed' || b.status === 'in_progress';
            if (filter === 'completed') return b.status === 'completed';
            if (filter === 'cancelled') return b.status === 'cancelled' || b.status === 'cancelled_by_vendor';
            return true;
          });
        }
        
        setBookings(filtered);
      } else if (vendorId) {
        // Vendor: load all bookings
        const response = await VendorApi.getBookings(vendorId);
        const bookingsData = Array.isArray(response) ? response : response.bookings || [];
        
        let filtered = bookingsData;
        if (filter !== 'all') {
          filtered = bookingsData.filter((b: any) => {
            if (filter === 'pending') return b.status === 'pending';
            if (filter === 'confirmed') return b.status === 'confirmed' || b.status === 'in_progress';
            if (filter === 'completed') return b.status === 'completed';
            if (filter === 'cancelled') return b.status === 'cancelled' || b.status === 'cancelled_by_vendor';
            return true;
          });
        }
        
        setBookings(filtered);
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

  const handleAccept = async (bookingId: string) => {
    // Staff cannot accept bookings
    if (isStaff) {
      Alert.alert('Permission Denied', 'Staff members cannot accept bookings. Please contact the vendor.');
      return;
    }
    
    if (!vendorId) return;
    
    try {
      await VendorApi.acceptBooking(bookingId, vendorId);
      Alert.alert('Success', 'Booking accepted successfully!');
      loadBookings();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to accept booking. Please try again.');
    }
  };

  const handleReject = async (bookingId: string, reason?: string) => {
    // Staff cannot reject bookings
    if (isStaff) {
      Alert.alert('Permission Denied', 'Staff members cannot reject bookings. Please contact the vendor.');
      return;
    }
    
    if (!vendorId) return;
    
    Alert.prompt(
      'Reject Booking',
      'Please provide a reason for rejection:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async (rejectionReason) => {
            try {
              await VendorApi.rejectBooking(bookingId, vendorId, rejectionReason || reason);
              Alert.alert('Success', 'Booking rejected successfully!');
              loadBookings();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to reject booking. Please try again.');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'in_progress':
        return colors.success;
      case 'completed':
        return colors.info;
      case 'cancelled':
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
    <View style={styles.bookingCard}>
      <View style={styles.bookingHeader}>
        <View style={styles.bookingInfo}>
          <Text style={styles.customerName}>{item.customerName || 'Customer'}</Text>
          <Text style={styles.serviceName}>{item.serviceName || 'Service'}</Text>
          {item.petName && <Text style={styles.petName}>Pet: {item.petName}</Text>}
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
          {item.scheduledTime && <Text style={styles.detailText}>⏰ {item.scheduledTime}</Text>}
        </View>
      )}

      {item.amount && (
        <Text style={styles.amount}>₹{item.amount}</Text>
      )}

      {item.status === 'pending' && !isStaff && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => handleAccept(item.id)}
          >
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleReject(item.id)}
          >
            <Text style={styles.rejectButtonText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={styles.viewButton}
        onPress={() => {
          if (onSelectBooking) {
            onSelectBooking(item.id);
          }
        }}
      >
        <Text style={styles.viewButtonText}>View Details →</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Booking Management</Text>
      </View>

      <View style={styles.filters}>
        {(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as const).map((f) => (
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

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={renderBookingItem}
          contentContainerStyle={styles.listContent}
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
  filters: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
    flexWrap: 'wrap',
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
    backgroundColor: colors.primary.50,
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
  customerName: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  serviceName: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
  },
  petName: {
    fontSize: typography.fontSizes.sm,
    color: colors.textMuted,
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
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: colors.success,
  },
  acceptButtonText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.white,
  },
  rejectButton: {
    backgroundColor: colors.error,
  },
  rejectButtonText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.white,
  },
  viewButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  viewButtonText: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
});

