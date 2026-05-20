/**
 * Push Notifications Utility
 *
 * Lazy-loads `expo-notifications` and `expo-device` behind try/catch so the
 * app does not crash on cold start when the bare React Native project hasn't
 * wired up `expo-modules-core` natively (no `useExpoModules()` in
 * `android/settings.gradle`, no `ExpoModulesCorePlugin` in
 * `android/app/build.gradle`, no `ApplicationLifecycleDispatcher.onApplicationCreate`
 * in `MainApplication.kt`). When the modules aren't available every helper
 * silently returns null / no-op so consumers (App.tsx push registration,
 * settings screen) keep working without push.
 *
 * To re-enable push, wire expo-modules-core:
 *   1. android/settings.gradle:
 *        apply from: "../node_modules/expo-modules-autolinking/scripts/autolinking.gradle"
 *        useExpoModules()
 *   2. android/app/build.gradle (top):
 *        apply from: "../../node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle"
 *   3. MainApplication.kt:
 *        - wrap host with ReactNativeHostWrapper(this, ...)
 *        - call ApplicationLifecycleDispatcher.onApplicationCreate(this) in onCreate
 *   4. MainActivity.kt: wrap delegate with ReactActivityDelegateWrapper
 */

import { Alert, Platform } from 'react-native';
import { CustomerApi } from '../services/api';

type NotificationsModule = typeof import('expo-notifications');
type DeviceModule = typeof import('expo-device');

let _notifications: NotificationsModule | null = null;
let _device: DeviceModule | null = null;
let _initTried = false;

function tryLoadExpoModules(): void {
  if (_initTried) return;
  _initTried = true;

  try {
    _notifications = require('expo-notifications');
  } catch (err) {
    console.warn(
      '[notifications] expo-notifications unavailable (native module not registered). Push notifications disabled.',
      (err as Error)?.message
    );
    _notifications = null;
  }

  try {
    _device = require('expo-device');
  } catch (err) {
    console.warn(
      '[notifications] expo-device unavailable. Falling back to generic deviceId.',
      (err as Error)?.message
    );
    _device = null;
  }

  // setNotificationHandler runs once and only if the native module loaded.
  if (_notifications) {
    try {
      _notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    } catch (err) {
      console.warn(
        '[notifications] setNotificationHandler threw; native bridge likely missing.',
        (err as Error)?.message
      );
    }
  }
}

tryLoadExpoModules();

export interface NotificationToken {
  token: string;
  deviceId: string;
}

/**
 * Register device for push notifications
 * Returns notification token for backend registration
 */
export async function registerForPushNotifications(): Promise<NotificationToken | null> {
  if (!_notifications) return null;
  try {
    if (_device && !_device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return null;
    }

    // Request permissions
    const { status: existingStatus } = await _notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await _notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      Alert.alert('Permission Required', 'Please grant notification permission in settings');
      return null;
    }

    // Get Expo push token. Read project id from env in this priority:
    //   1. EXPO_PUBLIC_PROJECT_ID  (preferred, exposed to client bundles)
    //   2. EXPO_PROJECT_ID         (legacy)
    //   3. app.json -> expo.extra.eas.projectId via expo-constants
    let projectId = process.env.EXPO_PUBLIC_PROJECT_ID || process.env.EXPO_PROJECT_ID;
    if (!projectId) {
      try {
        const Constants = require('expo-constants').default;
        projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ||
          Constants?.easConfig?.projectId ||
          undefined;
      } catch (_) {
        // expo-constants not available; fall through to the explicit error below.
      }
    }

    if (!projectId) {
      console.warn(
        '[push] EXPO_PUBLIC_PROJECT_ID is not set and app.json has no expo.extra.eas.projectId — push notifications disabled.'
      );
      return null;
    }

    const tokenData = await _notifications.getExpoPushTokenAsync({ projectId });

    const deviceId = (_device && (_device.modelId || _device.modelName)) || 'unknown';

    return {
      token: tokenData.data,
      deviceId,
    };
  } catch (error) {
    console.error('Error registering for push notifications:', error);
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
  if (!_notifications) return null;
  try {
    const notificationId = await _notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        priority: _notifications.AndroidNotificationPriority.HIGH,
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
  if (!_notifications) return;
  try {
    await _notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.error('Error canceling notification:', error);
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  if (!_notifications) return;
  try {
    await _notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error canceling all notifications:', error);
  }
}

/**
 * Get all scheduled notifications
 */
export async function getAllScheduledNotifications(): Promise<any[]> {
  if (!_notifications) return [];
  try {
    return await _notifications.getAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error getting scheduled notifications:', error);
    return [];
  }
}

/**
 * Set up notification listeners
 */
export function setupNotificationListeners(
  onNotificationReceived?: (notification: any) => void,
  onNotificationTapped?: (response: any) => void
) {
  if (!_notifications) {
    return () => {};
  }
  try {
    const receivedListener = _notifications.addNotificationReceivedListener((notification) => {
      if (onNotificationReceived) onNotificationReceived(notification);
    });

    const responseListener = _notifications.addNotificationResponseReceivedListener((response) => {
      if (onNotificationTapped) onNotificationTapped(response);
    });

    return () => {
      try {
        _notifications?.removeNotificationSubscription(receivedListener);
        _notifications?.removeNotificationSubscription(responseListener);
      } catch (_) {
        // ignore
      }
    };
  } catch (error) {
    console.warn('[notifications] setupNotificationListeners failed:', error);
    return () => {};
  }
}

/**
 * Get notification badge count
 */
export async function getBadgeCount(): Promise<number> {
  if (!_notifications) return 0;
  try {
    return await _notifications.getBadgeCountAsync();
  } catch (error) {
    console.error('Error getting badge count:', error);
    return 0;
  }
}

/**
 * Set notification badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  if (!_notifications) return;
  try {
    await _notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error('Error setting badge count:', error);
  }
}

/**
 * Clear all notifications
 */
export async function clearAllNotifications(): Promise<void> {
  if (!_notifications) return;
  try {
    await _notifications.dismissAllNotificationsAsync();
  } catch (error) {
    console.error('Error clearing notifications:', error);
  }
}
