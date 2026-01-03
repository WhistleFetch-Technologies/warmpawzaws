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

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

// ============================================================================
// CONFIGURATION
// ============================================================================

const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';

// Topic ARNs
const SNS_TOPICS: Record<string, string> = {
  'vendor-notifications': process.env.SNS_VENDOR_NOTIFICATIONS_ARN || '',
  'customer-notifications': process.env.SNS_CUSTOMER_NOTIFICATIONS_ARN || '',
  'platform-notifications': process.env.SNS_PLATFORM_NOTIFICATIONS_ARN || '',
  'booking-events': process.env.SNS_BOOKING_EVENTS_ARN || '',
  'payment-events': process.env.SNS_PAYMENT_EVENTS_ARN || '',
};

// Queue URLs
const SQS_QUEUES: Record<string, string> = {
  'notification-queue': process.env.SQS_NOTIFICATION_QUEUE_URL || '',
  'booking-queue': process.env.SQS_BOOKING_QUEUE_URL || '',
  'payment-queue': process.env.SQS_PAYMENT_QUEUE_URL || '',
  'settlement-queue': process.env.SQS_SETTLEMENT_QUEUE_URL || '',
  'search-index-queue': process.env.SQS_SEARCH_INDEX_QUEUE_URL || '',
};

// S3 Buckets
const S3_BUCKETS: Record<string, string> = {
  'documents': process.env.S3_DOCUMENTS_BUCKET || 'warmpawz-documents',
  'uploads': process.env.S3_UPLOADS_BUCKET || 'warmpawz-uploads',
  'media': process.env.S3_MEDIA_BUCKET || 'warmpawz-media',
};

// ============================================================================
// CLIENTS
// ============================================================================

const snsClient = new SNSClient({ region: AWS_REGION });
const sqsClient = new SQSClient({ region: AWS_REGION });
const s3Client = new S3Client({ region: AWS_REGION });

// ============================================================================
// SNS FUNCTIONS
// ============================================================================

export async function publishToSNS(
  topicName: string,
  message: Record<string, any>,
  attributes?: Record<string, any>
): Promise<{ messageId: string }> {
  const topicArn = SNS_TOPICS[topicName];
  
  if (!topicArn) {
    console.warn(`SNS topic not configured: ${topicName}`);
    // In development, log instead of failing
    console.log(`[SNS Mock] Publishing to ${topicName}:`, message);
    return { messageId: `mock-${Date.now()}` };
  }

  try {
    const command = new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(message),
      MessageAttributes: attributes ? Object.entries(attributes).reduce((acc, [key, value]) => {
        acc[key] = { DataType: 'String', StringValue: String(value) };
        return acc;
      }, {} as Record<string, any>) : undefined,
    });

    const response = await snsClient.send(command);
    console.log(`SNS message published to ${topicName}: ${response.MessageId}`);
    
    return { messageId: response.MessageId || '' };
  } catch (error) {
    console.error(`Error publishing to SNS ${topicName}:`, error);
    throw error;
  }
}

export async function publishNotification(
  targetType: 'vendor' | 'customer' | 'admin',
  targetId: string,
  notification: {
    title: string;
    body: string;
    data?: Record<string, any>;
    type: string;
  }
): Promise<void> {
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

export async function sendToSQS(
  queueName: string,
  message: Record<string, any>,
  options?: {
    delaySeconds?: number;
    messageGroupId?: string;
    deduplicationId?: string;
  }
): Promise<{ messageId: string }> {
  const queueUrl = SQS_QUEUES[queueName];
  
  if (!queueUrl) {
    console.warn(`SQS queue not configured: ${queueName}`);
    // In development, log instead of failing
    console.log(`[SQS Mock] Sending to ${queueName}:`, message);
    return { messageId: `mock-${Date.now()}` };
  }

  try {
    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message),
      DelaySeconds: options?.delaySeconds,
      MessageGroupId: options?.messageGroupId,
      MessageDeduplicationId: options?.deduplicationId,
    });

    const response = await sqsClient.send(command);
    console.log(`SQS message sent to ${queueName}: ${response.MessageId}`);
    
    return { messageId: response.MessageId || '' };
  } catch (error) {
    console.error(`Error sending to SQS ${queueName}:`, error);
    throw error;
  }
}

export async function queueBookingEvent(
  event: 'created' | 'confirmed' | 'cancelled' | 'completed',
  bookingId: string,
  data: Record<string, any>
): Promise<void> {
  await sendToSQS('booking-queue', {
    event,
    booking_id: bookingId,
    ...data,
    timestamp: new Date().toISOString(),
  });
}

export async function queuePaymentEvent(
  event: 'initiated' | 'completed' | 'failed' | 'refunded',
  paymentId: string,
  data: Record<string, any>
): Promise<void> {
  await sendToSQS('payment-queue', {
    event,
    payment_id: paymentId,
    ...data,
    timestamp: new Date().toISOString(),
  });
}

export async function queueSettlement(
  vendorId: string,
  amount: number,
  bookingIds: string[]
): Promise<void> {
  await sendToSQS('settlement-queue', {
    vendor_id: vendorId,
    amount,
    booking_ids: bookingIds,
    scheduled_at: new Date().toISOString(),
  });
}

export async function queueSearchIndexUpdate(
  entity: 'service' | 'vendor' | 'staff' | 'product',
  action: 'create' | 'update' | 'delete',
  entityId: string,
  data?: Record<string, any>
): Promise<void> {
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

export async function uploadToS3(
  bucketName: keyof typeof S3_BUCKETS,
  key: string,
  body: Buffer | string,
  contentType: string
): Promise<{ url: string }> {
  const bucket = S3_BUCKETS[bucketName];
  
  try {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await s3Client.send(command);
    
    const url = `https://${bucket}.s3.${AWS_REGION}.amazonaws.com/${key}`;
    console.log(`File uploaded to S3: ${url}`);
    
    return { url };
  } catch (error) {
    console.error(`Error uploading to S3 ${bucket}:`, error);
    throw error;
  }
}

export async function getFromS3(
  bucketName: keyof typeof S3_BUCKETS,
  key: string
): Promise<Buffer> {
  const bucket = S3_BUCKETS[bucketName];
  
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await s3Client.send(command);
    const body = await response.Body?.transformToByteArray();
    
    return Buffer.from(body || []);
  } catch (error) {
    console.error(`Error getting from S3 ${bucket}/${key}:`, error);
    throw error;
  }
}

export function generateS3Key(
  type: 'document' | 'profile' | 'service' | 'product',
  entityId: string,
  filename: string
): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${type}/${entityId}/${timestamp}-${sanitizedFilename}`;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getTopicArn(topicName: string): string | undefined {
  return SNS_TOPICS[topicName];
}

export function getQueueUrl(queueName: string): string | undefined {
  return SQS_QUEUES[queueName];
}

export function getBucketName(bucketType: keyof typeof S3_BUCKETS): string {
  return S3_BUCKETS[bucketType];
}

