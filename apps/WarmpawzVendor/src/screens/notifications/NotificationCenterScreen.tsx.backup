/**
 * Notification Center Screen
 * Notification management and history
 * Batch 2 - Screen 3
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { NotificationApi } from '../../services/api';

interface NotificationCenterScreenProps {
  vendorId: string;
  onBack?: () => void;
  onNotificationTap?: (notification: any) => void;
}

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  data?: any;
  timestamp: string;
  isRead: boolean;
}

export function NotificationCenterScreen({
  vendorId,
  onBack,
  onNotificationTap,
}: NotificationCenterScreenProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  useEffect(() => {
    loadNotifications();
  }, [vendorId, filter]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await NotificationApi.getNotifications(vendorId);
      let notifications = response.notifications || [];
      
      // Apply client-side filter
      if (filter === 'unread') {
        notifications = notifications.filter((n: Notification) => !n.isRead);
      } else if (filter === 'read') {
        notifications = notifications.filter((n: Notification) => n.isRead);
      }
      
      setNotifications(notifications);
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

  const markAsRead = async (notificationId: string) => {
    try {
      await NotificationApi.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await NotificationApi.markAllAsRead(vendorId);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleNotificationTap = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    if (onNotificationTap) {
      onNotificationTap(notification);
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notificationCard, !item.isRead && styles.unreadNotification]}
      onPress={() => handleNotificationTap(item)}
    >
      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <Text style={styles.notificationBody}>{item.body}</Text>
        <Text style={styles.notificationTime}>
          {new Date(item.timestamp).toLocaleString()}
        </Text>
      </View>
      {!item.isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.unreadBadge}>{unreadCount} unread</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead}>
            <Text style={styles.markAllReadText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filters}>
        {(['all', 'unread', 'read'] as const).map((f) => (
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
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No notifications</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: spacing.md,
  },
  backButtonText: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSizes['2xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
  },
  unreadBadge: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    marginTop: spacing.xs / 2,
  },
  markAllReadText: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
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
    backgroundColor: '#FFF4E6',
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
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  unreadNotification: {
    borderColor: colors.primary,
    backgroundColor: '#FFF4E6',
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  notificationBody: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs / 2,
  },
  notificationTime: {
    fontSize: typography.fontSizes.xs,
    color: colors.textMuted,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: spacing.sm,
    alignSelf: 'center',
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

