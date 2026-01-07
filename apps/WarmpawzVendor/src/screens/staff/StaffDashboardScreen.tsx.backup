/**
 * Staff Dashboard Screen
 * Staff-specific dashboard with assigned bookings and schedule
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Alert,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { StaffApi } from '../../services/api';

interface StaffDashboardScreenProps {
  staffId: string;
  staffData: any;
  onNavigate: (screen: string, data?: any) => void;
}

interface DashboardStats {
  assignedBookings: number;
  completedToday: number;
  upcomingBookings: number;
  rating: number;
}

interface ScheduleItem {
  id: string;
  bookingId: string;
  time: string;
  customerName: string;
  serviceName: string;
  status: string;
}

export function StaffDashboardScreen({
  staffId,
  staffData,
  onNavigate,
}: StaffDashboardScreenProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    assignedBookings: 0,
    completedToday: 0,
    upcomingBookings: 0,
    rating: 0,
  });
  const [todaySchedule, setTodaySchedule] = useState<ScheduleItem[]>([]);
  const [activeBookings, setActiveBookings] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [staffId]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load staff appointments
      const appointmentsResponse = await StaffApi.getAppointments(staffId);
      const appointments = appointmentsResponse.appointments || [];
      
      // Calculate stats
      const today = new Date().toISOString().split('T')[0];
      const todayBookings = appointments.filter((b: any) => {
        const bookingDate = b.booking_date || b.date || b.createdAt;
        return bookingDate?.startsWith(today);
      });
      
      const completedToday = todayBookings.filter((b: any) => b.status === 'completed').length;
      const upcoming = appointments.filter((b: any) => 
        b.status === 'confirmed' || b.status === 'pending'
      );
      
      setStats({
        assignedBookings: appointments.length,
        completedToday,
        upcomingBookings: upcoming.length,
        rating: staffData?.rating || 0,
      });
      
      // Set today's schedule
      const schedule = todayBookings.map((b: any) => ({
        id: b.id,
        bookingId: b.id,
        time: b.booking_time || b.time || 'N/A',
        customerName: b.customer_name || b.customerName || 'Customer',
        serviceName: b.service_name || b.serviceName || 'Service',
        status: b.status,
      }));
      setTodaySchedule(schedule);
      
      // Set active bookings
      const active = appointments.filter((b: any) => 
        b.status === 'confirmed' || b.status === 'in_progress'
      );
      setActiveBookings(active);
    } catch (error: any) {
      console.error('Error loading staff dashboard:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to load dashboard. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboardData();
  }, [staffId]);

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
        <View>
          <Text style={styles.greeting}>Hello, {staffData?.fullName || staffData?.name || 'Staff'}</Text>
          <Text style={styles.subtitle}>Your assigned bookings</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.assignedBookings}</Text>
            <Text style={styles.statLabel}>Assigned</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.completedToday}</Text>
            <Text style={styles.statLabel}>Completed Today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.upcomingBookings}</Text>
            <Text style={styles.statLabel}>Upcoming</Text>
          </View>
        </View>

        {/* Active Bookings */}
        {activeBookings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Bookings</Text>
            <FlatList
              data={activeBookings}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.bookingCard}
                  onPress={() => onNavigate('BookingDetail', { bookingId: item.id, staffId })}
                >
                  <View style={styles.bookingHeader}>
                    <Text style={styles.bookingCustomer}>{item.customer_name || item.customerName || 'Customer'}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                        {item.status?.toUpperCase() || 'UNKNOWN'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.bookingService}>{item.service_name || item.serviceName || 'Service'}</Text>
                  <Text style={styles.bookingTime}>
                    {item.booking_time || item.time || 'N/A'} - {item.booking_date || item.date || 'Today'}
                  </Text>
                </TouchableOpacity>
              )}
              scrollEnabled={false}
            />
          </View>
        )}

        {/* Today's Schedule */}
        {todaySchedule.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Schedule</Text>
            <FlatList
              data={todaySchedule}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.scheduleItem}>
                  <View style={styles.scheduleTime}>
                    <Text style={styles.scheduleTimeText}>{item.time}</Text>
                  </View>
                  <View style={styles.scheduleDetails}>
                    <Text style={styles.scheduleCustomer}>{item.customerName}</Text>
                    <Text style={styles.scheduleService}>{item.serviceName}</Text>
                  </View>
                  <View style={[styles.scheduleStatus, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                    <Text style={[styles.scheduleStatusText, { color: getStatusColor(item.status) }]}>
                      {item.status?.toUpperCase() || 'UNKNOWN'}
                    </Text>
                  </View>
                </View>
              )}
              scrollEnabled={false}
            />
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onNavigate('Bookings', { staffId })}
            >
              <Text style={styles.actionButtonText}>View All Bookings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onNavigate('Earnings', { staffId })}
            >
              <Text style={styles.actionButtonText}>View Earnings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onNavigate('Schedule', { staffId })}
            >
              <Text style={styles.actionButtonText}>My Schedule</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'pending':
      return colors.warning;
    case 'confirmed':
      return colors.info;
    case 'in_progress':
      return colors.primary;
    case 'completed':
      return colors.success;
    case 'cancelled':
      return colors.error;
    default:
      return colors.textSecondary;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  greeting: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  content: {
    padding: spacing.lg,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.xs,
    alignItems: 'center',
  },
  statValue: {
    ...typography.h2,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  bookingCard: {
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  bookingCustomer: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  bookingService: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  bookingTime: {
    ...typography.caption,
    color: colors.textMuted,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  scheduleTime: {
    width: 60,
    alignItems: 'center',
  },
  scheduleTimeText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primary,
  },
  scheduleDetails: {
    flex: 1,
    marginLeft: spacing.md,
  },
  scheduleCustomer: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  scheduleService: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  scheduleStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  scheduleStatusText: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 10,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginHorizontal: spacing.xs,
  },
  actionButtonText: {
    ...typography.button,
    color: colors.card,
  },
});

