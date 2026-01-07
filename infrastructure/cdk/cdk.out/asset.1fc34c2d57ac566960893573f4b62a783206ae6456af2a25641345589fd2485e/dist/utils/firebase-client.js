"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushTemplates = void 0;
exports.getFirebaseMessaging = getFirebaseMessaging;
exports.sendPushToDevice = sendPushToDevice;
exports.sendPushToMultipleDevices = sendPushToMultipleDevices;
exports.sendPushToTopic = sendPushToTopic;
exports.subscribeToTopic = subscribeToTopic;
exports.unsubscribeFromTopic = unsubscribeFromTopic;
// Use require to avoid type dependency; runtime will use firebase-admin if available
// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require('firebase-admin');
let firebaseApp = null;
/**
 * Initialize Firebase Admin SDK
 */
function initializeFirebase() {
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
    }
    catch (error) {
        console.error('[Firebase] Initialization error:', error);
        throw error;
    }
}
/**
 * Get Firebase messaging instance
 */
function getFirebaseMessaging() {
    const app = initializeFirebase();
    return admin.messaging(app);
}
/**
 * Send push notification to a single device
 */
async function sendPushToDevice(fcmToken, payload) {
    try {
        const messaging = getFirebaseMessaging();
        const message = {
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
    }
    catch (error) {
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
async function sendPushToMultipleDevices(fcmTokens, payload) {
    if (fcmTokens.length === 0) {
        return { successCount: 0, failureCount: 0, results: [] };
    }
    try {
        const messaging = getFirebaseMessaging();
        const message = {
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
        const results = response.responses.map((r) => ({
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
    }
    catch (error) {
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
async function sendPushToTopic(topic, payload) {
    try {
        const messaging = getFirebaseMessaging();
        const message = {
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
    }
    catch (error) {
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
async function subscribeToTopic(fcmToken, topic) {
    try {
        const messaging = getFirebaseMessaging();
        await messaging.subscribeToTopic(fcmToken, topic);
        console.log(`[Firebase] Subscribed to topic: ${topic}`);
        return true;
    }
    catch (error) {
        console.error('[Firebase] Subscribe error:', error);
        return false;
    }
}
/**
 * Unsubscribe device from a topic
 */
async function unsubscribeFromTopic(fcmToken, topic) {
    try {
        const messaging = getFirebaseMessaging();
        await messaging.unsubscribeFromTopic(fcmToken, topic);
        console.log(`[Firebase] Unsubscribed from topic: ${topic}`);
        return true;
    }
    catch (error) {
        console.error('[Firebase] Unsubscribe error:', error);
        return false;
    }
}
// ============================================================================
// NOTIFICATION TEMPLATES
// ============================================================================
exports.PushTemplates = {
    BOOKING_CONFIRMED: (data) => ({
        title: 'Booking Confirmed! 🎉',
        body: `Your ${data.serviceName} booking on ${data.date} at ${data.time} is confirmed.`,
        data: { type: 'booking_confirmed' },
    }),
    BOOKING_REMINDER: (data) => ({
        title: 'Upcoming Appointment ⏰',
        body: `Reminder: Your ${data.serviceName} appointment is in ${data.time}.`,
        data: { type: 'booking_reminder' },
    }),
    BOOKING_CANCELLED: (data) => ({
        title: 'Booking Cancelled',
        body: data.reason
            ? `Your ${data.serviceName} booking was cancelled. Reason: ${data.reason}`
            : `Your ${data.serviceName} booking was cancelled.`,
        data: { type: 'booking_cancelled' },
    }),
    VENDOR_NEW_BOOKING: (data) => ({
        title: 'New Booking! 📅',
        body: `${data.customerName} booked ${data.serviceName} for ${data.date}.`,
        data: { type: 'new_booking' },
    }),
    PAYMENT_RECEIVED: (data) => ({
        title: 'Payment Received 💰',
        body: `₹${data.amount} payment received successfully.`,
        data: { type: 'payment_received' },
    }),
    PAYOUT_COMPLETED: (data) => ({
        title: 'Payout Completed ✅',
        body: `₹${data.amount} has been transferred to your bank account.`,
        data: { type: 'payout_completed' },
    }),
    APPLICATION_APPROVED: () => ({
        title: 'Application Approved! 🎉',
        body: 'Congratulations! Your vendor application has been approved. Start accepting bookings now.',
        data: { type: 'vendor_approved' },
    }),
    APPLICATION_REJECTED: (data) => ({
        title: 'Application Update',
        body: `Your application requires attention: ${data.reason}`,
        data: { type: 'vendor_rejected' },
    }),
    SERVICE_STARTED: (data) => ({
        title: 'Service Started 🚀',
        body: `Your ${data.serviceName} service has started.`,
        data: { type: 'service_started' },
    }),
    SERVICE_COMPLETED: (data) => ({
        title: 'Service Completed ✅',
        body: `Your ${data.serviceName} is complete. Please rate your experience.`,
        data: { type: 'service_completed' },
    }),
    CHAT_MESSAGE: (data) => ({
        title: `New message from ${data.senderName}`,
        body: data.preview.length > 50 ? data.preview.substring(0, 50) + '...' : data.preview,
        data: { type: 'chat_message' },
    }),
    GPS_TRACKING_STARTED: (data) => ({
        title: 'Provider En Route 📍',
        body: `${data.providerName} is on the way. Track their location in the app.`,
        data: { type: 'gps_tracking' },
    }),
    PROMOTION: (data) => ({
        title: data.title,
        body: data.message,
        data: { type: 'promotion' },
    }),
};
//# sourceMappingURL=firebase-client.js.map