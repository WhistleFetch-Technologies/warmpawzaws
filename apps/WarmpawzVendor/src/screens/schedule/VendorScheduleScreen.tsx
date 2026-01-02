/**
 * Vendor Schedule Screen
 * View and manage vendor schedule/appointments
 * Missing screen implementation
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { VendorApi } from '../../services/api';

interface VendorScheduleScreenProps {
  vendorId: string;
  onBack?: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface ScheduleItem {
  id: string;
  time: string;
  customerName: string;
  serviceName: string;
  status: string;
  bookingId?: string;
}

export function VendorScheduleScreen({
  vendorId,
  onBack,
  onNavigate,
}: VendorScheduleScreenProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    loadSchedule();
  }, [vendorId, selectedDate]);

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const dateStr = selectedDate.toISOString().split('T')[0];
      const response = await VendorApi.getDashboard(vendorId, 'today');
      
      // Extract schedule from dashboard response
      if (response.schedule) {
        setSchedule(response.schedule);
      } else {
        // Fallback: get bookings and format as schedule
        const bookingsResponse = await VendorApi.getBookings(vendorId);
        const bookings = Array.isArray(bookingsResponse) ? bookingsResponse : bookingsResponse.bookings || [];
        
        const scheduleItems: ScheduleItem[] = bookings
          .filter((b: any) => {
            const bookingDate = b.booking_date || b.date || b.scheduledAt;
            return bookingDate?.startsWith(dateStr);
          })
          .map((b: any) => ({
            id: b.id,
            time: b.booking_time || b.time || 'N/A',
            customerName: b.customer_name || b.customerName || 'Customer',
            serviceName: b.service_name || b.serviceName || 'Service',
            status: b.status,
            bookingId: b.id,
          }));
        
        setSchedule(scheduleItems);
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadSchedule();
  };

  const renderScheduleItem = ({ item }: { item: ScheduleItem }) => (
    <TouchableOpacity
      style={styles.scheduleCard}
      onPress={() => {
        if (item.bookingId && onNavigate) {
          onNavigate('BookingDetail', { bookingId: item.bookingId });
        }
      }}
    >
      <View style={styles.scheduleTime}>
        <Text style={styles.scheduleTimeText}>{item.time}</Text>
      </View>
      <View style={styles.scheduleInfo}>
        <Text style={styles.scheduleCustomer}>{item.customerName}</Text>
        <Text style={styles.scheduleService}>{item.serviceName}</Text>
      </View>
      <View style={styles.scheduleStatus}>
        <Text style={[styles.statusBadge, { color: getStatusColor(item.status) }]}>
          {item.status}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return colors.success;
      case 'pending':
        return colors.warning;
      case 'completed':
        return colors.info;
      default:
        return colors.textSecondary;
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
        <Text style={styles.title}>Schedule</Text>
        <Text style={styles.subtitle}>
          {selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {schedule.length > 0 ? (
          <FlatList
            data={schedule}
            keyExtractor={(item) => item.id}
            renderItem={renderScheduleItem}
            scrollEnabled={false}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No appointments scheduled for this date</Text>
          </View>
        )}
      </ScrollView>
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
    padding: spacing.lg,
  },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  scheduleTime: {
    width: 80,
    marginRight: spacing.md,
  },
  scheduleTimeText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleCustomer: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  scheduleService: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
  },
  scheduleStatus: {
    marginLeft: spacing.md,
  },
  statusBadge: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.medium,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
});

