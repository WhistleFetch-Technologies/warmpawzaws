"use strict";
/**
 * ============================================================================
 * AWS CLIENTS - UNIFIED AWS SDK UTILITIES
 * ============================================================================
 *
 * Provides unified access to AWS services:
 * - SNS for notifications
 * - SQS for queuing
 * - S3 for storage
 * - Chime for video calls
 *
 * Date: 2026-01-02
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishToSNS = publishToSNS;
exports.publishNotification = publishNotification;
exports.sendToSQS = sendToSQS;
exports.queueBookingEvent = queueBookingEvent;
exports.queuePaymentEvent = queuePaymentEvent;
exports.queueSettlement = queueSettlement;
exports.queueSearchIndexUpdate = queueSearchIndexUpdate;
exports.uploadToS3 = uploadToS3;
exports.getFromS3 = getFromS3;
exports.generateS3Key = generateS3Key;
exports.getTopicArn = getTopicArn;
exports.getQueueUrl = getQueueUrl;
exports.getBucketName = getBucketName;
const client_sns_1 = require("@aws-sdk/client-sns");
const client_sqs_1 = require("@aws-sdk/client-sqs");
const client_s3_1 = require("@aws-sdk/client-s3");
// ============================================================================
// CONFIGURATION
// ============================================================================
const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
// Topic ARNs
const SNS_TOPICS = {
    'vendor-notifications': process.env.SNS_VENDOR_NOTIFICATIONS_ARN || '',
    'customer-notifications': process.env.SNS_CUSTOMER_NOTIFICATIONS_ARN || '',
    'platform-notifications': process.env.SNS_PLATFORM_NOTIFICATIONS_ARN || '',
    'booking-events': process.env.SNS_BOOKING_EVENTS_ARN || '',
    'payment-events': process.env.SNS_PAYMENT_EVENTS_ARN || '',
};
// Queue URLs
const SQS_QUEUES = {
    'notification-queue': process.env.SQS_NOTIFICATION_QUEUE_URL || '',
    'booking-queue': process.env.SQS_BOOKING_QUEUE_URL || '',
    'payment-queue': process.env.SQS_PAYMENT_QUEUE_URL || '',
    'settlement-queue': process.env.SQS_SETTLEMENT_QUEUE_URL || '',
    'search-index-queue': process.env.SQS_SEARCH_INDEX_QUEUE_URL || '',
};
// S3 Buckets
const S3_BUCKETS = {
    'documents': process.env.S3_DOCUMENTS_BUCKET || 'warmpawz-documents',
    'uploads': process.env.S3_UPLOADS_BUCKET || 'warmpawz-uploads',
    'media': process.env.S3_MEDIA_BUCKET || 'warmpawz-media',
};
// ============================================================================
// CLIENTS
// ============================================================================
const snsClient = new client_sns_1.SNSClient({ region: AWS_REGION });
const sqsClient = new client_sqs_1.SQSClient({ region: AWS_REGION });
const s3Client = new client_s3_1.S3Client({ region: AWS_REGION });
// ============================================================================
// SNS FUNCTIONS
// ============================================================================
async function publishToSNS(topicName, message, attributes) {
    const topicArn = SNS_TOPICS[topicName];
    if (!topicArn) {
        console.warn(`SNS topic not configured: ${topicName}`);
        // In development, log instead of failing
        console.log(`[SNS Mock] Publishing to ${topicName}:`, message);
        return { messageId: `mock-${Date.now()}` };
    }
    try {
        const command = new client_sns_1.PublishCommand({
            TopicArn: topicArn,
            Message: JSON.stringify(message),
            MessageAttributes: attributes ? Object.entries(attributes).reduce((acc, [key, value]) => {
                acc[key] = { DataType: 'String', StringValue: String(value) };
                return acc;
            }, {}) : undefined,
        });
        const response = await snsClient.send(command);
        console.log(`SNS message published to ${topicName}: ${response.MessageId}`);
        return { messageId: response.MessageId || '' };
    }
    catch (error) {
        console.error(`Error publishing to SNS ${topicName}:`, error);
        throw error;
    }
}
async function publishNotification(targetType, targetId, notification) {
    const topic = targetType === 'vendor'
        ? 'vendor-notifications'
        : targetType === 'customer'
            ? 'customer-notifications'
            : 'platform-notifications';
    await publishToSNS(topic, {
        target_type: targetType,
        target_id: targetId,
        ...notification,
        timestamp: new Date().toISOString(),
    });
}
// ============================================================================
// SQS FUNCTIONS
// ============================================================================
async function sendToSQS(queueName, message, options) {
    const queueUrl = SQS_QUEUES[queueName];
    if (!queueUrl) {
        console.warn(`SQS queue not configured: ${queueName}`);
        // In development, log instead of failing
        console.log(`[SQS Mock] Sending to ${queueName}:`, message);
        return { messageId: `mock-${Date.now()}` };
    }
    try {
        const command = new client_sqs_1.SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify(message),
            DelaySeconds: options?.delaySeconds,
            MessageGroupId: options?.messageGroupId,
            MessageDeduplicationId: options?.deduplicationId,
        });
        const response = await sqsClient.send(command);
        console.log(`SQS message sent to ${queueName}: ${response.MessageId}`);
        return { messageId: response.MessageId || '' };
    }
    catch (error) {
        console.error(`Error sending to SQS ${queueName}:`, error);
        throw error;
    }
}
async function queueBookingEvent(event, bookingId, data) {
    await sendToSQS('booking-queue', {
        event,
        booking_id: bookingId,
        ...data,
        timestamp: new Date().toISOString(),
    });
}
async function queuePaymentEvent(event, paymentId, data) {
    await sendToSQS('payment-queue', {
        event,
        payment_id: paymentId,
        ...data,
        timestamp: new Date().toISOString(),
    });
}
async function queueSettlement(vendorId, amount, bookingIds) {
    await sendToSQS('settlement-queue', {
        vendor_id: vendorId,
        amount,
        booking_ids: bookingIds,
        scheduled_at: new Date().toISOString(),
    });
}
async function queueSearchIndexUpdate(entity, action, entityId, data) {
    await sendToSQS('search-index-queue', {
        entity,
        action,
        entity_id: entityId,
        data,
        timestamp: new Date().toISOString(),
    });
}
// ============================================================================
// S3 FUNCTIONS
// ============================================================================
async function uploadToS3(bucketName, key, body, contentType) {
    const bucket = S3_BUCKETS[bucketName];
    try {
        const command = new client_s3_1.PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
        });
        await s3Client.send(command);
        const url = `https://${bucket}.s3.${AWS_REGION}.amazonaws.com/${key}`;
        console.log(`File uploaded to S3: ${url}`);
        return { url };
    }
    catch (error) {
        console.error(`Error uploading to S3 ${bucket}:`, error);
        throw error;
    }
}
async function getFromS3(bucketName, key) {
    const bucket = S3_BUCKETS[bucketName];
    try {
        const command = new client_s3_1.GetObjectCommand({
            Bucket: bucket,
            Key: key,
        });
        const response = await s3Client.send(command);
        const body = await response.Body?.transformToByteArray();
        return Buffer.from(body || []);
    }
    catch (error) {
        console.error(`Error getting from S3 ${bucket}/${key}:`, error);
        throw error;
    }
}
function generateS3Key(type, entityId, filename) {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${type}/${entityId}/${timestamp}-${sanitizedFilename}`;
}
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function getTopicArn(topicName) {
    return SNS_TOPICS[topicName];
}
function getQueueUrl(queueName) {
    return SQS_QUEUES[queueName];
}
function getBucketName(bucketType) {
    return S3_BUCKETS[bucketType];
}
//# sourceMappingURL=aws-clients.js.map