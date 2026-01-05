"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendToNotificationQueue = sendToNotificationQueue;
exports.sendToEmailQueue = sendToEmailQueue;
exports.sendToSmsQueue = sendToSmsQueue;
exports.sendToAnalyticsQueue = sendToAnalyticsQueue;
exports.sendToSettlementQueue = sendToSettlementQueue;
const client_sqs_1 = require("@aws-sdk/client-sqs");
const sqsClient = new client_sqs_1.SQSClient({
    region: process.env.AWS_REGION || 'ap-south-1',
});
const QUEUE_URLS = {
    notificationQueue: process.env.NOTIFICATION_QUEUE_URL,
    emailQueue: process.env.EMAIL_QUEUE_URL,
    smsQueue: process.env.SMS_QUEUE_URL,
    analyticsQueue: process.env.ANALYTICS_QUEUE_URL,
    settlementQueue: process.env.SETTLEMENT_QUEUE_URL,
};
/**
 * Send message to notification queue
 */
async function sendToNotificationQueue(message) {
    if (!QUEUE_URLS.notificationQueue) {
        console.warn('Notification queue URL not configured');
        return;
    }
    await sqsClient.send(new client_sqs_1.SendMessageCommand({
        QueueUrl: QUEUE_URLS.notificationQueue,
        MessageBody: JSON.stringify(message),
    }));
}
/**
 * Send message to email queue
 */
async function sendToEmailQueue(message) {
    if (!QUEUE_URLS.emailQueue) {
        console.warn('Email queue URL not configured');
        return;
    }
    await sqsClient.send(new client_sqs_1.SendMessageCommand({
        QueueUrl: QUEUE_URLS.emailQueue,
        MessageBody: JSON.stringify(message),
    }));
}
/**
 * Send message to SMS queue
 */
async function sendToSmsQueue(message) {
    if (!QUEUE_URLS.smsQueue) {
        console.warn('SMS queue URL not configured');
        return;
    }
    await sqsClient.send(new client_sqs_1.SendMessageCommand({
        QueueUrl: QUEUE_URLS.smsQueue,
        MessageBody: JSON.stringify(message),
    }));
}
/**
 * Send message to analytics queue
 */
async function sendToAnalyticsQueue(message) {
    if (!QUEUE_URLS.analyticsQueue) {
        console.warn('Analytics queue URL not configured');
        return;
    }
    await sqsClient.send(new client_sqs_1.SendMessageCommand({
        QueueUrl: QUEUE_URLS.analyticsQueue,
        MessageBody: JSON.stringify(message),
    }));
}
/**
 * Send message to settlement queue
 */
async function sendToSettlementQueue(message) {
    if (!QUEUE_URLS.settlementQueue) {
        console.warn('Settlement queue URL not configured');
        return;
    }
    await sqsClient.send(new client_sqs_1.SendMessageCommand({
        QueueUrl: QUEUE_URLS.settlementQueue,
        MessageBody: JSON.stringify(message),
    }));
}
//# sourceMappingURL=sqs-client.js.map