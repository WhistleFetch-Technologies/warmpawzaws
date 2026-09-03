export type WpayCommercialModel = 'tier_commission' | 'withhold';

export interface WpayAdminPaymentItemDTO {
  readonly paymentId: string;
  readonly customer: {
    readonly name: string;
    readonly phone: string;
  };
  readonly vendor: {
    readonly name: string;
    readonly category: string;
    readonly tierName?: string | null;
  };
  readonly commercialModel: WpayCommercialModel;
  readonly originalAmount: number;
  readonly discountPercent: number;
  readonly discountAmount: number;
  readonly payableAmount: number;
  readonly appointmentFeeCredit?: number;
  readonly commissionPercent?: number;
  readonly vendorPayableAmount?: number;
  readonly wpayRevenueAmount?: number;
  readonly platformGstAmount?: number;
  readonly platformFee?: number;
  readonly platformFeeGstAmount?: number;
  readonly convenienceFee?: number;
  readonly convenienceGstAmount?: number;
  readonly finalGstAmount?: number;
  readonly platformWithholdPercent?: number;
  readonly platformWithholdAmount?: number;
  readonly vendorSettlementAmount: number;
  readonly settlementSource: 'persisted' | 'computed';
  readonly paidAt: string;
}

export interface WpayAdminPaymentsListDTO {
  readonly items: readonly WpayAdminPaymentItemDTO[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}
