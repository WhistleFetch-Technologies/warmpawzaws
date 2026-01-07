/**
 * Notification Center Screen - Mobile
 * Centralized notification management
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
import { colors, spacing, borderRadius } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

interface NotificationCenterScreenProps {
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface Notification {
  id: string;
  type: 'booking' | 'order' | 'payment' | 'promotion' | 'system';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  actionData?: any;
}

export function NotificationCenterScreen({
  phone,
  customerId,
  onBack,
  onNavigate,
}: NotificationCenterScreenProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  useEffect(() => {
    loadNotifications();
  }, [filter]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await CustomerApi.getNotifications(customerId || phone);
      const notificationsData = Array.isArray(response) ? response : response.notifications || [];
      
      let filtered = notificationsData;
      if (filter === 'unread') {
        filtered = notificationsData.filter((n: any) => !n.read);
      } else if (filter === 'read') {
        filtered = notificationsData.filter((n: any) => n.read);
      }
      
      setNotifications(filtered);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await CustomerApi.markNotificationRead(notificationId);
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      ));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      await Promise.all(unreadIds.map(id => CustomerApi.markNotificationRead(id)));
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    if (!notification.read) {
      handleMarkAsRead(notification.id);
    }

    if (notification.actionUrl && onNavigate) {
      // Parse action URL and navigate
      if (notification.actionUrl.includes('booking')) {
        const bookingId = notification.actionData?.bookingId;
        if (bookingId) {
          onNavigate('BookingDetail', { bookingId });
        }
      } else if (notification.actionUrl.includes('order')) {
        const orderId = notification.actionData?.orderId;
        if (orderId) {
          onNavigate('OrderDetail', { orderId });
        }
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'booking':
        return '📅';
      case 'order':
        return '📦';
      case 'payment':
        return '💳';
      case 'promotion':
        return '🎁';
      case 'system':
        return '🔔';
      default:
        return '📢';
    }
  };

  const renderNotificationItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notificationCard, !item.read && styles.notificationCardUnread]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.notificationIcon}>
        <Text style={styles.iconText}>{getNotificationIcon(item.type)}</Text>
      </View>
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text style={[styles.notificationTitle, !item.read && styles.notificationTitleUnread]}>
            {item.title}
          </Text>
          {!item.read && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.notificationMessage}>{item.message}</Text>
        <Text style={styles.notificationTime}>{formatDate(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading && notifications.length === 0) {
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
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      {/* Filters and Actions */}
      <View style={styles.actionsBar}>
        <View style={styles.filters}>
          {(['all', 'unread', 'read'] as const).map((filterOption) => (
            <TouchableOpacity
              key={filterOption}
              style={[
                styles.filterButton,
                filter === filterOption && styles.filterButtonActive,
              ]}
              onPress={() => setFilter(filterOption)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filter === filterOption && styles.filterButtonTextActive,
                ]}
              >
                {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.markAllReadButton}
            onPress={handleMarkAllAsRead}
          >
            <Text style={styles.markAllReadText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyTitle}>No Notifications</Text>
          <Text style={styles.emptySubtitle}>
            {filter === 'all'
              ? 'You have no notifications yet'
              : `You have no ${filter} notifications`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotificationItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
    flex: 1,
    textAlign: 'center',
  },
  unreadBadge: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.full,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  unreadBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsBar: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray.100,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
  },
  filterButtonText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: colors.white,
  },
  markAllReadButton: {
    alignSelf: 'flex-end',
  },
  markAllReadText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.md,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notificationCardUnread: {
    backgroundColor: '#f0f9ff',
    borderColor: colors.primary,
    borderWidth: 2,
  },
  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gray.100,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconText: {
    fontSize: 24,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  notificationTitleUnread: {
    fontWeight: 'bold',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: spacing.xs,
  },
  notificationMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  notificationTime: {
    fontSize: 12,
    color: colors.textSecondary,
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

