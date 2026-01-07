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

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const snsClient = new SNSClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

// Expose client for callers that need direct access
export function getSnsClient(): SNSClient {
  return snsClient;
}

export interface TopicConfig {
  bookingCreatedTopic?: string;
  bookingStatusUpdatedTopic?: string;
  paymentCreatedTopic?: string;
  paymentProcessedTopic?: string;
  vendorApprovedTopic?: string;
  notificationTopic?: string;
  settlementTopic?: string;
}

const TOPIC_ARNS: TopicConfig = {
  bookingCreatedTopic: process.env.BOOKING_CREATED_TOPIC_ARN,
  bookingStatusUpdatedTopic: process.env.BOOKING_STATUS_UPDATED_TOPIC_ARN,
  paymentCreatedTopic: process.env.PAYMENT_CREATED_TOPIC_ARN,
  paymentProcessedTopic: process.env.PAYMENT_PROCESSED_TOPIC_ARN,
  vendorApprovedTopic: process.env.VENDOR_APPROVED_TOPIC_ARN,
  notificationTopic: process.env.NOTIFICATION_TOPIC_ARN,
  settlementTopic: process.env.SETTLEMENT_TOPIC_ARN,
};

// ============================================================================
// STANDARD EVENT ENVELOPE
// ============================================================================

interface EventEnvelope<T> {
  eventId: string;
  eventType: string;
  eventTimestamp: string;
  eventSource: string;
  eventVersion: string;
  correlationId?: string;
  data: T;
}

/**
 * Create a standardized event envelope with temporal metadata
 */
function createEventEnvelope<T>(
  eventType: string,
  data: T,
  correlationId?: string
): EventEnvelope<T> {
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

// ============================================================================
// BOOKING EVENTS
// ============================================================================

export interface BookingCreatedEvent {
  bookingId: string;
  customerId: string;
  vendorId: string;
  serviceId?: string;
  serviceType: string;
  status: string;
  bookingDate?: string;
  bookingTime?: string;
  amount?: number;
}

/**
 * Publish booking created event with temporal metadata
 */
export async function publishBookingCreated(
  message: BookingCreatedEvent & { eventTimestamp?: string; eventId?: string; requestId?: string }
): Promise<void> {
  if (!TOPIC_ARNS.bookingCreatedTopic) {
    console.warn('Booking created topic ARN not configured');
    return;
  }

  const envelope = createEventEnvelope('BOOKING_CREATED', message, message.requestId);

  await snsClient.send(
    new PublishCommand({
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
    })
  );
}

export interface BookingStatusUpdatedEvent {
  bookingId: string;
  customerId: string;
  vendorId: string;
  oldStatus: string;
  newStatus: string;
  reason?: string;
}

/**
 * Publish booking status updated event with temporal metadata
 */
export async function publishBookingStatusUpdated(
  message: BookingStatusUpdatedEvent & { eventTimestamp?: string; eventId?: string; requestId?: string }
): Promise<void> {
  const topicArn = TOPIC_ARNS.bookingStatusUpdatedTopic || TOPIC_ARNS.notificationTopic;
  
  if (!topicArn) {
    console.warn('Booking status updated topic ARN not configured');
    return;
  }

  const envelope = createEventEnvelope('BOOKING_STATUS_UPDATED', message, message.requestId);

  await snsClient.send(
    new PublishCommand({
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
    })
  );
}

// ============================================================================
// PAYMENT EVENTS
// ============================================================================

export interface PaymentCreatedEvent {
  paymentId: string;
  bookingId: string;
  customerId: string;
  vendorId?: string;
  amount: number;
  currency: string;
  status: string;
}

/**
 * Publish payment created event with temporal metadata
 */
export async function publishPaymentCreated(
  message: PaymentCreatedEvent & { eventTimestamp?: string; eventId?: string; requestId?: string }
): Promise<void> {
  const topicArn = TOPIC_ARNS.paymentCreatedTopic || TOPIC_ARNS.paymentProcessedTopic;
  
  if (!topicArn) {
    console.warn('Payment created topic ARN not configured');
    return;
  }

  const envelope = createEventEnvelope('PAYMENT_CREATED', message, message.requestId);

  await snsClient.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(envelope),
      Subject: 'Payment Created',
      MessageAttributes: {
        eventType: { DataType: 'String', StringValue: 'PAYMENT_CREATED' },
        eventId: { DataType: 'String', StringValue: envelope.eventId },
        paymentId: { DataType: 'String', StringValue: message.paymentId },
        bookingId: { DataType: 'String', StringValue: message.bookingId },
      },
    })
  );
}

