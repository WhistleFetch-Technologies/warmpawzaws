/**
 * ============================================================================
 * SMS QUEUE PROCESSOR
 * ============================================================================
 * 
 * Lambda function that processes SMS from SQS queue
 * Triggered by: SQS event source mapping from SMS queue
 * 
 * Handles:
 * - Transactional SMS (OTP, booking confirmations)
 * - SMS delivery tracking
 * - Multi-provider support (AWS SNS)
 * 
 * Date: 2026-01-28
 * ============================================================================
 */

import { SQSEvent, Context } from 'aws-lambda';
import { insert, query } from '../database/rds-connection';
import { getSnsClient } from '../utils/sns-client';
import { PublishCommand } from '@aws-sdk/client-sns';

interface SMSMessage {
  to: string;
  message: string;
  templateId?: string;
  templateData?: Record<string, any>;
  senderId?: string;
  priority?: 'low' | 'normal' | 'high';
  bookingId?: string;
  customerId?: string;
  eventType?: string;
}

export async function handler(event: SQSEvent, context: Context) {
  console.log('SMS processor triggered', { recordCount: event.Records.length });

  const results = [];

  for (const record of event.Records) {
    try {
      // Parse SNS message if it came from SNS → SQS
      let messageBody = record.body;
      if (record.body.startsWith('{') && JSON.parse(record.body).Message) {
        const snsMessage = JSON.parse(record.body);
        messageBody = snsMessage.Message;
      }

      const sms: SMSMessage = JSON.parse(messageBody);
      console.log('Processing SMS:', { to: sms.to, eventType: sms.eventType });

      await processSMS(sms);

      results.push({ messageId: record.messageId, status: 'success' });
    } catch (error: any) {
      console.error('Error processing SMS:', record.body, error);
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

async function processSMS(sms: SMSMessage) {
  // Store SMS in database for tracking
  await insert('sms_logs', {
    recipient_phone: sms.to,
    message: sms.message,
    template_id: sms.templateId || null,
    template_data: sms.templateData ? JSON.stringify(sms.templateData) : null,
    sender_id: sms.senderId || 'WARMPAWZ',
    priority: sms.priority || 'normal',
    booking_id: sms.bookingId || null,
    customer_id: sms.customerId || null,
    event_type: sms.eventType || null,
    status: 'pending',
    created_at: new Date().toISOString(),
  });

  // Send SMS via SNS
  try {
    const snsClient = getSnsClient();
    
    const command = new PublishCommand({
      PhoneNumber: sms.to,
      Message: sms.message,
      MessageAttributes: {
        'AWS.SNS.SMS.SenderID': {
          DataType: 'String',
          StringValue: sms.senderId || 'WARMPAWZ',
        },
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: sms.priority === 'high' ? 'Transactional' : 'Promotional',
        },
      },
    });

    const response = await snsClient.send(command);
    console.log('SMS sent successfully:', response.MessageId);

    // Update SMS log status
    await query(
      `UPDATE sms_logs 
       SET status = 'sent', sns_message_id = $1, sent_at = NOW() 
       WHERE recipient_phone = $2 AND message = $3 
       AND created_at > NOW() - INTERVAL '1 minute'
       ORDER BY created_at DESC LIMIT 1`,
      [response.MessageId, sms.to, sms.message]
    );
  } catch (error: any) {
    console.error('Error sending SMS:', error);
    
    // Update SMS log status
    await query(
      `UPDATE sms_logs 
       SET status = 'failed', error_message = $1, failed_at = NOW() 
       WHERE recipient_phone = $2 AND message = $3 
       AND created_at > NOW() - INTERVAL '1 minute'
       ORDER BY created_at DESC LIMIT 1`,
      [error.message, sms.to, sms.message]
    );
    
    throw error; // Re-throw to trigger DLQ
  }
}
