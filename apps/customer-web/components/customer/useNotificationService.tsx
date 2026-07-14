'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { HOME_POLL_PROFILE, isDocumentHidden, pollBackoffMs } from '@/lib/home-poll-profile';
import {
  isNativeCapacitorShell,
  shouldSuppressPollToastForPush,
} from '@/lib/notification-display-policy';
import { playNotificationAlertSound } from '@/lib/notification-sound';

interface NotificationServiceProps {
  phone: string;
  enabled: boolean;
  onNewNotification?: (notification: any) => void;
}

export function useNotificationService({ phone, enabled, onNewNotification }: NotificationServiceProps) {
  const lastNotificationIdRef = useRef<string | null>(null);
  const isInitialLoadRef = useRef(true);
  const failuresRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !phone) return;

    // Capacitor: tray push is primary; skip continuous toast poll (badge handled separately).
    if (isNativeCapacitorShell()) {
      return;
    }

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const showToastNotification = (notification: any) => {
      const title =
        typeof notification.title === 'string'
          ? notification.title
          : notification.text || notification.message || 'New Notification';

      const message =
        typeof notification.message === 'string'
          ? notification.message
          : typeof notification.text === 'string'
            ? notification.text
            : '';

      const icon = notification.type === 'chat_message' ? '💬' : '🔔';
      const iconString = typeof notification.icon === 'string' ? notification.icon : icon;

      toast(title, {
        description: message,
        icon: iconString,
        duration: 6000,
        action: {
          label: 'View',
          onClick: () => {
            if (onNewNotification) onNewNotification(notification);
          },
        },
        style: {
          background: '#FF8C42',
          color: 'white',
          border: 'none',
        },
        className: 'notification-toast',
      });
    };

    const checkForNewNotifications = async (): Promise<boolean> => {
      try {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        if (!cleanPhone || cleanPhone.length < 10) return true;

        const data = await apiClient.get<{ notifications?: any[] }>(
          `/customer/notifications?phone=${encodeURIComponent(cleanPhone)}&limit=1`
        );

        const notifications = data.notifications || [];
        failuresRef.current = 0;

        if (notifications.length > 0) {
          const latestNotification = notifications[0];
          const notificationId = latestNotification.id ?? latestNotification.notificationId;
          const isRead = latestNotification.is_read ?? latestNotification.read;

          if (isInitialLoadRef.current) {
            lastNotificationIdRef.current = notificationId ?? null;
            isInitialLoadRef.current = false;
            return true;
          }

          if (notificationId != null && notificationId !== lastNotificationIdRef.current && !isRead) {
            lastNotificationIdRef.current = notificationId;

            const suppressBanner = shouldSuppressPollToastForPush(latestNotification);
            if (!suppressBanner) {
              playNotificationAlertSound();
              showToastNotification(latestNotification);
            }

            if (onNewNotification) {
              onNewNotification(latestNotification);
            }
          }
        } else if (isInitialLoadRef.current) {
          isInitialLoadRef.current = false;
        }
        return true;
      } catch (error: any) {
        if (error?.code === 'CORS_ERROR') {
          return false;
        }
        failuresRef.current += 1;
        if (isInitialLoadRef.current) {
          isInitialLoadRef.current = false;
        }
        return true;
      }
    };

    const scheduleNext = () => {
      clearTimer();
      if (isDocumentHidden()) return;
      const delay = pollBackoffMs(HOME_POLL_PROFILE.notifToastMs, failuresRef.current);
      timerRef.current = setTimeout(() => {
        void (async () => {
          if (isDocumentHidden()) return;
          const keepGoing = await checkForNewNotifications();
          if (keepGoing) scheduleNext();
        })();
      }, delay);
    };

    const onVisibilityResume = () => {
      if (document.visibilityState === 'visible') {
        void (async () => {
          await checkForNewNotifications();
          scheduleNext();
        })();
      } else {
        clearTimer();
      }
    };

    void (async () => {
      await checkForNewNotifications();
      scheduleNext();
    })();

    document.addEventListener('visibilitychange', onVisibilityResume);

    return () => {
      clearTimer();
      document.removeEventListener('visibilitychange', onVisibilityResume);
    };
  }, [phone, enabled, onNewNotification]);
}
