export interface WpayConvenienceSettingsRow {
  readonly convenienceFee: number;
  readonly convenienceGstRate: number;
  readonly platformGstRate: number;
}

export interface IWpayConvenienceSettingsRepository {
  getConvenienceSettings(): Promise<WpayConvenienceSettingsRow>;
  putConvenienceSettings(input: WpayConvenienceSettingsRow): Promise<WpayConvenienceSettingsRow>;
}
