import React, { useState } from 'react';
import { NotificationBell, NotificationCenter, Notification } from './NotificationCenter';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';

interface NotificationBellWrapperProps {
  notifications?: Notification[];
  unreadCount?: number;
  fetchNotifications?: () => Promise<Notification[]>;
  onNotificationClick?: (notification: Notification) => void;
  onMarkAsRead?: (notificationId: string) => void;
  onMarkAllAsRead?: () => void;
  onDelete?: (notificationId: string) => void;
  className?: string;
  iconClassName?: string;
}

/**
 * NotificationBellWrapper Component
 * 
 * Wrapper component that provides NotificationBell with a drawer/modal
 * for easy integration into navigation headers.
 * 
 * Usage:
 * ```tsx
 * <NotificationBellWrapper
 *   notifications={notifications}
 *   onNotificationClick={(notification) => navigate(notification.actionUrl)}
 * />
 * ```
 */
export function NotificationBellWrapper({
  notifications,
  unreadCount,
  fetchNotifications,
  onNotificationClick,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  className,
  iconClassName,
}: NotificationBellWrapperProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Calculate unread count if not provided
  const calculatedUnreadCount = unreadCount ?? 
    (notifications ? notifications.filter(n => !n.read).length : 0);

  return (
    <>
      <NotificationBell
        unreadCount={calculatedUnreadCount}
        onClick={() => setIsOpen(true)}
        className={className}
        iconClassName={iconClassName}
      />
      
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Notifications</SheetTitle>
            <SheetDescription>
              Stay updated with your latest notifications
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <NotificationCenter
              notifications={notifications}
              fetchNotifications={fetchNotifications}
              onNotificationClick={(notification) => {
                onNotificationClick?.(notification);
                setIsOpen(false);
              }}
              onMarkAsRead={onMarkAsRead}
              onMarkAllAsRead={onMarkAllAsRead}
              onDelete={onDelete}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

