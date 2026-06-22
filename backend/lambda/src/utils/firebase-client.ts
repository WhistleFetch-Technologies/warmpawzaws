/**
 * ============================================================================
 * FIREBASE PUSH NOTIFICATION CLIENT
 * ============================================================================
 *
 * Handles push notifications via Firebase Cloud Messaging (FCM)
 * for mobile apps (iOS + Android)
 *
 * Credentials (first match wins):
 *   1. FIREBASE_SERVICE_ACCOUNT_JSON env var (full service account JSON)
 *   2. AWS Secrets Manager secret warmpawz/{stage}/firebase
 *   3. FIREBASE_PROJECT_ID + FIREBASE_PRIVATE_KEY + FIREBASE_CLIENT_EMAIL
 *
 * firebase-admin is loaded at runtime from dist/node_modules (see package-lambda.js).
 * ============================================================================
 */

let admin: any = null;
let firebaseAvailable = false;
let firebaseLoadAttempted = false;
let firebaseApp: any | null = null;

type FirebaseServiceAccount = {
  projectId: string;
  privateKey: string;
  clientEmail: string;
};

let configPromise: Promise<FirebaseServiceAccount | null> | null = null;

function normalizeServiceAccount(raw: Record<string, string | undefined>): FirebaseServiceAccount | null {
  const projectId = raw.projectId || raw.project_id;
  const privateKey = (raw.privateKey || raw.private_key)?.replace(/\\n/g, '\n');
  const clientEmail = raw.clientEmail || raw.client_email;

  if (!projectId || !privateKey || !clientEmail) {
    return null;
  }

  return { projectId, privateKey, clientEmail };
}

async function resolveFirebaseConfig(): Promise<FirebaseServiceAccount | null> {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) as Record<string, string>;
      const fromEnv = normalizeServiceAccount(parsed);
      if (fromEnv) {
        return fromEnv;
      }
    } catch (error) {
      console.error('[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', error);
    }
  }

  try {
    const { getSecretJson } = await import('./aws/secrets-manager');
    const fromSecret = await getSecretJson<Record<string, string>>('firebase');
    const normalized = fromSecret ? normalizeServiceAccount(fromSecret) : null;
    if (normalized) {
      return normalized;
    }
  } catch (error) {
    console.warn('[Firebase] Could not load warmpawz/{stage}/firebase secret:', error);
  }

  return normalizeServiceAccount({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  });
}

/**
 * Lazy load firebase-admin module
 * Uses eval to prevent esbuild from trying to bundle it
 */
function loadFirebaseAdmin(): boolean {
  if (firebaseLoadAttempted) {
    return firebaseAvailable;
  }

  firebaseLoadAttempted = true;

  try {
    admin = eval('require')('firebase-admin');
    firebaseAvailable = true;
    console.log('[Firebase] Module loaded successfully');
    return true;
  } catch (error) {
    console.warn(
      '[Firebase] firebase-admin not available — ensure api-handler.zip includes dist/node_modules/firebase-admin:',
      error
    );
    firebaseAvailable = false;
    return false;
  }
}

/**
 * Initialize Firebase Admin SDK
 */
async function initializeFirebase(): Promise<any> {
  if (!loadFirebaseAdmin()) {
    throw new Error(
      'Firebase not available — firebase-admin module missing from Lambda package. Redeploy with npm run build.'
    );
  }

  if (firebaseApp) {
    return firebaseApp;
  }

  if (!configPromise) {
    configPromise = resolveFirebaseConfig();
  }

  const serviceAccount = await configPromise;
  if (!serviceAccount) {
    console.warn('[Firebase] Missing Firebase configuration');
    throw new Error(
      'Firebase configuration not found — set FIREBASE_* env vars or Secrets Manager secret warmpawz/{stage}/firebase'
    );
  }

  try {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.projectId,
    });
    console.log('[Firebase] Initialized successfully for project', serviceAccount.projectId);
    return firebaseApp;
  } catch (error) {
    console.error('[Firebase] Initialization error:', error);
    throw error;
  }
}

/**
 * Get Firebase messaging instance
 */
async function getFirebaseMessaging(): Promise<any> {
  if (!loadFirebaseAdmin()) {
    throw new Error(
      'Firebase not available — firebase-admin module missing from Lambda package. Redeploy with npm run build.'
    );
  }

  const app = await initializeFirebase();
  return admin.messaging(app);
}

/**
 * Check if Firebase module is present in the Lambda package
 */
export function isFirebaseAvailable(): boolean {
  return loadFirebaseAdmin();
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
  errorCode?: string;
  token?: string;
}

/**
 * Classify FCM errors for retry vs token deactivation.
 */
