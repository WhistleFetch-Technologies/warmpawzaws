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
/**
 * Get Firebase messaging instance
 */
export declare function getFirebaseMessaging(): any;
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
export declare function sendPushToDevice(fcmToken: string, payload: PushNotificationPayload): Promise<PushNotificationResult>;
/**
 * Send push notification to multiple devices
 */
export declare function sendPushToMultipleDevices(fcmTokens: string[], payload: PushNotificationPayload): Promise<{
    successCount: number;
    failureCount: number;
    results: PushNotificationResult[];
}>;
/**
 * Send push notification to a topic
 */
export declare function sendPushToTopic(topic: string, payload: PushNotificationPayload): Promise<PushNotificationResult>;
/**
 * Subscribe device to a topic
 */
export declare function subscribeToTopic(fcmToken: string, topic: string): Promise<boolean>;
/**
 * Unsubscribe device from a topic
 */
export declare function unsubscribeFromTopic(fcmToken: string, topic: string): Promise<boolean>;
export declare const PushTemplates: {
    BOOKING_CONFIRMED: (data: {
        serviceName: string;
        date: string;
        time: string;
    }) => {
        title: string;
        body: string;
        data: {
            type: string;
        };
    };
    BOOKING_REMINDER: (data: {
        serviceName: string;
        time: string;
    }) => {
        title: string;
        body: string;
        data: {
            type: string;
        };
    };
    BOOKING_CANCELLED: (data: {
        serviceName: string;
        reason?: string;
    }) => {
        title: string;
        body: string;
        data: {
            type: string;
        };
    };
    VENDOR_NEW_BOOKING: (data: {
        customerName: string;
        serviceName: string;
        date: string;
    }) => {
        title: string;
        body: string;
        data: {
            type: string;
        };
    };
    PAYMENT_RECEIVED: (data: {
        amount: string;
    }) => {
        title: string;
        body: string;
        data: {
            type: string;
        };
    };
    PAYOUT_COMPLETED: (data: {
        amount: string;
    }) => {
        title: string;
        body: string;
        data: {
            type: string;
        };
    };
    APPLICATION_APPROVED: () => {
        title: string;
        body: string;
        data: {
            type: string;
        };
    };
    APPLICATION_REJECTED: (data: {
        reason: string;
    }) => {
        title: string;
        body: string;
        data: {
            type: string;
        };
    };
    SERVICE_STARTED: (data: {
        serviceName: string;
    }) => {
        title: string;
        body: string;
        data: {
            type: string;
        };
    };
    SERVICE_COMPLETED: (data: {
        serviceName: string;
    }) => {
        title: string;
        body: string;
        data: {
            type: string;
        };
    };
    CHAT_MESSAGE: (data: {
        senderName: string;
        preview: string;
    }) => {
        title: string;
        body: string;
        data: {
            type: string;
        };
    };
    GPS_TRACKING_STARTED: (data: {
        providerName: string;
    }) => {
        title: string;
        body: string;
        data: {
            type: string;
        };
    };
    PROMOTION: (data: {
        title: string;
        message: string;
    }) => {
        title: string;
        body: string;
        data: {
            type: string;
        };
    };
};
//# sourceMappingURL=firebase-client.d.ts.map