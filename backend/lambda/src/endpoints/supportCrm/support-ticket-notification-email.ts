/**
 * Send support ticket emails via SES (non-blocking; never throws to callers).
 */

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { insert } from '../../database/rds-connection';

const sesClient = new SESClient({ region: process.env.AWS_REGION || 'ap-south-1' });

export type SupportTicketEmailPayload = {
  to: string[];
  cc?: string[];
  subject: string;
  htmlBody: string;
  textBody: string;
  tags?: Record<string, string>;
};

export async function sendSupportTicketEmail(payload: SupportTicketEmailPayload): Promise<boolean> {
  const to = payload.to.map((e) => e.trim()).filter(Boolean);
  if (!to.length) return false;

  const fromEmail = process.env.SES_FROM_EMAIL || 'noreply@warmpawz.com';
  const cc = (payload.cc || []).map((e) => e.trim()).filter(Boolean);

  try {
    for (const recipient of to) {
      await insert('email_logs', {
        recipient_email: recipient,
        subject: payload.subject,
        html_body: payload.htmlBody,
        text_body: payload.textBody,
        from_email: fromEmail,
        status: 'pending',
        created_at: new Date().toISOString(),
      }).catch(() => undefined);
    }

    const command = new SendEmailCommand({
      Source: fromEmail,
      Destination: {
        ToAddresses: to,
        CcAddresses: cc.length ? cc : undefined,
      },
      Message: {
        Subject: { Data: payload.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: payload.htmlBody, Charset: 'UTF-8' },
          Text: { Data: payload.textBody, Charset: 'UTF-8' },
        },
      },
      ...(payload.tags && {
        Tags: Object.entries(payload.tags).map(([Name, Value]) => ({ Name, Value })),
      }),
    });

    await sesClient.send(command);
    return true;
  } catch (err) {
    console.warn('[support-notify-email] send failed:', err);
    return false;
  }
}
