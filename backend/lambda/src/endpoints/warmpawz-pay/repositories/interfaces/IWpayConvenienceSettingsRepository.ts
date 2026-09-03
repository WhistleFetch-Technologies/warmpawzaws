export interface WpayConvenienceSettingsRow {
  readonly platformFee: number;
  readonly platformFeeGstRate: number;
  readonly convenienceFee: number;
  readonly convenienceGstRate: number;
  /** Inclusive GST rate extracted from platform revenue (C − D). */
  readonly platformGstRate: number;
}

export interface IWpayConvenienceSettingsRepository {
  getConvenienceSettings(): Promise<WpayConvenienceSettingsRow>;
  putConvenienceSettings(input: WpayConvenienceSettingsRow): Promise<WpayConvenienceSettingsRow>;
}
