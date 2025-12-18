/**
 * Notification Service - Vendor Mobile App
 * Handles push notifications for vendors
 * Supports booking requests, status updates, GPS tracking
 */

import PushNotification from 'react-native-push-notification';
import { Platform, Alert } from 'react-native';
import { API_BASE_URL, publicAnonKey } from '../config/api';

export interface NotificationData {
  type: 'booking' | 'payment' | 'gps' | 'reminder' | 'general';
  title: string;
  message: string;
  data?: any;
  bookingId?: string;
  action?: 'view_booking' | 'accept_booking' | 'start_service' | 'view_details';
}

class NotificationService {
  private isInitialized = false;
  private notificationHandlers: Map<string, (data: NotificationData) => void> = new Map();

  /**
   * Initialize push notifications
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Configure push notification channel (Android)
      if (Platform.OS === 'android') {
        PushNotification.createChannel(
          {
            channelId: 'warmpawz-vendor-default',
            channelName: 'Warmpawz Vendor Notifications',
            channelDescription: 'Notifications for bookings and business updates',
            playSound: true,
            soundName: 'default',
            importance: 4,
            vibrate: true,
          },
          (created: boolean) => {
            console.log('Vendor notification channel created:', created);
          }
        );

        PushNotification.createChannel(
          {
            channelId: 'warmpawz-vendor-booking',
            channelName: 'New Bookings',
            channelDescription: 'Notifications for new booking requests',
            playSound: true,
            soundName: 'default',
            importance: 5,
            vibrate: true,
          },
          (created: boolean) => {
            console.log('Vendor booking channel created:', created);
          }
        );
      }

      // Configure push notification
      PushNotification.configure({
        onRegister: async (token: { token: string }) => {
          console.log('📱 Vendor push notification token:', token);
          await this.registerToken(token.token);
        },
        onNotification: (notification: any) => {
          console.log('📬 Vendor notification received:', notification);
          
          if (notification.userInteraction) {
            this.handleNotificationTap(notification.data);
          } else {
            if (Platform.OS === 'ios') {
              this.showForegroundNotification(notification);
            }
          }
        },
        onAction: (notification: any) => {
          console.log('🔔 Vendor notification action:', notification);
          this.handleNotificationTap(notification.data);
        },
        onRegistrationError: (err: Error) => {
          console.error('❌ Vendor push notification registration error:', err);
        },
        permissions: {
          alert: true,
          badge: true,
          sound: true,
        },
        popInitialNotification: true,
        requestPermissions: Platform.OS === 'ios',
      });

      this.isInitialized = true;
      console.log('✅ Vendor notification service initialized');
    } catch (error) {
      console.error('❌ Error initializing vendor notifications:', error);
    }
  }

  /**
   * Register device token with backend
   */
  private async registerToken(token: string): Promise<void> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/vendor/notifications/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            token,
            platform: Platform.OS,
            appVersion: '1.0.0',
          }),
        }
      );

      if (response.ok) {
        console.log('✅ Vendor device token registered');
      }
    } catch (error) {
      console.error('❌ Error registering vendor token:', error);
    }
  }

  /**
   * Show local notification
   */
  showLocalNotification(data: NotificationData): void {
    const channelId = this.getChannelId(data.type);
    
    PushNotification.localNotification({
      channelId,
      title: data.title,
      message: data.message,
      playSound: true,
      soundName: 'default',
      vibrate: true,
      priority: 'high',
      importance: 'high',
      userInfo: {
        type: data.type,
        bookingId: data.bookingId,
        action: data.action,
        ...data.data,
      },
    });
  }

  /**
   * Show foreground notification (iOS)
   */
  private showForegroundNotification(notification: any): void {
    if (notification.data) {
      const data = notification.data as NotificationData;
      Alert.alert(
        data.title,
        data.message,
        [
          { text: 'Dismiss', style: 'cancel' },
          {
            text: 'View',
            onPress: () => this.handleNotificationTap(data),
          },
        ]
      );
    }
  }

  /**
   * Handle notification tap
   */
  private handleNotificationTap(data: any): void {
    if (!data) return;

    const notificationData = data as NotificationData;
    const handler = this.notificationHandlers.get(notificationData.type);
    
    if (handler) {
      handler(notificationData);
    } else {
      console.log('Vendor notification tapped:', notificationData);
    }
  }

  /**
   * Register notification handler
   */
  onNotification(type: string, handler: (data: NotificationData) => void): void {
    this.notificationHandlers.set(type, handler);
  }

  /**
   * Unregister notification handler
   */
  offNotification(type: string): void {
    this.notificationHandlers.delete(type);
  }

  /**
   * Get channel ID based on notification type
   */
  private getChannelId(type: string): string {
    switch (type) {
      case 'booking':
        return 'warmpawz-vendor-booking';
      default:
        return 'warmpawz-vendor-default';
    }
  }

  /**
   * Schedule notification
   */
  scheduleNotification(
    data: NotificationData,
    date: Date
  ): void {
    PushNotification.localNotificationSchedule({
      channelId: this.getChannelId(data.type),
      title: data.title,
      message: data.message,
      date,
      playSound: true,
      soundName: 'default',
      userInfo: {
        type: data.type,
        bookingId: data.bookingId,
        action: data.action,
        ...data.data,
      },
    });
  }

  /**
   * Cancel scheduled notification
   */
  cancelNotification(notificationId: string): void {
    PushNotification.cancelLocalNotifications({ id: notificationId });
  }

  /**
   * Cancel all notifications
   */
  cancelAllNotifications(): void {
    PushNotification.cancelAllLocalNotifications();
  }

  /**
   * Get badge count
   */
  async getBadgeCount(): Promise<number> {
    return new Promise((resolve) => {
      PushNotification.getApplicationIconBadgeNumber((count: number) => {
        resolve(count || 0);
      });
    });
  }

  /**
   * Set badge count
   */
  setBadgeCount(count: number): void {
    PushNotification.setApplicationIconBadgeNumber(count);
  }

  /**
   * Clear badge
   */
  clearBadge(): void {
    PushNotification.setApplicationIconBadgeNumber(0);
  }

  /**
   * Request permissions (iOS)
   */
  async requestPermissions(): Promise<boolean> {
    return new Promise((resolve) => {
      PushNotification.requestPermissions((permissions: { alert: boolean; badge: boolean; sound: boolean }) => {
        resolve(permissions.alert === true);
      });
    });
  }

  /**
   * Check if notifications are enabled
   */
  async checkPermissions(): Promise<boolean> {
    return new Promise((resolve) => {
      PushNotification.checkPermissions((permissions: { alert: boolean; badge: boolean; sound: boolean }) => {
        resolve(permissions.alert === true);
      });
    });
  }
}

export default new NotificationService();
