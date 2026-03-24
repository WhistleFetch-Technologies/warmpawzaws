'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'booking' | 'payment' | 'order' | 'promotion' | 'system';
  is_read: boolean;
  created_at: string;
  data?: Record<string, any>;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const phone = localStorage.getItem('customerPhone');
    if (!phone) {
      router.push('/auth');
      return;
    }
    loadNotifications();
  }, [router]);

  const loadNotifications = async () => {
    try {
      const customerId = getResolvedCustomerId();
      const phone = localStorage.getItem('customerPhone');
      if (customerId) {
        // Backend: GET /notifications?userId=&userType=customer (or GET /customer/notifications?phone=)
        const response = await apiClient.get<{ notifications: Notification[] }>(
          `/notifications?userId=${encodeURIComponent(customerId)}&userType=customer`
        ).catch(async () => {
          if (phone) {
            return apiClient.get<{ notifications: Notification[] }>(`/customer/notifications?phone=${encodeURIComponent(phone)}`);
          }
          return { notifications: [] };
        });
        setNotifications(response.notifications || (response as any).notifications || []);
      } else if (phone) {
        const response = await apiClient.get<{ notifications: Notification[] }>(`/customer/notifications?phone=${encodeURIComponent(phone)}`);
        setNotifications(response.notifications || []);
      }
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await apiClient.put(`/notifications/${notificationId}/read`, {});
      setNotifications(
        notifications.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    
    // Navigate based on notification type
    if (notification.type === 'booking' && notification.data?.bookingId) {
      router.push(`/bookings?id=${notification.data.bookingId}`);
    } else if (notification.type === 'order' && notification.data?.orderId) {
      router.push(`/orders?id=${notification.data.orderId}`);
    } else if (notification.type === 'payment') {
      router.push('/wallet');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'booking': return '📅';
      case 'payment': return '💳';
      case 'order': return '📦';
      case 'promotion': return '🎉';
      default: return '🔔';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header - Match consistency pattern: max-w-7xl mx-auto px-6 py-4 */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-orange-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              {/* ✅ FIX: Match consistency - text-2xl font-bold */}
              <h1 className="text-2xl font-bold text-gray-800">Notifications</h1>
              <p className="text-sm text-gray-500 mt-1">Stay updated with your bookings and orders</p>
            </div>
            {unreadCount > 0 && (
              <span className="px-3 py-1 bg-orange-500 text-white rounded-full text-sm font-medium">
                {unreadCount} new
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Match consistency pattern: max-w-7xl mx-auto p-6 or p-8 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">

        {notifications.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <div className="text-6xl mb-4">🔔</div>
            <p className="text-gray-500">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition ${
                  !notification.is_read ? 'border-l-4 border-orange-500' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className={`font-medium ${!notification.is_read ? 'text-gray-800' : 'text-gray-600'}`}>
                        {notification.title}
                      </h3>
                      <span className="text-xs text-gray-400">
                        {formatTime(notification.created_at)}
                      </span>
                    </div>
                    <p className="text-gray-500 text-sm mt-1">{notification.message}</p>
                  </div>
                  {!notification.is_read && (
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

