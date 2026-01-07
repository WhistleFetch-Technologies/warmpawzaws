'use client';

import { useEffect, useRef } from 'react';
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

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const checkForNewNotifications = async () => {
      try {
        if (!vendorId || vendorId.trim() === '') {
          console.log(`⚠️ [VENDOR-NOTIFICATION-SERVICE] Invalid vendorId, skipping check`);
          return;
        }
        
        const data = await apiClient.get<any>(`/vendor/notifications/${vendorId}?limit=10`);
        const notifications = data.notifications || [];
        
        console.log(`🔔 [VENDOR-NOTIFICATION-SERVICE] Polling - Found ${notifications.length} notifications`);
        
        if (notifications.length > 0) {
          const latestNotification = notifications[0];
          
          console.log(`🔔 [VENDOR-NOTIFICATION-SERVICE] Latest: ${latestNotification.notificationId}, Last: ${lastNotificationIdRef.current}`);
          
          if (isInitialLoadRef.current) {
            lastNotificationIdRef.current = latestNotification.notificationId;
            isInitialLoadRef.current = false;
            console.log(`🔔 [VENDOR-NOTIFICATION-SERVICE] Initial load complete, will track future notifications`);
            return;
          }
          
          if (latestNotification.notificationId !== lastNotificationIdRef.current && !latestNotification.read) {
            lastNotificationIdRef.current = latestNotification.notificationId;
            
            console.log(`🎉 [VENDOR-NOTIFICATION-SERVICE] NEW NOTIFICATION DETECTED!`, latestNotification);
            
            playNotificationSound();
            showToastNotification(latestNotification);
            
            if (onNewNotification) {
              onNewNotification(latestNotification);
            }
          }
        } else {
          console.log(`🔔 [VENDOR-NOTIFICATION-SERVICE] No notifications found`);
          if (isInitialLoadRef.current) {
            isInitialLoadRef.current = false;
          }
        }
      } catch (error) {
        console.log(`⚠️ [VENDOR-NOTIFICATION-SERVICE] Polling error (will retry):`, error instanceof Error ? error.message : String(error));
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
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.15);

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
      alert(`${icon} ${notification.title}\n${notification.message}`);
    };

    checkForNewNotifications();
    const interval = setInterval(checkForNewNotifications, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [vendorId, enabled, onNewNotification]);
}

