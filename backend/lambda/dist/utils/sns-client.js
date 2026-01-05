"use strict";
/**
 * ============================================================================
 * SNS CLIENT UTILITY (TEMPORAL AUDIT COMPLIANT)
 * ============================================================================
 *
 * Helper functions for publishing to SNS topics
 *
 * TEMPORAL AUDIT FIXES (2026-01-02):
 * - ✅ All events include timestamps
 * - ✅ All events include unique event IDs
 * - ✅ Standardized event envelope
 *
 * Date: 2025-01-28
 * Updated: 2026-01-02 (Temporal Audit Fixes)
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSnsClient = getSnsClient;
exports.publishBookingCreated = publishBookingCreated;
exports.publishBookingStatusUpdated = publishBookingStatusUpdated;
exports.publishPaymentCreated = publishPaymentCreated;
exports.publishPaymentProcessed = publishPaymentProcessed;
exports.publishVendorApproved = publishVendorApproved;
exports.publishSettlementCreated = publishSettlementCreated;
exports.publishNotification = publishNotification;
const client_sns_1 = require("@aws-sdk/client-sns");
const snsClient = new client_sns_1.SNSClient({
    region: process.env.AWS_REGION || 'ap-south-1',
});
// Expose client for callers that need direct access
function getSnsClient() {
    return snsClient;
}
const TOPIC_ARNS = {
    bookingCreatedTopic: process.env.BOOKING_CREATED_TOPIC_ARN,
    bookingStatusUpdatedTopic: process.env.BOOKING_STATUS_UPDATED_TOPIC_ARN,
    paymentCreatedTopic: process.env.PAYMENT_CREATED_TOPIC_ARN,
    paymentProcessedTopic: process.env.PAYMENT_PROCESSED_TOPIC_ARN,
    vendorApprovedTopic: process.env.VENDOR_APPROVED_TOPIC_ARN,
    notificationTopic: process.env.NOTIFICATION_TOPIC_ARN,
    settlementTopic: process.env.SETTLEMENT_TOPIC_ARN,
};
/**
 * Create a standardized event envelope with temporal metadata
 */
function createEventEnvelope(eventType, data, correlationId) {
    return {
        eventId: crypto.randomUUID(),
        eventType,
        eventTimestamp: new Date().toISOString(),
        eventSource: 'warmpawz-backend',
        eventVersion: '1.0',
        correlationId,
        data,
    };
}
/**
 * Publish booking created event with temporal metadata
 */
async function publishBookingCreated(message) {
    if (!TOPIC_ARNS.bookingCreatedTopic) {
        console.warn('Booking created topic ARN not configured');
        return;
    }
    const envelope = createEventEnvelope('BOOKING_CREATED', message, message.requestId);
    await snsClient.send(new client_sns_1.PublishCommand({
        TopicArn: TOPIC_ARNS.bookingCreatedTopic,
        Message: JSON.stringify(envelope),
        Subject: 'Booking Created',
        MessageAttributes: {
            eventType: { DataType: 'String', StringValue: 'BOOKING_CREATED' },
            eventId: { DataType: 'String', StringValue: envelope.eventId },
            bookingId: { DataType: 'String', StringValue: message.bookingId },
            customerId: { DataType: 'String', StringValue: message.customerId },
            vendorId: { DataType: 'String', StringValue: message.vendorId },
        },
    }));
}
/**
 * Publish booking status updated event with temporal metadata
 */
async function publishBookingStatusUpdated(message) {
    const topicArn = TOPIC_ARNS.bookingStatusUpdatedTopic || TOPIC_ARNS.notificationTopic;
    if (!topicArn) {
        console.warn('Booking status updated topic ARN not configured');
        return;
    }
    const envelope = createEventEnvelope('BOOKING_STATUS_UPDATED', message, message.requestId);
    await snsClient.send(new client_sns_1.PublishCommand({
        TopicArn: topicArn,
        Message: JSON.stringify(envelope),
        Subject: `Booking Status: ${message.oldStatus} → ${message.newStatus}`,
        MessageAttributes: {
            eventType: { DataType: 'String', StringValue: 'BOOKING_STATUS_UPDATED' },
            eventId: { DataType: 'String', StringValue: envelope.eventId },
            bookingId: { DataType: 'String', StringValue: message.bookingId },
            oldStatus: { DataType: 'String', StringValue: message.oldStatus },
            newStatus: { DataType: 'String', StringValue: message.newStatus },
        },
    }));
}
/**
 * Publish payment created event with temporal metadata
 */
