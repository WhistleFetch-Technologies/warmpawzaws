/**
 * Push Notifications Utility
 * Handles push notification registration and management
 * Uses expo-notifications package
 */

import { Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { CustomerApi } from '../services/api';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface NotificationToken {
  token: string;
  deviceId: string;
}

/**
 * Register device for push notifications
 * Returns notification token for backend registration
 */
export async function registerForPushNotifications(): Promise<NotificationToken | null> {
  try {
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return null;
    }

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      Alert.alert('Permission Required', 'Please grant notification permission in settings');
      return null;
    }

    // Get Expo push token
    // Note: EXPO_PROJECT_ID should be set in environment variables or app.json
    // For Expo projects, this is typically in app.json under "expo.extra.eas.projectId"
    // For bare React Native, use process.env.EXPO_PROJECT_ID
    // Configuration options:
    // 1. Environment variable: EXPO_PROJECT_ID=your-project-id
    // 2. app.json: { "expo": { "extra": { "eas": { "projectId": "your-project-id" } } } }
    const projectId = process.env.EXPO_PROJECT_ID || 'your-project-id'; // Replace with actual project ID
    
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    });

    const deviceId = Device.modelId || Device.modelName || 'unknown';

    return {
      token: tokenData.data,
      deviceId: deviceId,
    };
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    Alert.alert('Error', 'Failed to register for notifications');
    return null;
  }
}

/**
 * Register push token with backend
 */
export async function registerPushTokenWithBackend(
  customerId: string,
  token: string,
  deviceType: 'ios' | 'android'
): Promise<boolean> {
  try {
    await CustomerApi.registerPushToken(customerId, token, deviceType);
    console.log('✅ Push token registered with backend');
    return true;
  } catch (error) {
    console.error('Error registering push token with backend:', error);
    return false;
  }
}

/**
 * Schedule a local notification
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  trigger?: Date | number
): Promise<string | null> {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: trigger || null,
    });

    return notificationId;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
}

/**
 * Cancel a scheduled notification
 */
export async function cancelScheduledNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.error('Error canceling notification:', error);
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error canceling all notifications:', error);
  }
}

/**
 * Get all scheduled notifications
 */
export async function getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error getting scheduled notifications:', error);
    return [];
  }
}

/**
 * Set up notification listeners
 */
export function setupNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationTapped?: (response: Notifications.NotificationResponse) => void
) {
  // Listener for notifications received while app is foregrounded
  const receivedListener = Notifications.addNotificationReceivedListener((notification) => {
    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  });

  // Listener for when user taps on notification
  const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    if (onNotificationTapped) {
      onNotificationTapped(response);
    }
  });

  // Return cleanup function
  return () => {
    Notifications.removeNotificationSubscription(receivedListener);
    Notifications.removeNotificationSubscription(responseListener);
  };
}

/**
 * Get notification badge count
 */
export async function getBadgeCount(): Promise<number> {
  try {
    return await Notifications.getBadgeCountAsync();
  } catch (error) {
    console.error('Error getting badge count:', error);
    return 0;
  }
}

/**
 * Set notification badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error('Error setting badge count:', error);
  }
}

/**
 * Clear all notifications
 */
export async function clearAllNotifications(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch (error) {
    console.error('Error clearing notifications:', error);
  }
}
