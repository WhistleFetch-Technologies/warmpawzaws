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

import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

export interface QueueConfig {
  notificationQueue?: string;
  emailQueue?: string;
  smsQueue?: string;
  analyticsQueue?: string;
  settlementQueue?: string;
}

const QUEUE_URLS: QueueConfig = {
  notificationQueue: process.env.NOTIFICATION_QUEUE_URL,
  emailQueue: process.env.EMAIL_QUEUE_URL,
  smsQueue: process.env.SMS_QUEUE_URL,
  analyticsQueue: process.env.ANALYTICS_QUEUE_URL,
  settlementQueue: process.env.SETTLEMENT_QUEUE_URL,
};

/**
 * Send message to notification queue
 */
export async function sendToNotificationQueue(message: any): Promise<void> {
  if (!QUEUE_URLS.notificationQueue) {
    console.warn('Notification queue URL not configured');
    return;
  }

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URLS.notificationQueue,
      MessageBody: JSON.stringify(message),
    })
  );
}

/**
 * Send message to email queue
 */
export async function sendToEmailQueue(message: any): Promise<void> {
  if (!QUEUE_URLS.emailQueue) {
    console.warn('Email queue URL not configured');
    return;
  }

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URLS.emailQueue,
      MessageBody: JSON.stringify(message),
    })
  );
}

/**
 * Send message to SMS queue
 */
export async function sendToSmsQueue(message: any): Promise<void> {
  if (!QUEUE_URLS.smsQueue) {
    console.warn('SMS queue URL not configured');
    return;
  }

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URLS.smsQueue,
      MessageBody: JSON.stringify(message),
    })
  );
}

/**
 * Send message to analytics queue
 */
export async function sendToAnalyticsQueue(message: any): Promise<void> {
  if (!QUEUE_URLS.analyticsQueue) {
    console.warn('Analytics queue URL not configured');
    return;
  }

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URLS.analyticsQueue,
      MessageBody: JSON.stringify(message),
    })
  );
}

/**
 * Send message to settlement queue
 */
export async function sendToSettlementQueue(message: any): Promise<void> {
  if (!QUEUE_URLS.settlementQueue) {
    console.warn('Settlement queue URL not configured');
    return;
  }

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URLS.settlementQueue,
      MessageBody: JSON.stringify(message),
    })
  );
}

