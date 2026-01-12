/**
 * ============================================================================
 * EMAIL QUEUE PROCESSOR
 * ============================================================================
 * 
 * Lambda function that processes emails from SQS queue
 * Triggered by: SQS event source mapping from email queue
 * 
 * Handles:
 * - Transactional emails (booking confirmations, receipts)
 * - Marketing emails
 * - Email delivery tracking
 * 
 * Date: 2026-01-28
 * ============================================================================
 */

import { SQSEvent, Context } from 'aws-lambda';
import { insert, query } from '../database/rds-connection';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

interface EmailMessage {
  to: string | string[];
  subject: string;
  htmlBody?: string;
  textBody?: string;
  templateId?: string;
  templateData?: Record<string, any>;
  from?: string;
  replyTo?: string;
  tags?: Record<string, string>;
  bookingId?: string;
  customerId?: string;
}

export async function handler(event: SQSEvent, context: Context) {
  console.log('Email processor triggered', { recordCount: event.Records.length });

  const results = [];

  for (const record of event.Records) {
    try {
      // Parse SNS message if it came from SNS → SQS
      let messageBody = record.body;
      if (record.body.startsWith('{') && JSON.parse(record.body).Message) {
        const snsMessage = JSON.parse(record.body);
        messageBody = snsMessage.Message;
      }

      const email: EmailMessage = JSON.parse(messageBody);
      console.log('Processing email:', { to: email.to, subject: email.subject });

      await processEmail(email);

      results.push({ messageId: record.messageId, status: 'success' });
    } catch (error: any) {
      console.error('Error processing email:', record.body, error);
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

async function processEmail(email: EmailMessage) {
  const recipients = Array.isArray(email.to) ? email.to : [email.to];
  const fromEmail = email.from || process.env.SES_FROM_EMAIL || 'noreply@warmpawz.com';

  // Store email in database for tracking
  for (const recipient of recipients) {
    await insert('email_logs', {
      recipient_email: recipient,
      subject: email.subject,
      html_body: email.htmlBody || null,
      text_body: email.textBody || null,
      template_id: email.templateId || null,
      template_data: email.templateData ? JSON.stringify(email.templateData) : null,
      from_email: fromEmail,
      reply_to: email.replyTo || null,
      booking_id: email.bookingId || null,
      customer_id: email.customerId || null,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
  }

  // Send email via SES
  try {
    const command = new SendEmailCommand({
      Source: fromEmail,
      Destination: {
        ToAddresses: recipients,
      },
      Message: {
        Subject: {
          Data: email.subject,
          Charset: 'UTF-8',
        },
        Body: {
          ...(email.htmlBody && {
            Html: {
              Data: email.htmlBody,
              Charset: 'UTF-8',
            },
          }),
          ...(email.textBody && {
            Text: {
              Data: email.textBody,
              Charset: 'UTF-8',
            },
          }),
        },
      },
      ...(email.replyTo && { ReplyToAddresses: [email.replyTo] }),
      ...(email.tags && {
        Tags: Object.entries(email.tags).map(([key, value]) => ({
          Name: key,
          Value: value,
        })),
      }),
    });

    const response = await sesClient.send(command);
    console.log('Email sent successfully:', response.MessageId);

    // Update email log status
    for (const recipient of recipients) {
      await query(
        `UPDATE email_logs 
         SET status = 'sent', ses_message_id = $1, sent_at = NOW() 
         WHERE recipient_email = $2 AND subject = $3 
         AND created_at > NOW() - INTERVAL '1 minute'
         ORDER BY created_at DESC LIMIT 1`,
        [response.MessageId, recipient, email.subject]
      );
    }
  } catch (error: any) {
    console.error('Error sending email:', error);
    
    // Update email log status
    for (const recipient of recipients) {
      await query(
        `UPDATE email_logs 
         SET status = 'failed', error_message = $1, failed_at = NOW() 
         WHERE recipient_email = $2 AND subject = $3 
         AND created_at > NOW() - INTERVAL '1 minute'
         ORDER BY created_at DESC LIMIT 1`,
        [error.message, recipient, email.subject]
      );
    }
    
    throw error; // Re-throw to trigger DLQ
  }
}
