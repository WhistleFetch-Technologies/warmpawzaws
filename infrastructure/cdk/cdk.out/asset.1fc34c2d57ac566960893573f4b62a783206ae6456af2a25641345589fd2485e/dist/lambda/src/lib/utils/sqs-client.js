"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendToQueue = sendToQueue;
exports.sendNotificationToQueue = sendNotificationToQueue;
exports.sendEmailToQueue = sendEmailToQueue;
exports.sendSMSToQueue = sendSMSToQueue;
exports.sendAnalyticsToQueue = sendAnalyticsToQueue;
const client_sqs_1 = require("@aws-sdk/client-sqs");
// Initialize SQS client
const sqsClient = new client_sqs_1.SQSClient({
    region: process.env.AWS_REGION || 'ap-south-1',
});
/**
 * Send message to SQS queue
 */
async function sendToQueue(queueUrl, messageBody, messageAttributes) {
    if (!queueUrl) {
        console.warn('⚠️ [SQS] Queue URL not configured, skipping queue send');
        return { success: false, error: 'Queue URL not configured' };
    }
    try {
        const command = new client_sqs_1.SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: typeof messageBody === 'string' ? messageBody : JSON.stringify(messageBody),
            MessageAttributes: messageAttributes,
        });
        const response = await sqsClient.send(command);
        console.log(`✅ [SQS] Message sent to queue: ${response.MessageId}`);
        return {
            success: true,
            messageId: response.MessageId,
        };
    }
    catch (error) {
        console.error('❌ [SQS] Error sending message:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
/**
 * Send notification to notification queue
 */
async function sendNotificationToQueue(notification) {
    const queueUrl = process.env.SQS_NOTIFICATION_QUEUE_URL;
    return sendToQueue(queueUrl, {
        type: 'notification',
        ...notification,
        timestamp: new Date().toISOString(),
    });
}
/**
 * Send email to email queue
 */
async function sendEmailToQueue(email) {
    const queueUrl = process.env.SQS_EMAIL_QUEUE_URL;
    return sendToQueue(queueUrl, {
        type: 'email',
        ...email,
        timestamp: new Date().toISOString(),
    });
}
/**
 * Send SMS to SMS queue
 */
async function sendSMSToQueue(phone, message, smsType = 'Transactional') {
    const queueUrl = process.env.SQS_SMS_QUEUE_URL;
    return sendToQueue(queueUrl, {
        type: 'sms',
        phone,
        message,
        timestamp: new Date().toISOString(),
    }, {
        SMSType: {
            DataType: 'String',
            StringValue: smsType,
        },
    });
}
/**
 * Send analytics event to analytics queue
 */
async function sendAnalyticsToQueue(event) {
    const queueUrl = process.env.SQS_ANALYTICS_QUEUE_URL;
    return sendToQueue(queueUrl, {
        type: 'analytics',
        ...event,
        timestamp: new Date().toISOString(),
    });
}
//# sourceMappingURL=sqs-client.js.map