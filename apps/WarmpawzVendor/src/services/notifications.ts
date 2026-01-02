/**
 * Push Notification Service
 * Wire push notifications to backend
 * Batch 1 - Screen 9
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ApiService } from './api';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let deviceToken: string | null = null;

/**
 * Request notification permissions and register device
 */
export async function setupPushNotifications(vendorId: string): Promise<string | null> {
  try {
    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Push notification permission not granted');
      return null;
    }

    // Get device token
    // Project ID is automatically detected from app.json/app.config.js
    // For custom configuration, set EXPO_PROJECT_ID environment variable
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PROJECT_ID || undefined, // Auto-detected if not provided
    });

    deviceToken = token.data;

    // Register device token with backend
    try {
      // ✅ MIGRATED: Removed Supabase path, using API Gateway directly
      await ApiService.post('/vendor/notifications/register', {
        vendorId,
        deviceToken: token.data,
        platform: Platform.OS,
      });
      console.log('Device token registered successfully');
    } catch (error) {
      console.error('Error registering device token:', error);
    }

    // Set up notification listeners
    setupNotificationListeners();

    return token.data;
  } catch (error) {
    console.error('Error setting up push notifications:', error);
    return null;
  }
}

/**
 * Set up notification event listeners
 */
function setupNotificationListeners() {
  // Handle notification received while app is in foreground
  Notifications.addNotificationReceivedListener((notification) => {
    console.log('Notification received:', notification);
    // Handle notification display
  });

  // Handle notification tapped
  Notifications.addNotificationResponseReceivedListener((response) => {
    console.log('Notification tapped:', response);
    const data = response.notification.request.content.data;
    
    // Navigate based on notification data
    if (data?.bookingId) {
      // Navigate to booking detail
      // navigation.navigate('BookingDetail', { bookingId: data.bookingId });
    }
  });
}

/**
 * Get current device token
 */
export function getDeviceToken(): string | null {
  return deviceToken;
}

/**
 * Unregister device token
 */
export async function unregisterPushNotifications(vendorId: string): Promise<void> {
  if (!deviceToken) return;

  try {
    // ✅ MIGRATED: Removed Supabase path, using API Gateway directly
    await ApiService.post('/vendor/notifications/unregister', {
      vendorId,
      deviceToken,
    });
    deviceToken = null;
  } catch (error) {
    console.error('Error unregistering device token:', error);
  }
}

/**
 * Schedule local notification (for testing)
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: any
): Promise<string> {
  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: null, // Show immediately
  });
}

