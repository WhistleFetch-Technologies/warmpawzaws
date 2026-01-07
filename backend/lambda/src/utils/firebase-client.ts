/**
 * ============================================================================
 * FIREBASE PUSH NOTIFICATION CLIENT
 * ============================================================================
 * 
 * Handles push notifications via Firebase Cloud Messaging (FCM)
 * for mobile apps (iOS + Android)
 * 
 * Date: 2025-01-02
 * ============================================================================
 */

// Use require to avoid type dependency; runtime will use firebase-admin if available
// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin: any = require('firebase-admin');

let firebaseApp: any | null = null;

/**
 * Initialize Firebase Admin SDK
 */
function initializeFirebase(): any {
  if (firebaseApp) {
    return firebaseApp;
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    : {
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      };

  if (!serviceAccount.projectId) {
    console.warn('[Firebase] Missing Firebase configuration - push notifications will be disabled');
    throw new Error('Firebase configuration not found');
  }

  try {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.projectId,
    });
    console.log('[Firebase] Initialized successfully');
    return firebaseApp;
  } catch (error) {
    console.error('[Firebase] Initialization error:', error);
    throw error;
  }
}

/**
 * Get Firebase messaging instance
 */
export function getFirebaseMessaging(): any {
  const app = initializeFirebase();
  return admin.messaging(app);
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, string>;
}

export interface PushNotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send push notification to a single device
 */
