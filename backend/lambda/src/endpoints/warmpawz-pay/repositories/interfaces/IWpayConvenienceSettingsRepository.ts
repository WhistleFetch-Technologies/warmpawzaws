export interface WpayConvenienceSettingsRow {
  readonly platformFee: number;
  readonly platformFeeGstRate: number;
  readonly convenienceFee: number;
  readonly convenienceGstRate: number;
  /** Inclusive GST rate extracted from platform revenue (C − D). */
  readonly platformGstRate: number;
  /**
   * Burn/test mode: vendor receives full quoted amount; platform funds the
   * customer discount. Customer pay amount and fees unchanged.
   */
  readonly burnMode: boolean;
}

export interface IWpayConvenienceSettingsRepository {
  getConvenienceSettings(): Promise<WpayConvenienceSettingsRow>;
  putConvenienceSettings(input: WpayConvenienceSettingsRow): Promise<WpayConvenienceSettingsRow>;
}
