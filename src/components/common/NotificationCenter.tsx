import React, { useState, useEffect } from 'react';
import { Bell, Check, X, Filter, Search, Clock, AlertCircle, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '../ui/utils';
import { formatDistanceToNow } from 'date-fns';

/**
 * Notification Types
 */
export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'booking' | 'payment' | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, any>;
}

interface NotificationCenterProps {
  notifications?: Notification[];
  onNotificationClick?: (notification: Notification) => void;
  onMarkAsRead?: (notificationId: string) => void;
  onMarkAllAsRead?: () => void;
  onDelete?: (notificationId: string) => void;
  onClearAll?: () => void;
  fetchNotifications?: () => Promise<Notification[]>;
  className?: string;
  maxHeight?: string;
}

/**
 * NotificationCenter Component
 * 
 * Centralized notification management component.
 * Displays all notifications in a organized, filterable interface.
 * 
 * Features:
 * - Filter by type (All, Unread, Read)
 * - Search notifications
 * - Mark as read/unread
 * - Delete notifications
 * - Group by date
 * - Action buttons for notifications
 * 
 * Usage:
 * ```tsx
 * <NotificationCenter
 *   notifications={notifications}
 *   onNotificationClick={(notification) => navigate(notification.actionUrl)}
 *   onMarkAsRead={(id) => markAsRead(id)}
 * />
 * ```
 */
export function NotificationCenter({
  notifications: externalNotifications,
  onNotificationClick,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onClearAll,
  fetchNotifications,
  className,
  maxHeight = '600px',
}: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>(externalNotifications || []);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'read'>('all');

  // Fetch notifications if fetchNotifications is provided
  useEffect(() => {
    if (fetchNotifications && !externalNotifications) {
      loadNotifications();
    }
  }, [fetchNotifications]);

  // Update notifications when external notifications change
  useEffect(() => {
    if (externalNotifications) {
      setNotifications(externalNotifications);
    }
  }, [externalNotifications]);

  const loadNotifications = async () => {
    if (!fetchNotifications) return;
    
    setLoading(true);
    try {
      const fetched = await fetchNotifications();
      setNotifications(fetched);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter notifications
  const filteredNotifications = notifications.filter(notification => {
    // Filter by read status
    if (filter === 'unread' && notification.read) return false;
    if (filter === 'read' && !notification.read) return false;

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
  const groupedNotifications = filteredNotifications.reduce((groups, notification) => {
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
      groupKey = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(notification);
    return groups;
  }, {} as Record<string, Notification[]>);

  const handleMarkAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    onMarkAsRead?.(notificationId);
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    onMarkAllAsRead?.();
  };

  const handleDelete = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    onDelete?.(notificationId);
  };

  const handleClearAll = () => {
    setNotifications([]);
    onClearAll?.();
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      handleMarkAsRead(notification.id);
    }
    onNotificationClick?.(notification);
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'booking':
        return <Clock className="h-5 w-5 text-blue-500" />;
      case 'payment':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getNotificationBadgeColor = (type: NotificationType) => {
    switch (type) {
      case 'success':
      case 'payment':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'booking':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="h-6 w-6 text-[#FF8C42]" />
            <div>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
              </CardDescription>
            </div>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
            >
              Mark all as read
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => {
          setActiveTab(v as 'all' | 'unread' | 'read');
          setFilter(v as 'all' | 'unread' | 'read');
        }}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">
              All
              {notifications.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {notifications.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="unread">
              Unread
              {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-2 bg-[#FF8C42] text-white">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="read">
              Read
              {(notifications.length - unreadCount) > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {notifications.length - unreadCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42]"></div>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bell className="h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-600 font-medium">
                  {searchQuery ? 'No notifications match your search' : 'No notifications'}
                </p>
                {searchQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchQuery('')}
                    className="mt-4"
                  >
                    Clear search
                  </Button>
                )}
              </div>
            ) : (
              <ScrollArea style={{ maxHeight }}>
                <div className="space-y-6">
                  {Object.entries(groupedNotifications).map(([groupKey, groupNotifications]) => (
                    <div key={groupKey}>
                      <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">
                        {groupKey}
                      </h3>
                      <div className="space-y-2">
                        {groupNotifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={cn(
                              "p-4 rounded-lg border transition-all cursor-pointer hover:bg-gray-50",
                              !notification.read && "bg-blue-50 border-blue-200"
                            )}
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 mt-0.5">
                                {getNotificationIcon(notification.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h4 className={cn(
                                        "font-semibold text-sm",
                                        !notification.read && "text-gray-900"
                                      )}>
                                        {notification.title}
                                      </h4>
                                      <Badge
                                        variant="outline"
                                        className={cn("text-xs", getNotificationBadgeColor(notification.type))}
                                      >
                                        {notification.type}
                                      </Badge>
                                    </div>
                                    <p className={cn(
                                      "text-sm text-gray-600 mb-2",
                                      !notification.read && "text-gray-700"
                                    )}>
                                      {notification.message}
                                    </p>
                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                                      </span>
                                    </div>
                                    {notification.actionUrl && notification.actionLabel && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-2"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleNotificationClick(notification);
                                        }}
                                      >
                                        {notification.actionLabel}
                                      </Button>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {!notification.read && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleMarkAsRead(notification.id);
                                        }}
                                        className="h-8 w-8 p-0"
                                      >
                                        <Check className="h-4 w-4" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(notification.id);
                                      }}
                                      className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

        {/* Clear All Button */}
        {filteredNotifications.length > 0 && (
          <div className="flex justify-end pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              Clear all notifications
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Notification Bell Icon with Badge
 * Shows unread count and opens notification center
 */
export function NotificationBell({
  unreadCount,
  onClick,
  className,
  iconClassName,
}: {
  unreadCount: number;
  onClick: () => void;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative p-2 rounded-lg hover:bg-gray-100 transition-colors",
        className
      )}
    >
      <Bell className={cn("h-5 w-5 text-gray-700", iconClassName)} />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-semibold">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}

