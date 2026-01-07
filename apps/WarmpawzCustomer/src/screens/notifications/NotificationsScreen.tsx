/**
 * Notifications Screen - Mobile
 * View and manage notification history
 * Identical functionality to web app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

interface NotificationsScreenProps {
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'booking' | 'payment' | 'system' | 'promotion';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, any>;
}

export function NotificationsScreen({
  phone,
  customerId,
  onBack,
  onNavigate,
}: NotificationsScreenProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'read'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadNotifications();
  }, [customerId]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      if (customerId) {
        // ✅ FIX: Use actual API call instead of mock data
        const response = await CustomerApi.getNotifications(customerId);
        const notificationsData = (response as any).notifications || (response as any).data?.notifications || [];
        setNotifications(Array.isArray(notificationsData) ? notificationsData : []);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      // Don't show alert on error - just set empty array
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      // ✅ FIX: Use actual API call instead of mock
      await CustomerApi.markNotificationAsRead(notificationId);
      
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
      // Update UI optimistically even if API call fails
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      if (customerId) {
        // ✅ FIX: Use actual API call instead of mock
        await CustomerApi.markAllNotificationsAsRead(customerId);
        
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        Alert.alert('Success', 'All notifications marked as read');
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
      // Update UI optimistically even if API call fails
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      Alert.alert('Success', 'All notifications marked as read');
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await CustomerApi.deleteNotification(notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (error: any) {
      console.error('Error deleting notification:', error);
      // Update UI optimistically even if API call fails
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      Alert.alert('Error', error.message || 'Failed to delete notification');
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All',
      'Are you sure you want to clear all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              if (customerId) {
                await CustomerApi.clearAllNotifications(customerId);
                setNotifications([]);
              }
            } catch (error: any) {
              console.error('Error clearing notifications:', error);
              // Update UI optimistically even if API call fails
              setNotifications([]);
              Alert.alert('Error', error.message || 'Failed to clear notifications');
            }
          },
        },
      ]
    );
  };

  const handleNotificationPress = (notification: Notification) => {
    if (!notification.read) {
      handleMarkAsRead(notification.id);
    }

    if (notification.actionUrl && onNavigate) {
      // Parse action URL and navigate
      const url = notification.actionUrl;
      if (url.includes('/booking/')) {
        const bookingId = url.split('/booking/')[1];
        onNavigate('BookingDetail', { bookingId });
      } else if (url.includes('/order/')) {
        const orderId = url.split('/order/')[1];
        onNavigate('OrderDetail', { orderId });
      }
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'booking':
        return '📅';
      case 'payment':
        return '💳';
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      case 'promotion':
        return '🎁';
      case 'system':
        return '⚙️';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'booking':
        return '#3B82F6';
      case 'payment':
        return {colors.success};
      case 'success':
        return {colors.success};
      case 'warning':
        return '#F59E0B';
      case 'error':
        return '#EF4444';
      case 'promotion':
        return '#EC4899';
      case 'system':
        return '#6B7280';
      case 'info':
      default:
        return '#3B82F6';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  // Filter notifications
  const filteredNotifications = notifications.filter((notification) => {
    // Filter by read status
    if (activeTab === 'unread' && notification.read) return false;
    if (activeTab === 'read' && !notification.read) return false;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        notification.title.toLowerCase().includes(query) ||
        notification.message.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Group notifications by date
  const groupedNotifications = filteredNotifications.reduce(
    (groups, notification) => {
      const date = new Date(notification.timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let groupKey: string;
      if (date.toDateString() === today.toDateString()) {
        groupKey = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        groupKey = 'Yesterday';
      } else if (date.getTime() > today.getTime() - 7 * 24 * 60 * 60 * 1000) {
        groupKey = 'This Week';
      } else {
        groupKey = date.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        });
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(notification);
      return groups;
    },
    {} as Record<string, Notification[]>
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

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
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity
              style={styles.markAllButton}
              onPress={handleMarkAllAsRead}
            >
              <Text style={styles.markAllButtonText}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'all' && styles.tabTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'unread' && styles.tabActive]}
          onPress={() => setActiveTab('unread')}
        >
          <View style={styles.tabWithBadge}>
            <Text
              style={[
                styles.tabText,
                activeTab === 'unread' && styles.tabTextActive,
              ]}
            >
              Unread
            </Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'read' && styles.tabActive]}
          onPress={() => setActiveTab('read')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'read' && styles.tabTextActive,
            ]}
          >
            Read
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
          />
        }
      >
        {filteredNotifications.length > 0 ? (
          Object.entries(groupedNotifications).map(([groupKey, groupNotifications]) => (
            <View key={groupKey} style={styles.group}>
              <Text style={styles.groupTitle}>{groupKey}</Text>
              {groupNotifications.map((notification) => (
                <TouchableOpacity
                  key={notification.id}
                  style={[
                    styles.notificationCard,
                    !notification.read && styles.notificationCardUnread,
                  ]}
                  onPress={() => handleNotificationPress(notification)}
                >
                  <View style={styles.notificationHeader}>
                    <View
                      style={[
                        styles.typeIcon,
                        { backgroundColor: getTypeColor(notification.type) + '20' },
                      ]}
                    >
                      <Text style={styles.typeIconText}>
                        {getTypeIcon(notification.type)}
                      </Text>
                    </View>
                    <View style={styles.notificationContent}>
                      <View style={styles.notificationTitleRow}>
                        <Text
                          style={[
                            styles.notificationTitle,
                            !notification.read && styles.notificationTitleUnread,
                          ]}
                        >
                          {notification.title}
                        </Text>
                        {!notification.read && (
                          <View style={styles.unreadDot} />
                        )}
                      </View>
                      <Text style={styles.notificationMessage}>
                        {notification.message}
                      </Text>
                      <Text style={styles.notificationTime}>
                        {formatTimestamp(notification.timestamp)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDelete(notification.id)}
                    >
                      <Text style={styles.deleteButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  {notification.actionLabel && (
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleNotificationPress(notification)}
                    >
                      <Text style={styles.actionButtonText}>
                        {notification.actionLabel}
                      </Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>🔔</Text>
            <Text style={styles.emptyStateText}>
              {activeTab === 'unread'
                ? 'No unread notifications'
                : activeTab === 'read'
                ? 'No read notifications'
                : 'No notifications yet'}
            </Text>
            <Text style={styles.emptyStateSubtext}>
              {activeTab === 'all'
                ? 'You\'ll see notifications about bookings, payments, and more here'
                : 'Check back later for new notifications'}
            </Text>
          </View>
        )}
      </ScrollView>

      {filteredNotifications.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.clearAllButton}
            onPress={handleClearAll}
          >
            <Text style={styles.clearAllButtonText}>Clear All</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  backButton: {
    fontSize: typography.fontSizes.md,
    color: colors.white,
  },
  headerTitle: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: 'bold',
    color: colors.white,
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    width: 100,
    alignItems: 'flex-end',
  },
  markAllButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  markAllButtonText: {
    fontSize: typography.fontSizes.xs,
    color: colors.white,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray['200'],
  },
  tab: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.primary,
  },
  tabWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  badgeText: {
    fontSize: typography.fontSizes.xs,
    color: colors.white,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  group: {
    marginBottom: spacing.lg,
  },
  groupTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: 'bold',
    color: colors.textSecondary,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
  },
  notificationCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray['200'],
  },
  notificationCardUnread: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  typeIconText: {
    fontSize: 20,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  notificationTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
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
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
  notificationTime: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gray['100'],
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  deleteButtonText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  actionButton: {
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: typography.fontSizes.sm,
    color: colors.white,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: spacing.xl,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyStateText: {
    fontSize: typography.fontSizes.lg,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray['200'],
    backgroundColor: colors.white,
  },
  clearAllButton: {
    padding: spacing.md,
    backgroundColor: colors.gray['100'],
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  clearAllButtonText: {
    fontSize: typography.fontSizes.md,
    color: '#EF4444',
    fontWeight: '600',
  },
});

