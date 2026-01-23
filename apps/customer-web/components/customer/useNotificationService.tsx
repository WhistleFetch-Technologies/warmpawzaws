'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

interface NotificationServiceProps {
  phone: string;
  enabled: boolean;
  onNewNotification?: (notification: any) => void;
}

export function useNotificationService({ phone, enabled, onNewNotification }: NotificationServiceProps) {
  const lastNotificationIdRef = useRef<string | null>(null);
  const isInitialLoadRef = useRef(true);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!enabled || !phone) return;

    console.log(`🔔 [NOTIFICATION-SERVICE] Starting notification service for customer: ${phone}`);

    // Create audio context once
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const checkForNewNotifications = async () => {
      try {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        
        // Validate phone number before making request
        if (!cleanPhone || cleanPhone.length < 10) {
          console.log(`⚠️ [NOTIFICATION-SERVICE] Invalid phone number, skipping check`);
          return;
        }
        
        const data = await apiClient.get<{ notifications?: any[] }>(
          `/customer/notifications/${cleanPhone}?limit=10`
        );
        
        const notifications = data.notifications || [];
        
        console.log(`🔔 [NOTIFICATION-SERVICE] Polling - Found ${notifications.length} notifications`);
        
        if (notifications.length > 0) {
            const latestNotification = notifications[0];
            
            console.log(`🔔 [NOTIFICATION-SERVICE] Latest: ${latestNotification.notificationId}, Last: ${lastNotificationIdRef.current}`);
            
            // Skip initial load to avoid showing old notifications
            if (isInitialLoadRef.current) {
              lastNotificationIdRef.current = latestNotification.notificationId;
              isInitialLoadRef.current = false;
              console.log(`🔔 [NOTIFICATION-SERVICE] Initial load complete, will track future notifications`);
              return;
            }
            
            // Check if there's a new notification
            if (latestNotification.notificationId !== lastNotificationIdRef.current && !latestNotification.read) {
              lastNotificationIdRef.current = latestNotification.notificationId;
              
              console.log(`🎉 [NOTIFICATION-SERVICE] NEW NOTIFICATION DETECTED!`, latestNotification);
              
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

    // Initial check
    checkForNewNotifications();

    // Poll every 5 seconds for new notifications
    const interval = setInterval(checkForNewNotifications, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [phone, enabled, onNewNotification]);
}