export interface PaymentProcessedEvent {
  paymentId: string;
  bookingId?: string;
  customerId?: string;
  vendorId?: string;
  amount: number;
  status: string;
  razorpayPaymentId?: string;
}

/**
 * Publish payment processed event with temporal metadata
 */
export async function publishPaymentProcessed(
  message: PaymentProcessedEvent & { eventTimestamp?: string; eventId?: string; requestId?: string }
): Promise<void> {
  if (!TOPIC_ARNS.paymentProcessedTopic) {
    console.warn('Payment processed topic ARN not configured');
    return;
  }

  const envelope = createEventEnvelope('PAYMENT_PROCESSED', message, message.requestId);

  await snsClient.send(
    new PublishCommand({
      TopicArn: TOPIC_ARNS.paymentProcessedTopic,
      Message: JSON.stringify(envelope),
      Subject: 'Payment Processed',
      MessageAttributes: {
        eventType: { DataType: 'String', StringValue: 'PAYMENT_PROCESSED' },
        eventId: { DataType: 'String', StringValue: envelope.eventId },
        paymentId: { DataType: 'String', StringValue: message.paymentId },
        status: { DataType: 'String', StringValue: message.status },
      },
    })
  );
}

// ============================================================================
// VENDOR EVENTS
// ============================================================================

export interface VendorApprovedEvent {
  vendorId: string;
  businessName?: string;
  ownerName?: string;
  email?: string;
  phone?: string;
  roleId?: string;
  approvedAt?: string;
  approvedBy?: string;
}

/**
 * Publish vendor approved event with temporal metadata
 */
export async function publishVendorApproved(
  message: VendorApprovedEvent & { eventTimestamp?: string; eventId?: string; requestId?: string }
): Promise<void> {
  if (!TOPIC_ARNS.vendorApprovedTopic) {
    console.warn('Vendor approved topic ARN not configured');
    return;
  }

  const envelope = createEventEnvelope('VENDOR_APPROVED', message, message.requestId);

  await snsClient.send(
    new PublishCommand({
      TopicArn: TOPIC_ARNS.vendorApprovedTopic,
      Message: JSON.stringify(envelope),
      Subject: 'Vendor Approved',
      MessageAttributes: {
        eventType: { DataType: 'String', StringValue: 'VENDOR_APPROVED' },
        eventId: { DataType: 'String', StringValue: envelope.eventId },
        vendorId: { DataType: 'String', StringValue: message.vendorId },
      },
    })
  );
}

// ============================================================================
// SETTLEMENT EVENTS
// ============================================================================

export interface SettlementCreatedEvent {
  settlementId: string;
  vendorId: string;
  amount: number;
  commissionAmount: number;
  netAmount: number;
  bookingCount: number;
}

/**
 * Publish settlement created event with temporal metadata
 */
export async function publishSettlementCreated(
  message: SettlementCreatedEvent & { eventTimestamp?: string; eventId?: string; requestId?: string }
): Promise<void> {
  const topicArn = TOPIC_ARNS.settlementTopic || TOPIC_ARNS.notificationTopic;
  
  if (!topicArn) {
    console.warn('Settlement topic ARN not configured');
    return;
  }

  const envelope = createEventEnvelope('SETTLEMENT_CREATED', message, message.requestId);

  await snsClient.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(envelope),
      Subject: 'Settlement Created',
      MessageAttributes: {
        eventType: { DataType: 'String', StringValue: 'SETTLEMENT_CREATED' },
        eventId: { DataType: 'String', StringValue: envelope.eventId },
        settlementId: { DataType: 'String', StringValue: message.settlementId },
        vendorId: { DataType: 'String', StringValue: message.vendorId },
      },
    })
  );
}

// ============================================================================
// NOTIFICATION EVENTS
// ============================================================================

export interface NotificationEvent {
  recipientType: 'customer' | 'vendor' | 'admin';
  recipientId: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, any>;
}

/**
 * Publish notification event with temporal metadata
 */
export async function publishNotification(
  message: NotificationEvent & { eventTimestamp?: string; eventId?: string; requestId?: string }
): Promise<void> {
  if (!TOPIC_ARNS.notificationTopic) {
    console.warn('Notification topic ARN not configured');
    return;
  }

  const envelope = createEventEnvelope('NOTIFICATION', message, message.requestId);

  await snsClient.send(
    new PublishCommand({
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
    })
  );
}
