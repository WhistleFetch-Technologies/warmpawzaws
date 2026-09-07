export const WPAY_SETTINGS_CATEGORY = 'wpay';

export const WPAY_CONVENIENCE_FEE_KEY = 'wpay_convenience_fee';
export const WPAY_CONVENIENCE_GST_RATE_KEY = 'wpay_convenience_gst_rate';
export const WPAY_PLATFORM_GST_RATE_KEY = 'wpay_platform_gst_rate';
export const WPAY_PLATFORM_FEE_KEY = 'wpay_platform_fee';
export const WPAY_PLATFORM_FEE_GST_RATE_KEY = 'wpay_platform_fee_gst_rate';
/** When true: vendor paid full Q; platform burns customer discount. */
export const WPAY_BURN_MODE_KEY = 'wpay_burn_mode';
/** How `wpay_platform_fee` is interpreted: fixed ₹ or % of post-discount amount. */
export const WPAY_PLATFORM_FEE_MODE_KEY = 'wpay_platform_fee_mode';
/** How `wpay_convenience_fee` is interpreted: fixed ₹ or % of post-discount amount. */
export const WPAY_CONVENIENCE_FEE_MODE_KEY = 'wpay_convenience_fee_mode';

export type WpayFeeMode = 'fixed' | 'percent';

export const WPAY_CONVENIENCE_DEFAULTS = {
  platformFee: 0,
  platformFeeMode: 'fixed' as WpayFeeMode,
  platformFeeGstRate: 18,
  convenienceFee: 0,
  convenienceFeeMode: 'fixed' as WpayFeeMode,
  convenienceGstRate: 18,
  /** Inclusive GST rate extracted from platform revenue (C − D). */
  platformGstRate: 18,
  burnMode: false,
} as const;
