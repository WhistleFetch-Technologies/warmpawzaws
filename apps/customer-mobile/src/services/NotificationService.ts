/**
 * Notification Service - Customer Mobile App
 * Handles push notifications and in-app notifications
 * Supports booking events, GPS updates, payment confirmations
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
  action?: 'view_booking' | 'track_service' | 'make_payment' | 'view_details';
}

class NotificationService {
  private isInitialized = false;
  private notificationHandlers: Map<string, (data: NotificationData) => void> = new Map();
  private deviceToken: string | null = null;
  private deviceToken: string | null = null;

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
            channelId: 'warmpawz-default',
            channelName: 'Warmpawz Notifications',
            channelDescription: 'Notifications for bookings, payments, and service updates',
            playSound: true,
            soundName: 'default',
            importance: 4, // High importance
            vibrate: true,
          },
          (created: boolean) => {
            console.log('Notification channel created:', created);
          }
        );

        PushNotification.createChannel(
          {
            channelId: 'warmpawz-booking',
            channelName: 'Booking Updates',
            channelDescription: 'Notifications for booking confirmations and status changes',
            playSound: true,
            soundName: 'default',
            importance: 5, // Max importance
            vibrate: true,
          },
          (created: boolean) => {
            console.log('Booking channel created:', created);
          }
        );

        PushNotification.createChannel(
          {
            channelId: 'warmpawz-gps',
            channelName: 'GPS Tracking',
            channelDescription: 'Real-time location updates for home services',
            playSound: false,
            importance: 3,
            vibrate: false,
          },
          (created: boolean) => {
            console.log('GPS channel created:', created);
          }
        );
      }

      // Configure push notification
      PushNotification.configure({
        onRegister: async (token: { token: string }) => {
          console.log('📱 Push notification token:', token);
          await this.registerToken(token.token);
        },
        onNotification: (notification: any) => {
          console.log('📬 Notification received:', notification);
          
          if (notification.userInteraction) {
            // User tapped the notification
            this.handleNotificationTap(notification.data);
          } else {
            // Notification received in foreground
            if (Platform.OS === 'ios') {
              // iOS requires manual handling
              this.showForegroundNotification(notification);
            }
          }
        },
        onAction: (notification: any) => {
          console.log('🔔 Notification action:', notification);
          this.handleNotificationTap(notification.data);
        },
        onRegistrationError: (err: Error) => {
          console.error('❌ Push notification registration error:', err);
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
      console.log('✅ Notification service initialized');
    } catch (error) {
      console.error('❌ Error initializing notifications:', error);
    }
  }

  /**
   * Register device token with backend
   */
  private async registerToken(token: string): Promise<void> {
    try {
      // Get user phone from auth context or storage
      // This should be called after user login
      const response = await fetch(
        `${API_BASE_URL}/customer/notifications/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            token,
            platform: Platform.OS,
            appVersion: '1.0.0', // TODO: Get from app config
          }),
        }
      );

      if (response.ok) {
        console.log('✅ Device token registered');
      }
    } catch (error) {
      console.error('❌ Error registering token:', error);
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
      playSound: data.type !== 'gps',
      soundName: 'default',
      vibrate: data.type !== 'gps',
      priority: data.type === 'booking' ? 'high' : 'default',
      importance: data.type === 'booking' ? 'high' : 'default',
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
      // Default handler
      console.log('Notification tapped:', notificationData);
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
        return 'warmpawz-booking';
      case 'gps':
        return 'warmpawz-gps';
      default:
        return 'warmpawz-default';
    }
  }

  /**
   * Schedule notification (for reminders)
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
