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

/** Jio DLT defaults when DB/env not set (India transactional SMS) */
const JIO_DLT_DEFAULTS = {
  senderId: 'WARMPZ',
  entityId: '1201176605406673276',
};

export interface LoadedSnsSettings {
  senderId?: string;
  entityId?: string;
  templateId?: string;
  /** When set, use these credentials for SNS (e.g. IAM user with SNS:Publish) instead of Lambda role */
  credentials?: { accessKeyId: string; secretAccessKey: string };
  region?: string;
}

async function loadSnsSettings(): Promise<LoadedSnsSettings> {
  const envSender = process.env.SMS_SENDER_ID || process.env.SNS_SMS_SENDER_ID || '';
  const envEntity = process.env.SMS_ENTITY_ID || process.env.SNS_SMS_ENTITY_ID || '';
  const envTemplate = process.env.SMS_TEMPLATE_ID || process.env.SNS_SMS_TEMPLATE_ID || '';
  if (envSender || envEntity || envTemplate) {
    return {
      senderId: envSender || JIO_DLT_DEFAULTS.senderId,
      entityId: envEntity || JIO_DLT_DEFAULTS.entityId,
      templateId: envTemplate || undefined,
    };
  }

  try {
    const rows = await query(
      `SELECT setting_value FROM platform_settings WHERE setting_key = 'admin:settings:aws' LIMIT 1`
    );
    const raw = rows.rows?.[0]?.setting_value;
    const setting =
      raw == null
        ? null
        : typeof raw === 'string'
          ? (() => {
              try {
                return JSON.parse(raw) as Record<string, unknown>;
              } catch {
                return null;
              }
            })()
          : (raw as Record<string, unknown>);
    const sns = (setting?.sns || {}) as Record<string, unknown>;
    const creds = (setting?.credentials || {}) as Record<string, unknown>;
    const senderId = (sns?.smsOriginationNumber as string) || JIO_DLT_DEFAULTS.senderId;
    const entityId = (sns?.entityId as string) || JIO_DLT_DEFAULTS.entityId;
    const templateId = sns?.templateId as string | undefined;
    const region = (sns?.region as string) || process.env.AWS_REGION || 'ap-south-1';
    const accessKeyId = creds?.accessKeyId as string | undefined;
    const secretAccessKey = creds?.secretAccessKey as string | undefined;
    const credentials =
      sns?.enabled && accessKeyId && secretAccessKey
        ? { accessKeyId, secretAccessKey }
        : undefined;
    if (credentials) {
      console.log('[SMS] Using DB credentials for SNS (Option A)');
    } else {
      console.log('[SMS] No DB credentials; using Lambda role for SNS');
    }
    return { senderId, entityId, templateId, credentials, region };
  } catch (e) {
    console.warn('[SMS] loadSnsSettings failed:', (e as Error)?.message);
  }
  return {
    senderId: JIO_DLT_DEFAULTS.senderId,
    entityId: JIO_DLT_DEFAULTS.entityId,
    templateId: undefined,
  };
}

function buildSmsAttributesFromSettings(
  type: SMSOptions['type'],
  settings: LoadedSnsSettings,
  overrides?: Pick<SMSOptions, 'templateId' | 'entityId' | 'senderId'>
): SmsAttributes {
  const attrs: SmsAttributes = {
    'AWS.SNS.SMS.SMSType': {
      DataType: 'String',
      StringValue: type === 'promotional' ? 'Promotional' : 'Transactional',
    },
  };
  const senderId = overrides?.senderId ?? settings.senderId;
  const entityId = overrides?.entityId ?? settings.entityId;
  const templateId = overrides?.templateId ?? settings.templateId;
  if (senderId) {
    attrs['AWS.SNS.SMS.SenderID'] = { DataType: 'String', StringValue: String(senderId).trim() };
  }
  // India DLT: use AWS.MM.SMS.* for EntityId/TemplateId (AWS.SNS.SMS.* is reserved for SMSType/SenderID)
  if (entityId) {
    attrs['AWS.MM.SMS.EntityId'] = { DataType: 'String', StringValue: entityId };
  }
  if (templateId) {
    attrs['AWS.MM.SMS.TemplateId'] = { DataType: 'String', StringValue: templateId };
  }
  return attrs;
}

/**
 * Send SMS via SNS (with DLT attributes if configured).
 * Uses credentials from platform_settings (admin:settings:aws) when sns.enabled and credentials are set;
 * otherwise uses Lambda execution role (which must have SNS:Publish).
 */
export async function sendSMS(options: SMSOptions): Promise<{ success: boolean; messageId?: string }> {
  const { to, message, type = 'transactional', templateId, entityId, senderId } = options;
  const phone = normalizePhone(to);
  const settings = await loadSnsSettings();
  const attrs = buildSmsAttributesFromSettings(type, settings, { templateId, entityId, senderId });

  try {
    const region = settings.region || process.env.AWS_REGION || 'ap-south-1';
    const snsClient = settings.credentials
      ? new SNSClient({ region, credentials: settings.credentials })
      : new SNSClient({ region });
    
    // ✅ PRODUCTION FIX: Enhanced logging for debugging
    console.log(`[SMS] Attempting to send SMS to ${phone} via SNS in region ${region}`);
    console.log(`[SMS] Using credentials: ${settings.credentials ? 'DB credentials' : 'Lambda role'}`);
    console.log(`[SMS] Message attributes:`, JSON.stringify(attrs, null, 2));
    
    const publishCommand = new PublishCommand({
      PhoneNumber: phone,
      Message: message,
      MessageAttributes: attrs,
    });
    
    const sendStartTime = Date.now();
    const result = await snsClient.send(publishCommand);
    const sendDuration = Date.now() - sendStartTime;
    
    console.log(`[SMS] ✅ SNS publish successful in ${sendDuration}ms. MessageId: ${result?.MessageId}`);
    return { success: true, messageId: result?.MessageId };
  } catch (err: any) {
    const errorDetails: any = {
      message: err?.message || String(err),
      name: err?.name,
    };
    
    if (err?.Code) {
      errorDetails.code = err.Code;
      console.error('[SMS] ❌ SNS Error Code:', err.Code);
    }
    if (err?.$metadata) {
      errorDetails.httpStatusCode = err.$metadata.httpStatusCode;
      errorDetails.requestId = err.$metadata.requestId;
      errorDetails.attempts = err.$metadata.attempts;
      console.error('[SMS] ❌ SNS HTTP Status:', err.$metadata.httpStatusCode);
      console.error('[SMS] ❌ SNS Request ID:', err.$metadata.requestId);
    }
    if (err?.stack) {
      errorDetails.stack = err.stack;
    }
    
    console.error('[SMS] ❌ SNS send failed with details:', JSON.stringify(errorDetails, null, 2));
    
    // Check for specific error types
    if (err?.message?.includes('ETIMEDOUT') || err?.message?.includes('timeout')) {
      console.error('[SMS] ⚠️ Connection timeout - check VPC/NAT gateway configuration');
    }
    if (err?.Code === 'OptedOut') {
      console.error('[SMS] ⚠️ Phone number has opted out of SMS');
    }
    if (err?.Code === 'InvalidParameter') {
      console.error('[SMS] ⚠️ Invalid parameter - check phone number format or DLT attributes');
    }
    
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
