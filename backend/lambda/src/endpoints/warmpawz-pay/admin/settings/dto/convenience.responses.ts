export interface ConvenienceSettingsDTO {
  readonly platformFee: number;
  readonly platformFeeGstRate: number;
  readonly convenienceFee: number;
  readonly convenienceGstRate: number;
  /** Inclusive GST rate extracted from platform revenue (C − D). */
  readonly platformGstRate: number;
  /** Burn/test mode — vendor paid full Q; platform funds discount. */
  readonly burnMode: boolean;
}
