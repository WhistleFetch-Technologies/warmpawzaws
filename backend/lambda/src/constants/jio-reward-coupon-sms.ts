/**
 * Jio DLT — reward coupon SMS (must match approved text in Jio portal).
 * @see config/sms-templates-jio.json → reward_coupon_redeemed
 */

export const JIO_REWARD_COUPON_TEMPLATE_ID =
  process.env.SMS_REWARD_COUPON_TEMPLATE_ID?.trim() ||
  '1207177977818616933';

/** Body must match registered DLT template (only {#var#} spans differ). */
export function buildRewardCouponSmsBody(params: {
  customerName?: string | null;
  rewardName: string;
}): string {
  const first =
    String(params.customerName || 'there')
      .trim()
      .split(/\s+/)[0] || 'there';
  const reward = String(params.rewardName).trim() || 'Reward';
  return `Warmpawz: Hi ${first}, your ${reward} coupon is ready. View it in the Rewards and Points section of the app.`;
}
