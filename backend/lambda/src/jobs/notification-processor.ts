/**
 * ============================================================================
 * NOTIFICATION QUEUE PROCESSOR
 * ============================================================================
 * 
 * Lambda function that processes notifications from SQS queue
 * Triggered by: SQS event source mapping from notification queue
 * 
 * Handles:
 * - Push notifications
 * - In-app notifications
 * - Notification delivery tracking
 * 
 * Date: 2026-01-28
 * ============================================================================
 */

import { SQSEvent, Context } from 'aws-lambda';
import { insert, query } from '../database/rds-connection';
import { getSnsClient } from '../utils/sns-client';
import { PublishCommand } from '@aws-sdk/client-sns';

interface NotificationMessage {
  type: 'push' | 'in_app' | 'email' | 'sms';
  phone?: string;
  message?: string;
  recipientId: string;
  recipientType: 'customer' | 'vendor' | 'admin';
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high';
  eventType?: string;
  bookingId?: string;
}

export async function handler(event: SQSEvent, context: Context) {
  console.log('Notification processor triggered', { recordCount: event.Records.length });

  const results = [];

  for (const record of event.Records) {
    try {
      // Parse SNS message if it came from SNS → SQS
      let messageBody = record.body;
      if (record.body.startsWith('{') && JSON.parse(record.body).Message) {
        const snsMessage = JSON.parse(record.body);
        messageBody = snsMessage.Message;
      }

      const notification: NotificationMessage = JSON.parse(messageBody);
      console.log('Processing notification:', notification);

      await processNotification(notification);

      results.push({ messageId: record.messageId, status: 'success' });
    } catch (error: any) {
      console.error('Error processing notification:', record.body, error);
      results.push({ 
        messageId: record.messageId, 
        status: 'failed', 
        error: error.message 
      });
      // Don't throw - continue processing other messages
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ 
      processed: results.length,
      results 
    }),
  };
}

async function processNotification(notification: NotificationMessage) {
  // SMS payloads from referral flow only contain phone + message.
  // Handle SMS delivery directly and avoid DB insert requirements for recipient fields.
  if (notification.type === 'sms') {
    await sendSmsNotification(notification);
    return;
  }

  if (!notification.recipientId || !notification.recipientType) {
    console.warn('Skipping non-SMS notification without recipient fields', notification);
    return;
  }

  // Store notification in database
  await insert('notifications', {
    recipient_id: notification.recipientId,
    recipient_type: notification.recipientType,
    notification_type: notification.eventType || notification.type || 'general',
    title: notification.title,
    message: notification.body || notification.message || '',
    data: notification.data || null,
    channels: { inApp: true, push: notification.type === 'push', email: false, sms: false },
    is_read: false,
  });

  // Send push notification if type is push
  if (notification.type === 'push') {
    await sendPushNotification(notification);
  }

  // Update notification status
  await query(
    `UPDATE notifications 
     SET status = 'delivered', delivered_at = NOW() 
     WHERE recipient_id = $1 AND recipient_type = $2 
     AND title = $3 AND created_at > NOW() - INTERVAL '1 minute'
     ORDER BY created_at DESC LIMIT 1`,
    [notification.recipientId, notification.recipientType, notification.title]
  );
}

async function sendSmsNotification(notification: NotificationMessage) {
  const phone = notification.phone;
  const text = notification.message || notification.body || '';
  if (!phone || !text) {
    console.warn('Skipping SMS notification due to missing phone or message', notification);
    return;
  }

  const snsClient = getSnsClient();
  await snsClient.send(
    new PublishCommand({
      PhoneNumber: phone,
      Message: text,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional',
        },
      },
    })
  );
  console.log(`SMS published to ${phone}`);
}

async function sendPushNotification(notification: NotificationMessage) {
  try {
    // Get device tokens for recipient
    const devices = await query(
      `SELECT device_token, platform FROM user_devices 
       WHERE user_id = $1 AND user_type = $2 AND is_active = true`,
      [notification.recipientId, notification.recipientType]
    );

    const deviceRows = Array.isArray(devices) ? devices : (devices as any).rows || [];

    if (deviceRows.length === 0) {
      console.log(`No active devices found for ${notification.recipientType} ${notification.recipientId}`);
      return;
    }

    // Send push notification via SNS (mobile push)
    const snsClient = getSnsClient();
    
    for (const device of deviceRows) {
      try {
        // Create platform endpoint and publish
        // For production, use SNS mobile push (requires platform application ARN)
        // For now, log the notification
        console.log(`Would send push to ${device.platform} device: ${device.device_token}`);
        
        // TODO: Implement actual SNS mobile push when platform applications are configured
        // await snsClient.send(new PublishCommand({...}));
      } catch (error) {
        console.error(`Failed to send push to device ${device.device_token}:`, error);
      }
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
    // Don't throw - notification is stored in DB
  }
}
