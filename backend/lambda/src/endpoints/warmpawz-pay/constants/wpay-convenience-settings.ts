export const WPAY_SETTINGS_CATEGORY = 'wpay';

export const WPAY_CONVENIENCE_FEE_KEY = 'wpay_convenience_fee';
export const WPAY_CONVENIENCE_GST_RATE_KEY = 'wpay_convenience_gst_rate';
export const WPAY_PLATFORM_GST_RATE_KEY = 'wpay_platform_gst_rate';

export const WPAY_CONVENIENCE_DEFAULTS = {
  convenienceFee: 0,
  convenienceGstRate: 18,
  platformGstRate: 18,
} as const;
