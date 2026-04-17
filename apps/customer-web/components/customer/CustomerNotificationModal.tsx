'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  Bell,
  Calendar,
  Check,
  CheckCheck,
  MessageCircle,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export interface CustomerNotificationItem {
  notificationId: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  data?: Record<string, unknown>;
}

interface CustomerNotificationModalProps {
  open: boolean;
  phone: string;
  onClose: () => void;
  onNotificationClick?: (notification: CustomerNotificationItem) => void;
  onNotificationsRead?: () => void;
}

function parseNotificationData(raw: unknown): Record<string, unknown> | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown;
      if (p && typeof p === 'object' && !Array.isArray(p)) return p as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

function mapRowToItem(n: Record<string, unknown>): CustomerNotificationItem {
  const id = String(n.id ?? n.notification_id ?? n.notificationId ?? '');
  const isRead = Boolean(n.is_read ?? n.isRead ?? n.read ?? false);
  const type = String(n.notification_type ?? n.type ?? n.notificationType ?? 'system');
  const title = String(n.title ?? 'Notification');
  const message = String(n.message ?? '');
  const createdAt = String(n.created_at ?? n.createdAt ?? new Date().toISOString());
  const data = parseNotificationData(n.data ?? n.metadata ?? n.payload);
  return {
    notificationId: id,
    type,
    title,
    message,
    createdAt,
    isRead,
    data,
  };
}

