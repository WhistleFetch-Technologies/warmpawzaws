/**
 * Vendor Dashboard Screen
 * Main dashboard with all capabilities
 * Identical functionality to web app
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
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { VendorApi } from '../../services/api';

interface VendorDashboardScreenProps {
  vendorId: string;
  vendorData: any;
  onNavigate: (screen: string, data?: any) => void;
}

interface DashboardStats {
  appointments: number;
  consultations: number;
  earnings: number;
  pendingEarnings: number;
  completedServices: number;
  rating: number;
  totalReviews: number;
}

interface ScheduleItem {
  id: string;
  bookingId: string;
  time: string;
  customerName: string;
  serviceName: string;
  status: string;
  price: number;
}

export function VendorDashboardScreen({
  vendorId,
  vendorData,
  onNavigate,
}: VendorDashboardScreenProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    appointments: 0,
    consultations: 0,
    earnings: 0,
    pendingEarnings: 0,
    completedServices: 0,
    rating: 0,
    totalReviews: 0,
  });
  const [todaySchedule, setTodaySchedule] = useState<ScheduleItem[]>([]);
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'month'>('today');

  useEffect(() => {
    loadDashboardData();
  }, [vendorId, activeTab]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      // ✅ WIRED: Using actual dashboard endpoint (Task 5 - Endpoint Wiring)
      const dashboardResponse = await VendorApi.getDashboard(vendorId, activeTab);
      const profileResponse = await VendorApi.getProfile(vendorId);
      
      // Use dashboard stats if available, otherwise use profile data
      if (dashboardResponse.stats) {
        const tr =
          Number(
            dashboardResponse.stats.totalReviews ??
              profileResponse.totalReviews ??
              0
          ) || 0;
        const rawR =
          dashboardResponse.stats.rating != null
            ? Number(dashboardResponse.stats.rating)
            : profileResponse.rating != null
              ? Number(profileResponse.rating)
              : NaN;
        const ratingVal =
          tr > 0 && Number.isFinite(rawR) && rawR > 0 ? rawR : 0;
        setStats({
          appointments: dashboardResponse.stats.appointments || 0,
          consultations: dashboardResponse.stats.consultations || 0,
          earnings: dashboardResponse.stats.earnings || 0,
          pendingEarnings: dashboardResponse.stats.pendingEarnings || 0,
          completedServices: dashboardResponse.stats.completedServices || 0,
          rating: ratingVal,
          totalReviews: tr,
        });
      } else {
        const tr = Number(profileResponse.totalReviews ?? 0) || 0;
        const rawR =
          profileResponse.rating != null ? Number(profileResponse.rating) : NaN;
        const ratingVal =
          tr > 0 && Number.isFinite(rawR) && rawR > 0 ? rawR : 0;
        setStats({
          appointments: 0,
          consultations: 0,
          earnings: 0,
          pendingEarnings: 0,
          completedServices: 0,
          rating: ratingVal,
          totalReviews: tr,
        });
      }
      
      // Set today's schedule if available
      if (dashboardResponse.schedule) {
        setTodaySchedule(dashboardResponse.schedule);
      }
    } catch (error: any) {
      console.error('Error loading dashboard:', error);
      // Fallback to basic stats on error
      setStats({
        appointments: 0,
        consultations: 0,
        earnings: 0,
        pendingEarnings: 0,
        completedServices: 0,
        rating: 0,
        totalReviews: 0,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const capabilityButtons = [
    { id: 'bookings', label: 'Bookings', icon: '📅', onPress: () => onNavigate('bookings') },
    { id: 'services', label: 'Services', icon: '⚙️', onPress: () => onNavigate('services') },
    { id: 'staff', label: 'Staff', icon: '👥', onPress: () => onNavigate('staff') },
    { id: 'schedule', label: 'Schedule', icon: '📆', onPress: () => onNavigate('schedule') },
    { id: 'analytics', label: 'Analytics', icon: '📊', onPress: () => onNavigate('analytics') },
    { id: 'settings', label: 'Settings', icon: '⚙️', onPress: () => onNavigate('settings') },
  ];

  const renderStatCard = (label: string, value: string | number, icon: string) => (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const renderScheduleItem = ({ item }: { item: ScheduleItem }) => (
    <TouchableOpacity
      style={styles.scheduleItem}
      onPress={() => onNavigate('booking-detail', { bookingId: item.bookingId })}
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

  if (loading && !refreshing) {
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>Welcome back!</Text>
            <Text style={styles.vendorName}>
              {vendorData?.businessName || vendorData?.fullName || 'Vendor'}
            </Text>
          </View>
        </View>

        <View style={styles.tabs}>
          {(['today', 'week', 'month'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.statsContainer}>
          {renderStatCard('Appointments', stats.appointments, '📅')}
          {renderStatCard('Earnings', `₹${stats.earnings}`, '💰')}
          {renderStatCard('Rating', stats.rating.toFixed(1), '⭐')}
          {renderStatCard('Completed', stats.completedServices, '✅')}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Schedule</Text>
            <TouchableOpacity onPress={() => onNavigate('schedule')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          {todaySchedule.length > 0 ? (
            <FlatList
              data={todaySchedule}
              keyExtractor={(item) => item.id}
              renderItem={renderScheduleItem}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptySchedule}>
              <Text style={styles.emptyText}>No appointments scheduled for today</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.capabilitiesGrid}>
            {capabilityButtons.map((cap) => (
              <TouchableOpacity
                key={cap.id}
                style={styles.capabilityButton}
                onPress={cap.onPress}
              >
                <Text style={styles.capabilityIcon}>{cap.icon}</Text>
                <Text style={styles.capabilityLabel}>{cap.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
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
  welcomeText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
  },
  vendorName: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  tabs: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  tabActive: {
    borderColor: colors.primary,
    backgroundColor: colors.gradientOrange50,
  },
  tabText: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  statLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  section: {
    padding: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  seeAllText: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  scheduleItem: {
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
    width: 60,
    alignItems: 'center',
    marginRight: spacing.md,
  },
  scheduleTimeText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
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
    marginLeft: spacing.sm,
  },
  statusBadge: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.medium,
  },
  emptySchedule: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  capabilitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  capabilityButton: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capabilityIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  capabilityLabel: {
    fontSize: typography.fontSizes.xs,
    color: colors.text,
    textAlign: 'center',
  },
});