export function classifyFcmError(
  errorCode?: string,
  errorMessage?: string
): 'permanent' | 'transient' | 'unknown' {
  const code = String(errorCode || '').toLowerCase();
  const msg = String(errorMessage || '').toLowerCase();

  const permanentCodes = [
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
    'messaging/invalid-argument',
  ];
  if (permanentCodes.includes(code)) return 'permanent';
  if (
    msg.includes('not registered') ||
    msg.includes('invalid registration') ||
    msg.includes('requested entity was not found')
  ) {
    return 'permanent';
  }

  const transientCodes = [
    'messaging/server-unavailable',
    'messaging/internal-error',
    'messaging/unknown-error',
    'messaging/quota-exceeded',
  ];
  if (transientCodes.some((c) => code === c)) return 'transient';
  if (msg.includes('unavailable') || msg.includes('timeout') || msg.includes('503')) {
    return 'transient';
  }

  return 'unknown';
}

/**
 * Deactivate invalid FCM tokens in device_tokens.
 */
export async function deactivateDeviceTokens(fcmTokens: string[]): Promise<number> {
  if (fcmTokens.length === 0) return 0;
  try {
    const { query } = await import('../database/rds-connection');
    const result = await query(
      `UPDATE device_tokens
       SET is_active = false, updated_at = NOW()
       WHERE fcm_token = ANY($1::text[])
         AND is_active = true`,
      [fcmTokens]
    );
    const count = result.rowCount ?? 0;
    if (count > 0) {
      console.log(`[Firebase] Deactivated ${count} invalid device token(s)`);
    }
    return count;
  } catch (error) {
    console.error('[Firebase] Failed to deactivate tokens:', error);
    return 0;
  }
}

export const WARMPAWZ_FCM_ANDROID_CHANNEL_ID = 'warmpawz_push_alerts';

function buildAndroidPushConfig() {
  return {
    priority: 'high' as const,
    notification: {
      channelId: WARMPAWZ_FCM_ANDROID_CHANNEL_ID,
      sound: 'default',
      defaultSound: true,
      defaultVibrateTimings: true,
      visibility: 'PUBLIC' as const,
      notificationPriority: 'PRIORITY_HIGH' as const,
    },
  };
}

function buildApnsPushConfig(data?: Record<string, string>) {
  return {
    headers: {
      'apns-priority': '10',
    },
    payload: {
      aps: {
        sound: 'default',
        badge: 1,
        'interruption-level': 'active',
      },
      ...(data || {}),
    },
  };
}

function buildFcmMessage(payload: PushNotificationPayload, target: 'token' | 'tokens' | 'topic', address: string | string[]) {
  const base: Record<string, unknown> = {
    notification: {
      title: payload.title,
      body: payload.body,
      imageUrl: payload.imageUrl,
    },
    data: payload.data,
    android: buildAndroidPushConfig(),
    apns: buildApnsPushConfig(payload.data),
  };

  if (target === 'token') {
    base.token = address;
  } else if (target === 'tokens') {
    base.tokens = address;
  } else {
    base.topic = address;
  }

  return base;
}

/** Exported for tests — same shape used by dispatchNotification → Firebase multicast. */
export function buildUnifiedPushMessage(
  payload: PushNotificationPayload,
  target: 'token' | 'tokens' | 'topic',
  address: string | string[]
): Record<string, unknown> {
  return buildFcmMessage(payload, target, address);
}

/**
 * Send push notification to a single device
 */
export async function sendPushToDevice(
  fcmToken: string,
  payload: PushNotificationPayload
): Promise<PushNotificationResult> {
  try {
    const messaging = await getFirebaseMessaging();

    const message = buildFcmMessage(payload, 'token', fcmToken);

    const response = await messaging.send(message);
    console.log('[Firebase] Push sent successfully:', response);

    return {
      success: true,
      messageId: response,
    };
  } catch (error: any) {
    console.error('[Firebase] Push notification error:', error);

    if (error.code === 'messaging/registration-token-not-registered') {
      return {
        success: false,
        error: 'Invalid or expired FCM token',
        errorCode: error.code,
        token: fcmToken,
      };
    }

    return {
      success: false,
      error: error.message,
      errorCode: error.code,
      token: fcmToken,
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
    const messaging = await getFirebaseMessaging();

    const message = buildFcmMessage(payload, 'tokens', fcmTokens);

    const response = await messaging.sendEachForMulticast(message);

    const results: PushNotificationResult[] = response.responses.map((r: any, index: number) => ({
      success: r.success,
      messageId: r.messageId,
      error: r.error?.message,
      errorCode: r.error?.code,
      token: fcmTokens[index],
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
    const messaging = await getFirebaseMessaging();

    const message = buildFcmMessage(payload, 'topic', topic);

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
    const messaging = await getFirebaseMessaging();
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
    const messaging = await getFirebaseMessaging();
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
