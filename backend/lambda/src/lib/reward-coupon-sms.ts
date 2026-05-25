/**
 * Transactional SMS after external_link reward redemption (Amazon coupon, etc.).
 * Idempotent per reward_redemptions row; never throws to callers.
 */

import {
  buildRewardCouponSmsBody,
  JIO_REWARD_COUPON_TEMPLATE_ID,
} from '../constants/jio-reward-coupon-sms';
import { query, select } from '../database/rds-connection';
import { sendSMS } from '../utils/sms-service';

export function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidIndianMobile(phone: string): boolean {
  const digits = String(phone).replace(/\D/g, '');
  return digits.length === 10 || (digits.startsWith('91') && digits.length === 12);
}

/** Keep in sync with registered India DLT template (SMS_REWARD_COUPON_TEMPLATE_ID). */
export function buildRewardCouponSmsMessage(params: {
  customerName?: string | null;
  rewardName: string;
  link: string;
}): string {
  return buildRewardCouponSmsBody(params);
}

export async function loadCustomerContact(
  customerId: string
): Promise<{ phone: string | null; name: string | null }> {
  const rows = await select('customers', { id: customerId });
  const c = rows[0] as Record<string, unknown> | undefined;
  if (!c) return { phone: null, name: null };
  const phone = String(c.phone ?? c.phone_number ?? '').trim() || null;
  const name =
    String(c.name ?? c.full_name ?? c.first_name ?? '').trim() || null;
  return { phone, name };
}

function isMissingSmsColumnError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message || err).toLowerCase();
  return msg.includes('coupon_sms') || msg.includes('does not exist');
}

async function claimSmsSendSlot(
  redemptionId: string,
  customerId: string
): Promise<'claimed' | 'already_sent' | 'no_tracking'> {
  try {
    const r = await query(
      `UPDATE reward_redemptions
       SET coupon_sms_status = 'pending'
       WHERE id = $1::uuid
         AND customer_id = $2::uuid
         AND coupon_code IS NOT NULL
         AND coupon_sms_sent_at IS NULL
         AND COALESCE(coupon_sms_status, '') <> 'sent'
       RETURNING id`,
      [redemptionId, customerId]
    );
    return r.rows.length > 0 ? 'claimed' : 'already_sent';
  } catch (err: unknown) {
    if (isMissingSmsColumnError(err)) {
      console.warn(
        '[reward-coupon-sms] coupon_sms_* columns missing — apply migration 758; sending without DB idempotency'
      );
      return 'no_tracking';
    }
    throw err;
  }
}

async function markSmsSent(redemptionId: string, messageId: string | undefined): Promise<void> {
  try {
    await query(
      `UPDATE reward_redemptions
       SET coupon_sms_sent_at = NOW(),
           coupon_sms_message_id = $2,
           coupon_sms_status = 'sent'
       WHERE id = $1::uuid`,
      [redemptionId, messageId ?? null]
    );
  } catch (err: unknown) {
    console.warn('[reward-coupon-sms] markSmsSent failed:', err);
  }
}

async function markSmsFailed(redemptionId: string): Promise<void> {
  try {
    await query(
      `UPDATE reward_redemptions
       SET coupon_sms_status = 'failed'
       WHERE id = $1::uuid AND coupon_sms_sent_at IS NULL`,
      [redemptionId]
    );
  } catch {
    /* ignore */
  }
}

async function markSmsSkipped(redemptionId: string): Promise<void> {
  try {
    await query(
      `UPDATE reward_redemptions
       SET coupon_sms_status = 'skipped'
       WHERE id = $1::uuid AND coupon_sms_sent_at IS NULL`,
      [redemptionId]
    );
  } catch {
    /* ignore */
  }
}

export async function sendRewardCouponSmsAfterRedeem(params: {
  customerId: string;
  redemptionId: string;
  rewardName: string;
  link: string;
  phone?: string | null;
  customerName?: string | null;
}): Promise<{ sent: boolean; reason?: string; messageId?: string }> {
  const link = String(params.link).trim();
  if (!link || !isValidHttpUrl(link)) {
    return { sent: false, reason: 'invalid_link' };
  }
  if (!params.redemptionId) {
    return { sent: false, reason: 'no_redemption_row' };
  }

  let phone = params.phone?.trim() || null;
  let customerName = params.customerName ?? null;
  if (!phone || !customerName) {
    const contact = await loadCustomerContact(params.customerId);
    phone = phone || contact.phone;
    customerName = customerName ?? contact.name;
  }

  if (!phone || !isValidIndianMobile(phone)) {
    await markSmsSkipped(params.redemptionId);
    return { sent: false, reason: 'no_phone' };
  }

  const claim = await claimSmsSendSlot(params.redemptionId, params.customerId);
  if (claim === 'already_sent') {
    return { sent: false, reason: 'already_sent' };
  }

  const message = buildRewardCouponSmsMessage({
    customerName,
    rewardName: params.rewardName,
    link,
  });

  const templateId = JIO_REWARD_COUPON_TEMPLATE_ID || undefined;
  const result = await sendSMS({
    to: phone,
    message,
    type: 'transactional',
    ...(templateId ? { templateId } : {}),
  });

  if (result.success) {
    if (claim === 'claimed') {
      await markSmsSent(params.redemptionId, result.messageId);
    }
    console.log(
      `[reward-coupon-sms] sent redemption=${params.redemptionId} messageId=${result.messageId ?? 'n/a'}`
    );
    return { sent: true, messageId: result.messageId };
  }

  if (claim === 'claimed') {
    await markSmsFailed(params.redemptionId);
  }
  return { sent: false, reason: 'sns_failed' };
}
