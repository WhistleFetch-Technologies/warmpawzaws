/**
 * ============================================================================
 * SQS CLIENT UTILITY
 * ============================================================================
 *
 * Helper functions for sending messages to SQS queues
 * Used for async processing of notifications, emails, analytics, etc.
 *
 * Date: 2025-01-28
 * ============================================================================
 */
/**
 * Send message to SQS queue
 */
export declare function sendToQueue(queueUrl: string | undefined, messageBody: any, messageAttributes?: Record<string, {
    DataType: string;
    StringValue: string;
}>): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
}>;
/**
 * Send notification to notification queue
 */
export declare function sendNotificationToQueue(notification: {
    recipientType: string;
    recipientId: string;
    type: string;
    title: string;
    message: string;
    data?: any;
    priority?: string;
}): Promise<{
    success: boolean;
    messageId?: string;
}>;
/**
 * Send email to email queue
 */
export declare function sendEmailToQueue(email: {
    to: string;
    subject: string;
    body: string;
    html?: string;
    from?: string;
}): Promise<{
    success: boolean;
    messageId?: string;
}>;
/**
 * Send SMS to SMS queue
 */
export declare function sendSMSToQueue(phone: string, message: string, smsType?: 'Transactional' | 'Promotional'): Promise<{
    success: boolean;
    messageId?: string;
}>;
/**
 * Send analytics event to analytics queue
 */
export declare function sendAnalyticsToQueue(event: {
    eventType: string;
    userId?: string;
    userType?: string;
    metadata?: any;
}): Promise<{
    success: boolean;
    messageId?: string;
}>;
//# sourceMappingURL=sqs-client.d.ts.map