export async function sendPushToDevice(
  fcmToken: string,
  payload: PushNotificationPayload
): Promise<PushNotificationResult> {
  try {
    const messaging = getFirebaseMessaging();
    
    const message: any = {
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: payload.data,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await messaging.send(message);
    console.log('[Firebase] Push sent successfully:', response);
    
    return {
      success: true,
      messageId: response,
    };
  } catch (error: any) {
    console.error('[Firebase] Push notification error:', error);
    
    // Handle specific FCM errors
    if (error.code === 'messaging/registration-token-not-registered') {
      return {
        success: false,
        error: 'Invalid or expired FCM token',
      };
    }
    
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Send push notification to multiple devices
 */
export async function sendPushToMultipleDevices(
  fcmTokens: string[],
  payload: PushNotificationPayload
): Promise<{ successCount: number; failureCount: number; results: PushNotificationResult[] }> {
  if (fcmTokens.length === 0) {
    return { successCount: 0, failureCount: 0, results: [] };
  }

  try {
    const messaging = getFirebaseMessaging();
    
    const message: any = {
      tokens: fcmTokens,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: payload.data,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await messaging.sendEachForMulticast(message);
    
    const results: PushNotificationResult[] = response.responses.map((r: any) => ({
      success: r.success,
      messageId: r.messageId,
      error: r.error?.message,
    }));

    console.log(`[Firebase] Multicast: ${response.successCount} success, ${response.failureCount} failed`);
    
    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      results,
    };
  } catch (error: any) {
    console.error('[Firebase] Multicast error:', error);
    return {
      successCount: 0,
      failureCount: fcmTokens.length,
      results: fcmTokens.map(() => ({ success: false, error: error.message })),
    };
  }
}

/**
 * Send push notification to a topic
 */
export async function sendPushToTopic(
  topic: string,
  payload: PushNotificationPayload
): Promise<PushNotificationResult> {
  try {
    const messaging = getFirebaseMessaging();
    
    const message: any = {
      topic: topic,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: payload.data,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    };

    const response = await messaging.send(message);
    console.log('[Firebase] Topic push sent:', response);
    
    return {
      success: true,
      messageId: response,
    };
  } catch (error: any) {
    console.error('[Firebase] Topic push error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Subscribe device to a topic
 */
export async function subscribeToTopic(
  fcmToken: string,
  topic: string
): Promise<boolean> {
  try {
    const messaging = getFirebaseMessaging();
    await messaging.subscribeToTopic(fcmToken, topic);
    console.log(`[Firebase] Subscribed to topic: ${topic}`);
    return true;
  } catch (error) {
    console.error('[Firebase] Subscribe error:', error);
    return false;
  }
}

/**
 * Unsubscribe device from a topic
 */
export async function unsubscribeFromTopic(
  fcmToken: string,
  topic: string
): Promise<boolean> {
  try {
    const messaging = getFirebaseMessaging();
    await messaging.unsubscribeFromTopic(fcmToken, topic);
    console.log(`[Firebase] Unsubscribed from topic: ${topic}`);
    return true;
  } catch (error) {
    console.error('[Firebase] Unsubscribe error:', error);
    return false;
  }
}

// ============================================================================
// NOTIFICATION TEMPLATES
// ============================================================================

export const PushTemplates = {
  BOOKING_CONFIRMED: (data: { serviceName: string; date: string; time: string }) => ({
    title: 'Booking Confirmed! 🎉',
    body: `Your ${data.serviceName} booking on ${data.date} at ${data.time} is confirmed.`,
    data: { type: 'booking_confirmed' },
  }),

  BOOKING_REMINDER: (data: { serviceName: string; time: string }) => ({
    title: 'Upcoming Appointment ⏰',
    body: `Reminder: Your ${data.serviceName} appointment is in ${data.time}.`,
    data: { type: 'booking_reminder' },
  }),

  BOOKING_CANCELLED: (data: { serviceName: string; reason?: string }) => ({
    title: 'Booking Cancelled',
    body: data.reason
      ? `Your ${data.serviceName} booking was cancelled. Reason: ${data.reason}`
      : `Your ${data.serviceName} booking was cancelled.`,
    data: { type: 'booking_cancelled' },
  }),

  VENDOR_NEW_BOOKING: (data: { customerName: string; serviceName: string; date: string }) => ({
    title: 'New Booking! 📅',
    body: `${data.customerName} booked ${data.serviceName} for ${data.date}.`,
    data: { type: 'new_booking' },
  }),

  PAYMENT_RECEIVED: (data: { amount: string }) => ({
    title: 'Payment Received 💰',
    body: `₹${data.amount} payment received successfully.`,
    data: { type: 'payment_received' },
  }),

  PAYOUT_COMPLETED: (data: { amount: string }) => ({
    title: 'Payout Completed ✅',
    body: `₹${data.amount} has been transferred to your bank account.`,
    data: { type: 'payout_completed' },
  }),

  APPLICATION_APPROVED: () => ({
    title: 'Application Approved! 🎉',
    body: 'Congratulations! Your vendor application has been approved. Start accepting bookings now.',
    data: { type: 'vendor_approved' },
  }),

  APPLICATION_REJECTED: (data: { reason: string }) => ({
    title: 'Application Update',
    body: `Your application requires attention: ${data.reason}`,
    data: { type: 'vendor_rejected' },
  }),

  SERVICE_STARTED: (data: { serviceName: string }) => ({
    title: 'Service Started 🚀',
    body: `Your ${data.serviceName} service has started.`,
    data: { type: 'service_started' },
  }),

  SERVICE_COMPLETED: (data: { serviceName: string }) => ({
    title: 'Service Completed ✅',
    body: `Your ${data.serviceName} is complete. Please rate your experience.`,
    data: { type: 'service_completed' },
  }),

  CHAT_MESSAGE: (data: { senderName: string; preview: string }) => ({
    title: `New message from ${data.senderName}`,
    body: data.preview.length > 50 ? data.preview.substring(0, 50) + '...' : data.preview,
    data: { type: 'chat_message' },
  }),

  GPS_TRACKING_STARTED: (data: { providerName: string }) => ({
    title: 'Provider En Route 📍',
    body: `${data.providerName} is on the way. Track their location in the app.`,
    data: { type: 'gps_tracking' },
  }),

  PROMOTION: (data: { title: string; message: string }) => ({
    title: data.title,
    body: data.message,
    data: { type: 'promotion' },
  }),
};

