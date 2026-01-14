'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

interface VendorNotificationServiceProps {
  vendorId: string;
  enabled: boolean;
  onNewNotification?: (notification: any) => void;
}

export function useVendorNotificationService({ vendorId, enabled, onNewNotification }: VendorNotificationServiceProps) {
  const lastNotificationIdRef = useRef<string | null>(null);
  const isInitialLoadRef = useRef(true);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!enabled || !vendorId) return;

    console.log(`🔔 [VENDOR-NOTIFICATION-SERVICE] Starting notification service for vendor: ${vendorId}`);

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
        
        // Use apiClient instead of direct fetch
        const data = await apiClient.get(`/vendor/notifications/${vendorId}?limit=10`) as any;
        const notifications = data?.notifications || [];
          
          console.log(`🔔 [VENDOR-NOTIFICATION-SERVICE] Polling - Found ${notifications.length} notifications`);
          
          if (notifications.length > 0) {
            const latestNotification = notifications[0];
            
            console.log(`🔔 [VENDOR-NOTIFICATION-SERVICE] Latest: ${latestNotification.notificationId}, Last: ${lastNotificationIdRef.current}`);
            
            // Skip initial load to avoid showing old notifications
            if (isInitialLoadRef.current) {
              lastNotificationIdRef.current = latestNotification.notificationId;
              isInitialLoadRef.current = false;
              console.log(`🔔 [VENDOR-NOTIFICATION-SERVICE] Initial load complete, will track future notifications`);
              return;
            }
            
            // Check if there's a new notification
            if (latestNotification.notificationId !== lastNotificationIdRef.current && !latestNotification.read) {
              lastNotificationIdRef.current = latestNotification.notificationId;
              
              console.log(`🎉 [VENDOR-NOTIFICATION-SERVICE] NEW NOTIFICATION DETECTED!`, latestNotification);
              
              // Play notification sound
              playNotificationSound();
              
              // Show toast notification
              showToastNotification(latestNotification);
              
              // Trigger callback
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
        // Silently log error without showing it prominently (this is normal for polling)
        console.log(`⚠️ [VENDOR-NOTIFICATION-SERVICE] Polling error (will retry):`, error instanceof Error ? error.message : String(error));
        
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

    // Poll every 5 seconds for new notifications
    const interval = setInterval(checkForNewNotifications, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [vendorId, enabled, onNewNotification]);
}