async function publishPaymentCreated(message) {
    const topicArn = TOPIC_ARNS.paymentCreatedTopic || TOPIC_ARNS.paymentProcessedTopic;
    if (!topicArn) {
        console.warn('Payment created topic ARN not configured');
        return;
    }
    const envelope = createEventEnvelope('PAYMENT_CREATED', message, message.requestId);
    await snsClient.send(new client_sns_1.PublishCommand({
        TopicArn: topicArn,
        Message: JSON.stringify(envelope),
        Subject: 'Payment Created',
        MessageAttributes: {
            eventType: { DataType: 'String', StringValue: 'PAYMENT_CREATED' },
            eventId: { DataType: 'String', StringValue: envelope.eventId },
            paymentId: { DataType: 'String', StringValue: message.paymentId },
            bookingId: { DataType: 'String', StringValue: message.bookingId },
        },
    }));
}
/**
 * Publish payment processed event with temporal metadata
 */
async function publishPaymentProcessed(message) {
    if (!TOPIC_ARNS.paymentProcessedTopic) {
        console.warn('Payment processed topic ARN not configured');
        return;
    }
    const envelope = createEventEnvelope('PAYMENT_PROCESSED', message, message.requestId);
    await snsClient.send(new client_sns_1.PublishCommand({
        TopicArn: TOPIC_ARNS.paymentProcessedTopic,
        Message: JSON.stringify(envelope),
        Subject: 'Payment Processed',
        MessageAttributes: {
            eventType: { DataType: 'String', StringValue: 'PAYMENT_PROCESSED' },
            eventId: { DataType: 'String', StringValue: envelope.eventId },
            paymentId: { DataType: 'String', StringValue: message.paymentId },
            status: { DataType: 'String', StringValue: message.status },
        },
    }));
}
/**
 * Publish vendor approved event with temporal metadata
 */
async function publishVendorApproved(message) {
    if (!TOPIC_ARNS.vendorApprovedTopic) {
        console.warn('Vendor approved topic ARN not configured');
        return;
    }
    const envelope = createEventEnvelope('VENDOR_APPROVED', message, message.requestId);
    await snsClient.send(new client_sns_1.PublishCommand({
        TopicArn: TOPIC_ARNS.vendorApprovedTopic,
        Message: JSON.stringify(envelope),
        Subject: 'Vendor Approved',
        MessageAttributes: {
            eventType: { DataType: 'String', StringValue: 'VENDOR_APPROVED' },
            eventId: { DataType: 'String', StringValue: envelope.eventId },
            vendorId: { DataType: 'String', StringValue: message.vendorId },
        },
    }));
}
/**
 * Publish settlement created event with temporal metadata
 */
async function publishSettlementCreated(message) {
    const topicArn = TOPIC_ARNS.settlementTopic || TOPIC_ARNS.notificationTopic;
    if (!topicArn) {
        console.warn('Settlement topic ARN not configured');
        return;
    }
    const envelope = createEventEnvelope('SETTLEMENT_CREATED', message, message.requestId);
    await snsClient.send(new client_sns_1.PublishCommand({
        TopicArn: topicArn,
        Message: JSON.stringify(envelope),
        Subject: 'Settlement Created',
        MessageAttributes: {
            eventType: { DataType: 'String', StringValue: 'SETTLEMENT_CREATED' },
            eventId: { DataType: 'String', StringValue: envelope.eventId },
            settlementId: { DataType: 'String', StringValue: message.settlementId },
            vendorId: { DataType: 'String', StringValue: message.vendorId },
        },
    }));
}
/**
 * Publish notification event with temporal metadata
 */
async function publishNotification(message) {
    if (!TOPIC_ARNS.notificationTopic) {
        console.warn('Notification topic ARN not configured');
        return;
    }
    const envelope = createEventEnvelope('NOTIFICATION', message, message.requestId);
    await snsClient.send(new client_sns_1.PublishCommand({
        TopicArn: TOPIC_ARNS.notificationTopic,
        Message: JSON.stringify(envelope),
        Subject: message.title,
        MessageAttributes: {
            eventType: { DataType: 'String', StringValue: 'NOTIFICATION' },
            eventId: { DataType: 'String', StringValue: envelope.eventId },
            recipientType: { DataType: 'String', StringValue: message.recipientType },
            recipientId: { DataType: 'String', StringValue: message.recipientId },
            notificationType: { DataType: 'String', StringValue: message.type },
        },
    }));
}
//# sourceMappingURL=sns-client.js.map