export function CustomerNotificationModal({
  open,
  phone,
  onClose,
  onNotificationClick,
  onNotificationsRead,
}: CustomerNotificationModalProps) {
  const [notifications, setNotifications] = useState<CustomerNotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const fetchNotifications = useCallback(async () => {
    const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      setNotifications([]);
      return;
    }
    try {
      setLoading(true);
      const data = (await apiClient.get(
        `/customer/notifications?phone=${encodeURIComponent(cleanPhone)}&limit=50`
      )) as { notifications?: Record<string, unknown>[] };
      const rows = data.notifications ?? [];
      setNotifications(rows.map((r) => mapRowToItem(r)));
    } catch (error) {
      console.error('Failed to fetch customer notifications:', error);
      toast.error('Failed to load notifications');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    if (!open) return;
    void fetchNotifications();
  }, [open, fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      await apiClient.post('/notifications/mark-read', { notificationId });
      setNotifications((prev) =>
        prev.map((n) => (n.notificationId === notificationId ? { ...n, isRead: true } : n))
      );
      onNotificationsRead?.();
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Could not mark as read');
    }
  };

  const markAllAsRead = async () => {
    const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) return;
    try {
      await apiClient.post('/notifications/mark-all-read', { phone: cleanPhone });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success('All notifications marked as read');
      onNotificationsRead?.();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error('Could not mark all as read');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await apiClient.delete(`/notifications/${notificationId}`);
      setNotifications((prev) => prev.filter((n) => n.notificationId !== notificationId));
      toast.success('Notification removed');
      onNotificationsRead?.();
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Could not delete notification');
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-IN');
  };

  const getNotificationIcon = (type: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('chat')) return <MessageCircle className="w-5 h-5 text-[#FF8C42]" />;
    if (t.includes('booking') || t.includes('appointment'))
      return <Calendar className="w-5 h-5 text-blue-600" />;
    return <Bell className="w-5 h-5 text-blue-600" />;
  };

  const getNotificationCardClass = (type: string, isRead: boolean) => {
    if (isRead) return 'bg-white border-gray-200 opacity-90';
    const t = (type || '').toLowerCase();
    if (t.includes('booking')) return 'bg-blue-50 border-blue-200 shadow-sm';
    if (t.includes('payment') || t.includes('loyalty')) return 'bg-amber-50 border-amber-200 shadow-sm';
    return 'bg-gray-50 border-gray-200 shadow-sm';
  };

  const filteredNotifications =
    filter === 'unread' ? notifications.filter((n) => !n.isRead) : notifications;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleOpenChange = (next: boolean) => {
    if (!next) onClose();
  };

  const handleRowClick = (notification: CustomerNotificationItem) => {
    if (!notification.isRead) void markAsRead(notification.notificationId);
    onNotificationClick?.(notification);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="[&>button]:hidden !flex !max-h-[85vh] w-[calc(100vw-1.5rem)] max-w-customer flex-col !gap-0 overflow-hidden border border-gray-200 bg-white p-0 shadow-2xl sm:max-w-customer sm:rounded-2xl">
        <DialogHeader className="space-y-0 border-b border-gray-200 px-4 pb-3 pt-4 text-left">
          <DialogTitle className="sr-only">Notifications</DialogTitle>
          <DialogDescription className="sr-only">
            View and manage your booking and account notifications
          </DialogDescription>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Bell className="h-5 w-5 shrink-0 text-[#FF8C42]" strokeWidth={2} />
              <span className="truncate text-base font-semibold text-gray-900">Notifications</span>
              {unreadCount > 0 ? (
                <span className="shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
                  {unreadCount}
                </span>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {unreadCount > 0 ? (
                <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => void markAllAsRead()}>
                  <CheckCheck className="mr-1 h-3.5 w-3.5" />
                  Mark all read
                </Button>
              ) : null}
              <button
                type="button"
                onClick={() => onClose()}
                className="flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                aria-label="Close notifications"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === 'unread'
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>
        </DialogHeader>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          {loading && notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="mb-3 h-8 w-8 animate-spin rounded-full border-4 border-[#FF8C42] border-t-transparent" />
              <p className="text-sm text-gray-600">Loading notifications…</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="mb-3 h-16 w-16 text-gray-300" />
              <p className="font-medium text-gray-600">No notifications</p>
              <p className="mt-1 text-sm text-gray-500">
                {filter === 'unread' ? "You're all caught up!" : "You'll receive notifications here"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.notificationId}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleRowClick(notification);
                    }
                  }}
                  onClick={() => handleRowClick(notification)}
                  className={`relative cursor-pointer rounded-xl border p-3 transition-all ${getNotificationCardClass(
                    notification.type,
                    notification.isRead
                  )}`}
                >
                  {!notification.isRead ? (
                    <div className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r bg-[#FF8C42]" />
                  ) : null}

                  <div className="flex gap-3 pl-1">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        notification.isRead ? 'bg-gray-100' : 'bg-white'
                      } border border-gray-200`}
                    >
                      {getNotificationIcon(notification.type)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900">{notification.title}</p>
                          <p className="mt-1 break-words text-sm text-gray-700">{notification.message}</p>

                          {notification.data && Object.keys(notification.data).length > 0 ? (
                            <div className="mt-2 space-y-1 text-xs text-gray-600">
                              {typeof notification.data.serviceName === 'string' ? (
                                <div className="flex items-center gap-1">
                                  <Sparkles className="h-3 w-3 shrink-0 text-amber-500" />
                                  <span>Service: {notification.data.serviceName}</span>
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          <p className="mt-2 text-xs text-gray-500">{formatTimeAgo(notification.createdAt)}</p>
                        </div>

                        <div className="flex shrink-0 flex-col gap-1">
                          {!notification.isRead ? (
                            <button
                              type="button"
                              title="Mark as read"
                              onClick={(e) => {
                                e.stopPropagation();
                                void markAsRead(notification.notificationId);
                              }}
                              className="rounded p-1 transition-colors hover:bg-white"
                            >
                              <Check className="h-4 w-4 text-gray-600" />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            title="Delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              void deleteNotification(notification.notificationId);
                            }}
                            className="rounded p-1 transition-colors hover:bg-white"
                          >
                            <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {notifications.length > 0 ? (
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-center text-xs text-gray-500">
              Showing {filteredNotifications.length} of {notifications.length} notifications
            </p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
