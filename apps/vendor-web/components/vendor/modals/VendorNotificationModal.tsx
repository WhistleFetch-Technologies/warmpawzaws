'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { X, Check, CheckCheck, Trash2, Bell, Sparkles, MessageSquare, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// Note: Using apiClient for API calls
import { toast } from 'sonner';

interface NotificationItem {
  notificationId: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  data?: any;
}

interface VendorNotificationModalProps {
  vendorId: string;
  open: boolean;
  onClose: () => void;
  onNotificationsRead?: () => void;
}

export function VendorNotificationModal({ vendorId, open, onClose, onNotificationsRead }: VendorNotificationModalProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, vendorId]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get(`/vendor/notifications/${vendorId}?limit=50`) as any;

      if (data && data.success) {
        // Map database fields to component expected format
        const mappedNotifications = (data.notifications || []).map((n: any) => ({
          notificationId: n.id || n.notificationId,
          type: n.notification_type || n.type,
          title: n.title,
          message: n.message,
          createdAt: n.created_at || n.createdAt,
          isRead: n.is_read || n.isRead || n.read || false,
          data: n.data || n.metadata,
        }));
        console.log('📬 Notifications loaded:', mappedNotifications.length);
        setNotifications(mappedNotifications);
      } else {
        console.error('Failed to fetch notifications:', data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {

      await apiClient.put(`/notifications/${notificationId}/read`, {});

      setNotifications(prev =>
        prev.map(n =>
          n.notificationId === notificationId
            ? { ...n, isRead: true }
            : n
        )
      );

      onNotificationsRead?.();
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to mark notification as read');
    }
  };

  const markAllAsRead = async () => {
    try {

      // Call the backend endpoint to mark all notifications as read
      await apiClient.put('/notifications/read-all', {
        userId: vendorId,
        userType: 'vendor'
      });

      // Update local state after successful API call
      setNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true }))
      );

      toast.success('All notifications marked as read');
      onNotificationsRead?.();
    } catch (error) {
      console.error(' Error marking all notifications as read:', error);
      toast.error('Failed to mark all notifications as read');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {

      // Call the backend endpoint to delete notification
      await apiClient.delete(`/notifications/${notificationId}`);

      // Update local state after successful API call
      setNotifications(prev =>
        prev.filter(n => n.notificationId !== notificationId)
      );

      toast.success('Notification deleted');
      onNotificationsRead?.();
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
      // Don't update local state if API call failed
    }
  };
  const formatTimeAgo = (dateString: string) => {
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
    return date.toLocaleDateString();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'service_approved':
      case 'services_approved':
        return <Check className="w-5 h-5 text-green-600" />;
      case 'service_rejected':
      case 'services_rejected':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'service_clarification':
      case 'services_clarification':
        return <MessageSquare className="w-5 h-5 text-orange-600" />;
      default:
        return <Bell className="w-5 h-5 text-blue-600" />;
    }
  };

  const getNotificationBgColor = (type: string) => {
    switch (type) {
      case 'service_approved':
      case 'services_approved':
        return 'bg-green-50 border-green-200';
      case 'service_rejected':
      case 'services_rejected':
        return 'bg-red-50 border-red-200';
      case 'service_clarification':
      case 'services_clarification':
        return 'bg-orange-50 border-orange-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const filteredNotifications = filter === 'unread'
    ? notifications.filter(n => !n.isRead)
    : notifications;

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="vendor-modal-sheet max-h-[85vh] overflow-hidden flex flex-col p-0 bg-white border-2 border-[#FF8C42]/20 shadow-2xl sm:mx-4">
        {/* Header */}
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-gray-200">
          <DialogTitle className="sr-only">Notifications</DialogTitle>
          <DialogDescription className="sr-only">
            View and manage your vendor notifications
          </DialogDescription>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#FF8C42]" />
              <DialogTitle>Notifications</DialogTitle>
              {unreadCount > 0 && (
                <Badge className="bg-red-500 text-white">
                  {unreadCount}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={markAllAsRead}
                  className="text-xs"
                >
                  <CheckCheck className="w-4 h-4 mr-1" />
                  Mark all read
                </Button>
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-1.5 rounded-full text-sm transition-colors ${filter === 'all'
                ? 'bg-[#FF8C42] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-4 py-1.5 rounded-full text-sm transition-colors ${filter === 'unread'
                ? 'bg-[#FF8C42] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              Unread ({unreadCount})
            </button>
          </div>
        </DialogHeader>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-sm text-gray-600">Loading notifications...</p>
              </div>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="w-16 h-16 text-gray-300 mb-3" />
              <p className="text-gray-600 font-medium">No notifications</p>
              <p className="text-sm text-gray-500 mt-1">
                {filter === 'unread'
                  ? "You're all caught up!"
                  : "You'll receive notifications here"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.notificationId}
                  className={`relative rounded-lg border p-3 transition-all ${notification.isRead
                    ? 'bg-white border-gray-200 opacity-75'
                    : `${getNotificationBgColor(notification.type)} shadow-sm`
                    }`}
                  onClick={() => !notification.isRead && markAsRead(notification.notificationId)}
                >
                  {/* Unread indicator */}
                  {!notification.isRead && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#FF8C42] rounded-r" />
                  )}

                  <div className="flex gap-3">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full ${notification.isRead ? 'bg-gray-100' : 'bg-white'
                      } flex items-center justify-center`}>
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 text-sm">
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-700 mt-1 break-words">
                            {notification.message}
                          </p>

                          {/* Service Details */}
                          {notification.data && (
                            <div className="mt-2 text-xs text-gray-600 space-y-1">
                              {notification.data.serviceName && (
                                <div className="flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" />
                                  <span>Service: {notification.data.serviceName}</span>
                                </div>
                              )}
                              {notification.data.serviceCount && (
                                <div>
                                  {notification.data.serviceCount} services
                                </div>
                              )}
                              {notification.data.adminNote && (
                                <div className="bg-white/50 rounded p-2 mt-1 italic">
                                  "{notification.data.adminNote}"
                                </div>
                              )}
                              {notification.data.rejectionReason && (
                                <div className="bg-white/50 rounded p-2 mt-1 text-red-700">
                                  <strong>Reason:</strong> {notification.data.rejectionReason}
                                </div>
                              )}
                              {notification.data.clarificationMessage && (
                                <div className="bg-white/50 rounded p-2 mt-1 text-orange-700">
                                  <strong>Message:</strong> {notification.data.clarificationMessage}
                                </div>
                              )}
                            </div>
                          )}

                          <p className="text-xs text-gray-500 mt-2">
                            {formatTimeAgo(notification.createdAt)}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-1">
                          {!notification.isRead && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.notificationId);
                              }}
                              className="p-1 hover:bg-white rounded transition-colors"
                              title="Mark as read"
                            >
                              <Check className="w-4 h-4 text-gray-600" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.notificationId);
                            }}
                            className="p-1 hover:bg-white rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-600" />
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

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-center text-gray-500">
              Showing {filteredNotifications.length} of {notifications.length} notifications
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}