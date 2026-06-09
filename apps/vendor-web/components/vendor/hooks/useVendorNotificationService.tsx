'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { shouldSuppressPollToastForPush } from '@/lib/notification-display-policy';

interface VendorNotificationServiceProps {
  vendorId: string;
  enabled: boolean;
  onNewNotification?: (notification: any) => void;
}

export function useVendorNotificationService({ vendorId, enabled, onNewNotification }: VendorNotificationServiceProps) {
  const lastNotificationIdRef = useRef<string | null>(null);
  const isInitialLoadRef = useRef(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const retryCountRef = useRef(0);
  const pollIntervalRef = useRef(5000); // Start with 5 seconds

  useEffect(() => {
    if (!enabled || !vendorId) return;


    // Create audio context once
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const checkForNewNotifications = async () => {
      try {
        // Validate vendorId before making request
        if (!vendorId || vendorId.trim() === '') {
          console.log(`⚠️ [VENDOR-NOTIFICATION-SERVICE] Invalid vendorId, skipping check`);
          return;
        }
        
        // ✅ FIX: Use apiClient with timeout handling
        const data = await apiClient.get(`/vendor/notifications/${vendorId}?limit=10`) as any;
        
        // ✅ FIX: Reset retry count and poll interval on success
        retryCountRef.current = 0;
        pollIntervalRef.current = 5000;
        const notifications = data?.notifications || [];
          
          console.log(`🔔 [VENDOR-NOTIFICATION-SERVICE] Polling - Found ${notifications.length} notifications`);
          
          if (notifications.length > 0) {
            const latestNotification = notifications[0];
            // Support both 'id' (from database) and 'notificationId' (legacy) property names
            const latestId = latestNotification.id || latestNotification.notificationId;
            const isRead = latestNotification.is_read || latestNotification.read || latestNotification.isRead;
            
            console.log(`🔔 [VENDOR-NOTIFICATION-SERVICE] Latest: ${latestId}, Last: ${lastNotificationIdRef.current}`);
            
            // Skip initial load to avoid showing old notifications
            if (isInitialLoadRef.current) {
              lastNotificationIdRef.current = latestId;
              isInitialLoadRef.current = false;
              console.log(`🔔 [VENDOR-NOTIFICATION-SERVICE] Initial load complete, will track future notifications`);
              return;
            }
            
            // Check if there's a new notification
            if (latestId !== lastNotificationIdRef.current && !isRead) {
              lastNotificationIdRef.current = latestId;

              console.log(`🎉 [VENDOR-NOTIFICATION-SERVICE] NEW NOTIFICATION DETECTED!`, latestNotification);

              const suppressBanner = shouldSuppressPollToastForPush(latestNotification);
              if (suppressBanner) {
                console.log(
                  '🔔 [VENDOR-NOTIFICATION-SERVICE] Skipping in-app toast/sound — native push handles display'
                );
              } else {
                playNotificationSound();
                showToastNotification(latestNotification);
              }

              if (onNewNotification) {
                onNewNotification(latestNotification);
              }
            }
          } else {
            console.log(`🔔 [VENDOR-NOTIFICATION-SERVICE] No notifications found`);
            // Mark initial load as complete even if no notifications
            if (isInitialLoadRef.current) {
              isInitialLoadRef.current = false;
            }
          }
      } catch (error) {
        // ✅ FIX: Implement exponential backoff for 503 errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        const is503 = errorMessage.includes('503') || errorMessage.includes('Service Unavailable');
        
        if (is503) {
          retryCountRef.current += 1;
          // Exponential backoff: 5s, 10s, 20s, 30s (max)
          pollIntervalRef.current = Math.min(5000 * Math.pow(2, retryCountRef.current - 1), 30000);
          console.log(`⚠️ [VENDOR-NOTIFICATION-SERVICE] 503 error (retry ${retryCountRef.current}), backing off to ${pollIntervalRef.current}ms`);
        } else {
          // For other errors, use shorter backoff
          retryCountRef.current = Math.min(retryCountRef.current + 1, 3);
          pollIntervalRef.current = Math.min(5000 * retryCountRef.current, 15000);
        }
        
        // Silently log error without showing it prominently (this is normal for polling)
        console.log(`⚠️ [VENDOR-NOTIFICATION-SERVICE] Polling error (will retry in ${pollIntervalRef.current}ms):`, errorMessage);
        
        // Mark initial load as complete even on error to prevent infinite loops
        if (isInitialLoadRef.current) {
          isInitialLoadRef.current = false;
        }
      }
    };

    const playNotificationSound = () => {
      try {
        const audioContext = audioContextRef.current;
        if (!audioContext) return;

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // First beep
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.15);

        // Second beep
        setTimeout(() => {
          const oscillator2 = audioContext.createOscillator();
          const gainNode2 = audioContext.createGain();
          
          oscillator2.connect(gainNode2);
          gainNode2.connect(audioContext.destination);
          
          oscillator2.frequency.value = 1000;
          oscillator2.type = 'sine';
          gainNode2.gain.setValueAtTime(0.2, audioContext.currentTime);
          gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
          
          oscillator2.start(audioContext.currentTime);
          oscillator2.stop(audioContext.currentTime + 0.15);
        }, 150);
      } catch (error) {
        console.error('Error playing notification sound:', error);
      }
    };

    const showToastNotification = (notification: any) => {
      const icon = notification.type === 'chat_message' ? '💬' : '🔔';
      
      toast(notification.title, {
        description: notification.message,
        icon: icon,
        duration: 6000,
        action: {
          label: 'View',
          onClick: () => {
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
        className: 'vendor-notification-toast',
      });
    };

    // Initial check
    checkForNewNotifications();

    // ✅ FIX: Use dynamic polling interval with exponential backoff
    let intervalId: NodeJS.Timeout | null = null;
    
    const scheduleNextPoll = () => {
      if (intervalId) {
        clearTimeout(intervalId);
      }
      intervalId = setTimeout(() => {
        checkForNewNotifications().finally(() => {
          scheduleNextPoll(); // Schedule next poll after current one completes
        });
      }, pollIntervalRef.current);
    };
    
    // Start polling
    scheduleNextPoll();

    return () => {
      if (intervalId) {
        clearTimeout(intervalId);
      }
    };
  }, [vendorId, enabled, onNewNotification]);
}