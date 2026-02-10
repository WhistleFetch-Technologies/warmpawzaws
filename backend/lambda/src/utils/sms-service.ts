/**
 * SMS Service (SNS + DLT)
 *
 * Uses AWS SNS for SMS delivery and includes India DLT attributes when configured.
 * Falls back to environment variables or platform_settings (admin:settings:aws.sns).
 */

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { query } from '../database/rds-connection';

export interface SMSOptions {
  to: string;
  message: string;
  type?: 'otp' | 'transactional' | 'promotional';
  templateId?: string;
  entityId?: string;
  senderId?: string;
}

type SmsAttributes = Record<string, { DataType: 'String'; StringValue: string }>;

function normalizePhone(phone: string): string {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  if (raw.startsWith('+')) return raw;
  return digits ? `+${digits}` : raw;
}

async function loadSnsSettings(): Promise<{ senderId?: string; entityId?: string; templateId?: string } | null> {
  const envSender = process.env.SMS_SENDER_ID || process.env.SNS_SMS_SENDER_ID || '';
  const envEntity = process.env.SMS_ENTITY_ID || process.env.SNS_SMS_ENTITY_ID || '';
  const envTemplate = process.env.SMS_TEMPLATE_ID || process.env.SNS_SMS_TEMPLATE_ID || '';
  if (envSender || envEntity || envTemplate) {
    return {
      senderId: envSender || undefined,
      entityId: envEntity || undefined,
      templateId: envTemplate || undefined,
    };
  }

  try {
    const rows = await query(
      `SELECT setting_value FROM platform_settings WHERE setting_key = 'admin:settings:aws' LIMIT 1`
    );
    const setting = rows.rows?.[0]?.setting_value || null;
    const sns = setting?.sns || {};
    return {
      senderId: sns?.smsOriginationNumber || undefined,
      entityId: sns?.entityId || undefined,
      templateId: sns?.templateId || undefined,
    };
  } catch {
    return null;
  }
}

async function buildSmsAttributes(
  type: SMSOptions['type'],
  overrides?: Pick<SMSOptions, 'templateId' | 'entityId' | 'senderId'>
): Promise<SmsAttributes> {
  const attrs: SmsAttributes = {
    'AWS.SNS.SMS.SMSType': {
      DataType: 'String',
      StringValue: type === 'promotional' ? 'Promotional' : 'Transactional',
    },
  };

  const settings = await loadSnsSettings();
  const senderId = overrides?.senderId || settings?.senderId;
  if (senderId) {
    attrs['AWS.SNS.SMS.SenderID'] = { DataType: 'String', StringValue: senderId };
  }
  const entityId = overrides?.entityId || settings?.entityId;
  if (entityId) {
    attrs['AWS.SNS.SMS.EntityId'] = { DataType: 'String', StringValue: entityId };
  }
  const templateId = overrides?.templateId || settings?.templateId;
  if (templateId) {
    attrs['AWS.SNS.SMS.TemplateId'] = { DataType: 'String', StringValue: templateId };
  }

  return attrs;
}

/**
 * Send SMS via SNS (with DLT attributes if configured)
 */
export async function sendSMS(options: SMSOptions): Promise<{ success: boolean; messageId?: string }> {
  const { to, message, type = 'transactional', templateId, entityId, senderId } = options;
  const phone = normalizePhone(to);
  const attrs = await buildSmsAttributes(type, { templateId, entityId, senderId });

  try {
    const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'ap-south-1' });
    const result = await snsClient.send(
      new PublishCommand({
        PhoneNumber: phone,
        Message: message,
        MessageAttributes: attrs,
      })
    );
    return { success: true, messageId: result?.MessageId };
  } catch (err: any) {
    console.error('[SMS] SNS send failed:', err?.message || err);
    return { success: false };
  }
}

/**
 * Send OTP SMS
 */
export async function sendOTP(phone: string, otp: string): Promise<{ success: boolean }> {
  const templateId = process.env.SMS_OTP_TEMPLATE_ID;
  return sendSMS({
    to: phone,
    message: `Your Warmpawz verification OTP is ${otp}. Valid for 10 minutes.`,
    type: 'otp',
    ...(templateId ? { templateId } : {}),
  });
}

export default { sendSMS, sendOTP };
