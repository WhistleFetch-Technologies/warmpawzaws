/**
 * Dashboard Screen - Vendor Mobile App
 * Main dashboard matching web app VendorDashboard
 * Shows stats, schedule, bookings, and quick actions
 */

import React, { useState, useEffect } from 'react';
import { useBookingNotifications } from '../../hooks/useBookingNotifications';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { vendorAPI } from '../../services/api';
import { projectId, publicAnonKey } from '../../config/api';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function DashboardScreen({ navigation }: any) {
  const { vendor } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    appointments: 0,
    consultations: 0,
    earnings: 0,
    pendingEarnings: 0,
    completedServices: 0,
    rating: 0,
    totalReviews: 0,
  });
  const [todaySchedule, setTodaySchedule] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, [vendor]);

  const fetchDashboardData = async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      if (vendor?.id) {
        const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;
        const today = new Date().toISOString().split('T')[0];

        // Fetch dashboard stats and schedule in parallel
        const [dashboardRes, scheduleRes] = await Promise.all([
          fetch(`${API_BASE}/vendor/dashboard/${vendor.id}?timeframe=today`, {
            headers: { Authorization: `Bearer ${publicAnonKey}` },
          }),
          fetch(`${API_BASE}/vendor/schedule/${vendor.id}?date=${today}`, {
            headers: { Authorization: `Bearer ${publicAnonKey}` },
          }),
        ]);

        if (dashboardRes.ok) {
          const dashboardData = await dashboardRes.json();
          if (dashboardData.success && dashboardData.stats) {
            setStats({
              appointments: dashboardData.stats.appointments || 0,
              consultations: dashboardData.stats.consultations || 0,
              earnings: dashboardData.stats.earnings || 0,
              pendingEarnings: dashboardData.stats.pendingEarnings || 0,
              completedServices: dashboardData.stats.completedServices || 0,
              rating: dashboardData.stats.rating || 0,
              totalReviews: dashboardData.stats.totalReviews || 0,
            });
          }
        }

        if (scheduleRes.ok) {
          const scheduleData = await scheduleRes.json();
          if (scheduleData.success && scheduleData.schedule) {
            setTodaySchedule(scheduleData.schedule);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Fallback to placeholder data on error
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Loading dashboard...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchDashboardData(true)}
            tintColor={BrandColors.primary.orange}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <View style={styles.iconContainer}>
                <Icon name="business-center" size={24} color="#FFFFFF" />
              </View>
              <View>
                <Text style={[Typography.h3, styles.businessName]}>
                  {vendor?.businessName || 'Vendor Dashboard'}
                </Text>
                <Text style={[Typography.bodyTiny, styles.businessAddress]}>
                  {vendor?.address || 'India'}
                </Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity
                onPress={() => navigation?.navigate('Profile')}
              >
                <Icon name="notifications" size={24} color={BrandColors.neutral.gray600} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Status Badge */}
          <View style={styles.statusRow}>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>ONLINE</Text>
            </View>
            <View style={styles.ratingRow}>
              <Icon name="star" size={16} color={BrandColors.primary.yellow} />
              <Text style={styles.ratingText}>
                {stats.rating.toFixed(1)} ({stats.totalReviews})
              </Text>
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Icon name="calendar-today" size={24} color={BrandColors.primary.orange} />
            <Text style={[Typography.h2, styles.statValue]}>
              {stats.appointments}
            </Text>
            <Text style={[Typography.bodyTiny, styles.statLabel]}>
              Appointments
            </Text>
          </View>
          <View style={styles.statCard}>
            <Icon name="attach-money" size={24} color={BrandColors.semantic.success} />
            <Text style={[Typography.h2, styles.statValue]}>
              ₹{stats.earnings.toLocaleString()}
            </Text>
            <Text style={[Typography.bodyTiny, styles.statLabel]}>
              Earnings
            </Text>
          </View>
          <View style={styles.statCard}>
            <Icon name="check-circle" size={24} color={BrandColors.semantic.success} />
            <Text style={[Typography.h2, styles.statValue]}>
              {stats.completedServices}
            </Text>
            <Text style={[Typography.bodyTiny, styles.statLabel]}>
              Completed
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation?.navigate('Bookings')}
            >
              <Icon name="calendar-today" size={32} color={BrandColors.primary.orange} />
              <Text style={[Typography.bodySmall, styles.quickActionText]}>
                Bookings
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation?.navigate('Services')}
            >
              <Icon name="business-center" size={32} color={BrandColors.primary.pink} />
              <Text style={[Typography.bodySmall, styles.quickActionText]}>
                Services
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => navigation?.navigate('Profile')}
            >
              <Icon name="person" size={32} color={BrandColors.primary.purple} />
              <Text style={[Typography.bodySmall, styles.quickActionText]}>
                Profile
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Today's Schedule */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Today's Schedule</Text>
          {todaySchedule.length > 0 ? (
            <View style={styles.scheduleList}>
              {todaySchedule.map((item, index) => (
                <View key={index} style={styles.scheduleItem}>
                  <Text style={[Typography.body, styles.scheduleTime]}>
                    {item.time}
                  </Text>
                  <View style={styles.scheduleContent}>
                    <Text style={[Typography.body, styles.scheduleTitle]}>
                      {item.title}
                    </Text>
                    <Text style={[Typography.bodyTiny, styles.scheduleSubtitle]}>
                      {item.customer}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Icon name="event-busy" size={48} color={BrandColors.neutral.gray300} />
              <Text style={[Typography.body, styles.emptyStateText]}>
                No appointments today
              </Text>
            </View>
          )}
        </View>
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
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: BrandColors.primary.orange,
    justifyContent: 'center',
    alignItems: 'center',
  },
  businessName: {
    color: BrandColors.neutral.gray900,
  },
  businessAddress: {
    color: BrandColors.neutral.gray500,
  },
  headerRight: {
    flexDirection: 'row',
    gap: Spacing.base,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.semantic.success + '20',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BrandColors.semantic.success,
  },
  statusText: {
    ...Typography.bodyTiny,
    color: BrandColors.semantic.success,
    fontWeight: '600',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  ratingText: {
    ...Typography.bodySmall,
    color: BrandColors.neutral.gray700,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: Spacing.base,
    gap: Spacing.base,
  },
  statCard: {
    flex: 1,
    backgroundColor: BrandColors.neutral.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  statValue: {
    color: BrandColors.neutral.gray900,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  statLabel: {
    color: BrandColors.neutral.gray600,
  },
  section: {
    padding: Spacing.base,
    paddingTop: 0,
  },
  sectionTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.base,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: Spacing.base,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  quickActionText: {
    color: BrandColors.neutral.gray700,
    marginTop: Spacing.xs,
    fontWeight: '600',
  },
  scheduleList: {
    gap: Spacing.base,
  },
  scheduleItem: {
    flexDirection: 'row',
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    gap: Spacing.base,
  },
  scheduleTime: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
    minWidth: 60,
  },
  scheduleContent: {
    flex: 1,
  },
  scheduleTitle: {
    color: BrandColors.neutral.gray900,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  scheduleSubtitle: {
    color: BrandColors.neutral.gray600,
  },
  emptyState: {
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyStateText: {
    color: BrandColors.neutral.gray500,
    marginTop: Spacing.base,
  },
});

