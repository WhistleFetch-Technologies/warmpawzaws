'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { shouldSuppressPollToastForPush } from '@/lib/notification-display-policy';
import { playNotificationAlertSound } from '@/lib/notification-sound';

const INBOX_POLL_INTERVAL_MS = 30000;

interface NotificationServiceProps {
  phone: string;
  enabled: boolean;
  onNewNotification?: (notification: any) => void;
}

export function useNotificationService({ phone, enabled, onNewNotification }: NotificationServiceProps) {
  const lastNotificationIdRef = useRef<string | null>(null);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (!enabled || !phone) return;

    console.log(`🔔 [NOTIFICATION-SERVICE] Starting notification service for customer: ${phone}`);

    const checkForNewNotifications = async () => {
      try {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        
        // Validate phone number before making request
        if (!cleanPhone || cleanPhone.length < 10) {
          console.log(`⚠️ [NOTIFICATION-SERVICE] Invalid phone number, skipping check`);
          return;
        }
        
        const data = await apiClient.get<{ notifications?: any[] }>(
          `/customer/notifications?phone=${encodeURIComponent(cleanPhone)}&limit=10`
        );
        
        const notifications = data.notifications || [];
        
        console.log(`🔔 [NOTIFICATION-SERVICE] Polling - Found ${notifications.length} notifications`);
        
        if (notifications.length > 0) {
            const latestNotification = notifications[0];
            // API returns DB rows: id, is_read (snake_case). Support both id/notificationId and is_read/read.
            const notificationId = latestNotification.id ?? latestNotification.notificationId;
            const isRead = latestNotification.is_read ?? latestNotification.read;
            
            console.log(`🔔 [NOTIFICATION-SERVICE] Latest: ${notificationId}, Last: ${lastNotificationIdRef.current}`);
            
            // Skip initial load to avoid showing old notifications
            if (isInitialLoadRef.current) {
              lastNotificationIdRef.current = notificationId ?? null;
              isInitialLoadRef.current = false;
              console.log(`🔔 [NOTIFICATION-SERVICE] Initial load complete, will track future notifications`);
              return;
            }
            
            // Check if there's a new notification (by id and unread)
            if (notificationId != null && notificationId !== lastNotificationIdRef.current && !isRead) {
              lastNotificationIdRef.current = notificationId;

              console.log(`🎉 [NOTIFICATION-SERVICE] NEW NOTIFICATION DETECTED!`, latestNotification);

              const suppressBanner = shouldSuppressPollToastForPush(latestNotification);
              if (suppressBanner) {
                console.log(
                  '🔔 [NOTIFICATION-SERVICE] Skipping in-app toast/sound — native push handles display'
                );
              } else {
                playNotificationAlertSound();
                showToastNotification(latestNotification);
              }

              if (onNewNotification) {
                onNewNotification(latestNotification);
              }
            }
          } else {
            console.log(`🔔 [NOTIFICATION-SERVICE] No notifications found`);
            // Mark initial load as complete even if no notifications
            if (isInitialLoadRef.current) {
              isInitialLoadRef.current = false;
            }
          }
      } catch (error: any) {
        // Only log non-CORS errors to reduce console noise
        // CORS errors indicate configuration issues and shouldn't be retried
        if (error?.code !== 'CORS_ERROR') {
          // Only log in development/UAT mode
          if (typeof window !== 'undefined' && (process.env.NODE_ENV === 'development' || window.location.hostname.includes('uat'))) {
            console.log(`⚠️ [NOTIFICATION-SERVICE] Polling error (will retry):`, error instanceof Error ? error.message : String(error));
          }
        } else {
          // CORS errors are configuration issues - stop polling to avoid spam
          if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
            console.warn(`🚫 [NOTIFICATION-SERVICE] CORS error detected - notification polling disabled`);
          }
          return; // Exit early for CORS errors
        }
        
        // Mark initial load as complete even on error to prevent infinite loops
        if (isInitialLoadRef.current) {
          isInitialLoadRef.current = false;
        }
      }
    };

    const showToastNotification = (notification: any) => {
      // ✅ FIX: Ensure title is a string, not an object
      // Handle different notification structures from API
      const title = typeof notification.title === 'string' 
        ? notification.title 
        : notification.text || notification.message || 'New Notification';
      
      const message = typeof notification.message === 'string'
        ? notification.message
        : typeof notification.text === 'string'
        ? notification.text
        : '';
      
      const icon = notification.type === 'chat_message' ? '💬' : '🔔';
      
      // ✅ FIX: Ensure icon is a string, not an object
      const iconString = typeof notification.icon === 'string' 
        ? notification.icon 
        : icon;
      
      toast(title, {
        description: message,
        icon: iconString,
        duration: 6000,
        action: {
          label: 'View',
          onClick: () => {
            console.log('🔔 Toast "View" clicked', notification);
            if (onNewNotification) {
              onNewNotification(notification);
            }
          }
        },
        style: {
          background: '#FF8C42',
          color: 'white',
          border: 'none',
        },
        className: 'notification-toast',
      });
      
      console.log('🍊 [NOTIFICATION-SERVICE] Toast displayed with orange style');
    };

    // Initial check + poll every 30s (tray push is primary real-time channel on native)
    checkForNewNotifications();

    const interval = setInterval(checkForNewNotifications, INBOX_POLL_INTERVAL_MS);

    const onVisibilityResume = () => {
      if (document.visibilityState === 'visible') {
        checkForNewNotifications();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityResume);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityResume);
    };
  }, [phone, enabled, onNewNotification]);
}