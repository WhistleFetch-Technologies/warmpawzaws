/**
 * Jio DLT — reward coupon link SMS (must match approved text in Jio portal).
 * @see config/sms-templates-jio.json → reward_coupon_redeemed
 */

export const JIO_REWARD_COUPON_TEMPLATE_ID =
  process.env.SMS_REWARD_COUPON_TEMPLATE_ID?.trim() || '';

/** Body must match registered DLT template (only variable spans differ). */
export function buildRewardCouponSmsBody(params: {
  customerName?: string | null;
  rewardName: string;
  link: string;
}): string {
  const first =
    String(params.customerName || 'there')
      .trim()
      .split(/\s+/)[0] || 'there';
  const reward = String(params.rewardName).trim() || 'Reward';
  const link = String(params.link).trim();
  return `Warmpawz: Hi ${first}, your ${reward} coupon is ready. Link: ${link}. View in app under Rewards and Points.`;
}
