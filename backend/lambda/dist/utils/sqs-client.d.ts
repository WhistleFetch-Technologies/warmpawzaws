/**
 * ============================================================================
 * SQS CLIENT UTILITY
 * ============================================================================
 *
 * Helper functions for sending messages to SQS queues
 *
 * Date: 2025-01-28
 * ============================================================================
 */
export interface QueueConfig {
    notificationQueue?: string;
    emailQueue?: string;
    smsQueue?: string;
    analyticsQueue?: string;
    settlementQueue?: string;
}
/**
 * Send message to notification queue
 */
export declare function sendToNotificationQueue(message: any): Promise<void>;
/**
 * Send message to email queue
 */
export declare function sendToEmailQueue(message: any): Promise<void>;
/**
 * Send message to SMS queue
 */
export declare function sendToSmsQueue(message: any): Promise<void>;
/**
 * Send message to analytics queue
 */
export declare function sendToAnalyticsQueue(message: any): Promise<void>;
/**
 * Send message to settlement queue
 */
export declare function sendToSettlementQueue(message: any): Promise<void>;
//# sourceMappingURL=sqs-client.d.ts.map