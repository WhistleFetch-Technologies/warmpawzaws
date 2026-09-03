export const WPAY_SETTINGS_CATEGORY = 'wpay';

export const WPAY_CONVENIENCE_FEE_KEY = 'wpay_convenience_fee';
export const WPAY_CONVENIENCE_GST_RATE_KEY = 'wpay_convenience_gst_rate';
export const WPAY_PLATFORM_GST_RATE_KEY = 'wpay_platform_gst_rate';
export const WPAY_PLATFORM_FEE_KEY = 'wpay_platform_fee';
export const WPAY_PLATFORM_FEE_GST_RATE_KEY = 'wpay_platform_fee_gst_rate';

export const WPAY_CONVENIENCE_DEFAULTS = {
  platformFee: 0,
  platformFeeGstRate: 18,
  convenienceFee: 0,
  convenienceGstRate: 18,
  /** Inclusive GST rate extracted from platform revenue (C − D). */
  platformGstRate: 18,
} as const;
