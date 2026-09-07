import type { WpayFeeMode } from '../../../constants/wpay-convenience-settings';

export interface ConvenienceSettingsDTO {
  readonly platformFee: number;
  /** fixed = ₹; percent = % of post-discount customer amount. */
  readonly platformFeeMode: WpayFeeMode;
  readonly platformFeeGstRate: number;
  readonly convenienceFee: number;
  /** fixed = ₹; percent = % of post-discount customer amount. */
  readonly convenienceFeeMode: WpayFeeMode;
  readonly convenienceGstRate: number;
  /** Inclusive GST rate extracted from platform revenue (C − D). */
  readonly platformGstRate: number;
  /** Burn/test mode — vendor paid full Q; platform funds discount. */
  readonly burnMode: boolean;
}
